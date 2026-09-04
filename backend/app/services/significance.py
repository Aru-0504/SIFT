from statistics import mean, stdev


def compute_significance(current_price: float, checkpoint_price: float, recent_history: list[float]) -> dict:
    """
    Decide whether a price move is "meaningful" relative to THIS stock's own
    recent volatility, rather than a flat global percentage. A 2% move on a
    historically stable stock is unusual; the same 2% on a volatile one is
    just Tuesday. We measure normal daily swing via coefficient of variation
    of recent closes, then require the move to clear a multiple of that.

    This is deliberately simple and fully explainable in one sentence, using
    only numbers we can actually compute from real historical data - no
    invented weights dressed up as a sophisticated model.
    """
    if checkpoint_price == 0:
        pct_change = 0.0
    else:
        pct_change = (current_price - checkpoint_price) / checkpoint_price * 100

    if len(recent_history) >= 2:
        avg_price = mean(recent_history)
        volatility_pct = (stdev(recent_history) / avg_price * 100) if avg_price else 0.0
    else:
        volatility_pct = 0.0

    # Floor of 1.0% so an ultra-stable stock doesn't become hair-trigger,
    # ceiling multiplier of 1.5x volatility so a genuinely volatile stock
    # still requires a real outlier move to be flagged.
    threshold = max(volatility_pct * 1.5, 1.0)

    abs_change = abs(pct_change)
    if abs_change >= threshold * 2:
        significance = "high"
    elif abs_change >= threshold:
        significance = "notable"
    else:
        significance = "normal"

    signals = []
    if abs_change >= threshold:
        signals.append("price_move_beyond_volatility_band")
    if abs_change >= threshold * 2:
        signals.append("large_outlier_move")

    return {
        "pct_change": round(pct_change, 2),
        "threshold_used": round(threshold, 2),
        "volatility_pct": round(volatility_pct, 2),
        "significance": significance,
        "is_significant": significance != "normal",
        "signals": signals,
    }
