from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user_id
from app.models import WatchlistFlag
from app.schemas import (
    AddSymbolRequest, WatchlistResponse, AckRequest, ChangeHistoryEntry, SymbolSearchResult, ForexResponse,
)
from app.services import watchlist_service
from app.market_data.base import InvalidSymbolError

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.get("/search", response_model=list[SymbolSearchResult])
def search_symbols(q: str = "", user_id: str = Depends(get_current_user_id)):
    if not q or len(q.strip()) < 1:
        return []
    return watchlist_service.search_symbols(q.strip())


@router.get("/forex", response_model=ForexResponse)
def get_forex_rate():
    from app.market_data.forex import get_forex_summary
    return get_forex_summary()


@router.post("/items", status_code=status.HTTP_201_CREATED)
def add_item(payload: AddSymbolRequest, db: Session = Depends(get_db),
             user_id: str = Depends(get_current_user_id)):
    try:
        resolved_symbol = watchlist_service.add_symbol(db, user_id, payload.symbol)
    except InvalidSymbolError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"symbol": resolved_symbol, "status": "added"}


@router.delete("/items/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(symbol: str, db: Session = Depends(get_db),
                 user_id: str = Depends(get_current_user_id)):
    watchlist_service.remove_symbol(db, user_id, symbol.upper())
    return None


@router.get("", response_model=WatchlistResponse)
def get_watchlist(db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    items, unseen_count = watchlist_service.get_watchlist_with_changes(db, user_id)
    return WatchlistResponse(items=items, unseen_change_count=unseen_count)


@router.post("/ack")
def acknowledge_changes(payload: AckRequest, db: Session = Depends(get_db),
                         user_id: str = Depends(get_current_user_id)):
    watchlist_service.acknowledge(db, user_id, payload.symbols)
    return {"status": "acknowledged"}


@router.post("/items/{symbol}/flag")
def toggle_flag(symbol: str, db: Session = Depends(get_db),
                user_id: str = Depends(get_current_user_id)):
    normalized_symbol = symbol.upper()
    flag = db.query(WatchlistFlag).filter_by(user_id=user_id, symbol=normalized_symbol).first()
    if flag:
        db.delete(flag)
        status_value = "unflagged"
    else:
        db.add(WatchlistFlag(user_id=user_id, symbol=normalized_symbol))
        status_value = "flagged"
    db.commit()
    return {"status": status_value, "symbol": normalized_symbol}


@router.get("/items/{symbol}/history", response_model=list[ChangeHistoryEntry])
def get_symbol_history(symbol: str, db: Session = Depends(get_db),
                        user_id: str = Depends(get_current_user_id)):
    changes = watchlist_service.get_history(db, user_id, symbol.upper())
    return [
        ChangeHistoryEntry(
            symbol=str(getattr(c, "symbol")),
            pct_change=float(getattr(c, "pct_change")),
            significance_score=float(getattr(c, "significance_score")),
            signals=getattr(c, "signals") if isinstance(getattr(c, "signals"), dict) else {},
            status=str(getattr(c, "status")),
            created_at=getattr(c, "created_at"),
        )
        for c in changes
    ]
