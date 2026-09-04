from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import auth
from app.config import get_cors_origins, settings
from app.main import health
from app.services.significance import compute_significance
from app.services import watchlist_service
from app.models import Base, WatchlistItem
from app.market_data.base import Quote


def test_cors_origins_are_parsed_from_configuration(monkeypatch):
    monkeypatch.setattr(settings, "cors_origins", "http://localhost:5173, https://app.example.com")

    assert get_cors_origins() == ["http://localhost:5173", "https://app.example.com"]


def test_health_reports_local_database(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "database_url", "sqlite:///./test.db")

    assert health() == {"status": "ok", "environment": "test", "database": "sqlite"}


def test_auth_accepts_authenticated_token(monkeypatch):
    secret = "test-secret"
    monkeypatch.setattr(settings, "supabase_jwt_secret", secret)
    token = jwt.encode(
        {
            "sub": "user-123",
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        secret,
        algorithm="HS256",
    )
    credentials = auth.HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    assert auth.get_current_user_id(credentials) == "user-123"


def test_auth_rejects_expired_token(monkeypatch):
    secret = "test-secret"
    monkeypatch.setattr(settings, "supabase_jwt_secret", secret)
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        secret,
        algorithm="HS256",
    )
    credentials = auth.HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as error:
        auth.get_current_user_id(credentials)

    assert error.value.status_code == 401
    assert error.value.detail == "Token expired"


def test_significance_flags_large_move():
    result = compute_significance(120, 100, [100, 100, 101, 99])

    assert result["significance"] == "high"
    assert result["is_significant"] is True
    assert "large_outlier_move" in result["signals"]


def test_unseen_change_remains_reviewable_after_move_returns_to_normal(monkeypatch):
    class SequenceProvider:
        def __init__(self):
            self.prices = iter([100.0, 103.0, 100.5, 100.5, 100.5])

        def get_quote(self, symbol):
            price = next(self.prices)
            return Quote(
                symbol=symbol,
                price=price,
                previous_close=100.0,
                volume=0,
                fetched_at=datetime.utcnow(),
                source="test",
            )

        def get_recent_history(self, symbol, days=10):
            return [100.0] * 5

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    db.add(WatchlistItem(user_id="user-1", symbol="AAPL"))
    db.commit()
    monkeypatch.setattr(watchlist_service, "market_data_provider", SequenceProvider())

    watchlist_service.get_watchlist_with_changes(db, "user-1")
    _, unseen_after_large_move = watchlist_service.get_watchlist_with_changes(db, "user-1")
    _, unseen_after_normal_move = watchlist_service.get_watchlist_with_changes(db, "user-1")

    assert unseen_after_large_move == 1
    assert unseen_after_normal_move == 1

    watchlist_service.acknowledge(db, "user-1", None)
    _, unseen_after_ack = watchlist_service.get_watchlist_with_changes(db, "user-1")
    assert unseen_after_ack == 0