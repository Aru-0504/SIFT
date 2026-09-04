from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models import WatchlistItem, UserCheckpoint, DetectedChange
from app.market_data import market_data_provider
from app.market_data.base import ProviderUnavailableError, InvalidSymbolError
from app.services.significance import compute_significance
from app.schemas import WatchlistItemResponse, ChangeInfo


def add_symbol(db: Session, user_id: str, symbol: str) -> None:
    if not market_data_provider.validate_symbol(symbol):
        raise InvalidSymbolError(f"'{symbol}' is not a recognized symbol")

    item = WatchlistItem(user_id=user_id, symbol=symbol)
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        # Duplicate add (UNIQUE constraint) — treated as a no-op success,
        # not an error. Idempotent by design: retries/double-clicks are safe.
        db.rollback()


def remove_symbol(db: Session, user_id: str, symbol: str) -> None:
    db.query(WatchlistItem).filter_by(user_id=user_id, symbol=symbol).delete()
    db.commit()


def get_watchlist_with_changes(db: Session, user_id: str) -> tuple[list[WatchlistItemResponse], int]:
    items = db.query(WatchlistItem).filter_by(user_id=user_id).all()
    responses: list[WatchlistItemResponse] = []
    unseen_count = 0

    for item in items:
        symbol = item.symbol
        try:
            quote = market_data_provider.get_quote(symbol)
        except ProviderUnavailableError:
            # Nothing cached and live fetch failed — surface a clear error
            # state for this one symbol rather than failing the whole list.
            responses.append(WatchlistItemResponse(
                symbol=symbol,
                price=0.0,
                previous_close=0.0,
                is_stale=True,
                stale_reason="provider_unavailable_no_cache",
                source="unavailable",
                fetched_at=datetime.utcnow(),
                change_since_last_seen=None,
            ))
            continue

        checkpoint = db.query(UserCheckpoint).filter_by(user_id=user_id, symbol=symbol).first()
        change_info = None

        if checkpoint is not None:
            unseen_change = db.query(DetectedChange).filter_by(
                user_id=user_id, symbol=symbol, status="unseen"
            ).first()
            history = []
            try:
                history = market_data_provider.get_recent_history(symbol, days=10)
            except ProviderUnavailableError:
                history = []

            result = compute_significance(
                current_price=quote.price,
                checkpoint_price=float(checkpoint.last_seen_price),
                recent_history=history,
            )

            if result["is_significant"]:
                _record_change(db, user_id, symbol, float(checkpoint.last_seen_price), quote.price, result)
                unseen_change = db.query(DetectedChange).filter_by(
                    user_id=user_id, symbol=symbol, status="unseen"
                ).first()

            if unseen_change is not None:
                unseen_count += 1

            change_info = ChangeInfo(
                pct_change=result["pct_change"],
                threshold_used=result["threshold_used"],
                significance=result["significance"],
                signals=result["signals"],
            )
        else:
            # First time this user has ever seen this symbol — establish
            # a checkpoint now so future visits have something to diff against.
            db.add(UserCheckpoint(
                user_id=user_id,
                symbol=symbol,
                last_seen_price=quote.price,
                last_seen_at=datetime.utcnow(),
            ))
            db.commit()

        responses.append(WatchlistItemResponse(
            symbol=symbol,
            price=quote.price,
            previous_close=quote.previous_close,
            is_stale=quote.is_stale,
            stale_reason=quote.stale_reason,
            source=quote.source,
            fetched_at=quote.fetched_at,
            change_since_last_seen=change_info,
        ))

    return responses, unseen_count


def _record_change(db: Session, user_id: str, symbol: str, previous_price: float,
                    current_price: float, result: dict) -> None:
    # Avoid spamming duplicate unseen rows for the same unacknowledged move
    # on every single page load — only record if there isn't already an
    # unseen change for this symbol.
    existing = db.query(DetectedChange).filter_by(
        user_id=user_id, symbol=symbol, status="unseen"
    ).first()
    if existing:
        return

    change = DetectedChange(
        user_id=user_id,
        symbol=symbol,
        previous_price=previous_price,
        current_price=current_price,
        pct_change=result["pct_change"],
        significance_score=result["threshold_used"],
        signals={"signals": result["signals"], "significance": result["significance"]},
        status="unseen",
    )
    db.add(change)
    db.commit()


def acknowledge(db: Session, user_id: str, symbols: list[str] | None) -> None:
    """
    Advances the checkpoint to NOW for the given symbols (or all watched
    symbols if none specified), and marks matching unseen changes as
    acknowledged. Deliberately explicit and separate from GET /watchlist —
    a page refresh must never silently erase the diff being shown to the
    user. Only an explicit acknowledgment does that.
    """
    query = db.query(WatchlistItem).filter_by(user_id=user_id)
    if symbols:
        query = query.filter(WatchlistItem.symbol.in_(symbols))
    target_symbols = [i.symbol for i in query.all()]

    for symbol in target_symbols:
        try:
            quote = market_data_provider.get_quote(symbol)
        except ProviderUnavailableError:
            continue

        checkpoint = db.query(UserCheckpoint).filter_by(user_id=user_id, symbol=symbol).first()
        if checkpoint:
            checkpoint.last_seen_price = quote.price
            checkpoint.last_seen_at = datetime.utcnow()
        else:
            db.add(UserCheckpoint(
                user_id=user_id, symbol=symbol,
                last_seen_price=quote.price, last_seen_at=datetime.utcnow(),
            ))

        db.query(DetectedChange).filter_by(
            user_id=user_id, symbol=symbol, status="unseen"
        ).update({"status": "acknowledged"})

    db.commit()


def get_history(db: Session, user_id: str, symbol: str) -> list[DetectedChange]:
    return (
        db.query(DetectedChange)
        .filter_by(user_id=user_id, symbol=symbol)
        .order_by(DetectedChange.created_at.desc())
        .all()
    )
