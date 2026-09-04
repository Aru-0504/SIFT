from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app import auth
from app.config import get_cors_origins, settings
from app.main import health
from app.services.significance import compute_significance


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