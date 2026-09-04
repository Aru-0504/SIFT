import { WatchlistItem } from '../types'

interface StockCardProps {
  item: WatchlistItem
  onRemove: (symbol: string) => void
  onToggleFlag: (symbol: string) => void
  onAcknowledge: (symbol: string) => void
  onViewHistory: (symbol: string) => void
  isAckPending?: boolean
  isFlagPending?: boolean
}

export function StockCard({
  item,
  onRemove,
  onToggleFlag,
  onAcknowledge,
  onViewHistory,
  isAckPending = false,
  isFlagPending = false,
}: StockCardProps) {
  const change = item.change_since_last_seen
  const sig = change?.significance ?? 'normal'
  const pctChange = change?.pct_change
  const isPositive = (pctChange ?? 0) >= 0

  const parseBackendTimestamp = (timestamp: string) => {
    return new Date(timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`)
  }

  const getTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return 'First review'
    const now = new Date()
    const then = parseBackendTimestamp(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  const formatPrice = (price: number) =>
    `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const threshold = change?.threshold_used ?? 1.0
  const ratio = pctChange !== undefined && threshold > 0 ? Math.abs(pctChange) / threshold : 0
  const barWidthPct = Math.min(100, Math.round((ratio / 2.5) * 100))

  return (
    <div
      className={`editorial-card editorial-card-interactive p-5 flex flex-col justify-between relative ${
        sig === 'high' ? 'card-high-attention' : sig === 'notable' ? 'card-notable' : ''
      }`}
    >
      <div>
        {/* Header & Symbol Details */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-ticker text-lg font-bold tracking-wider" style={{ color: 'var(--color-text-primary)' }}>
              {item.symbol}
            </span>
            {item.has_unseen_change && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold font-meta"
                style={{ backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
              >
                UNSEEN
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Flag Button */}
            <button
              onClick={() => onToggleFlag(item.symbol)}
              disabled={isFlagPending}
              title={item.is_flagged ? 'Unflag symbol' : 'Flag for later'}
              className="p-1.5 rounded-lg text-xs transition-colors"
              style={{
                backgroundColor: item.is_flagged ? 'var(--color-warning-bg)' : 'transparent',
                color: item.is_flagged ? 'var(--color-warning)' : 'var(--color-text-muted)',
                border: item.is_flagged ? '1px solid var(--color-warning-border)' : '1px solid transparent',
              }}
            >
              <svg className="w-4 h-4" fill={item.is_flagged ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>

            {/* History Button */}
            <button
              onClick={() => onViewHistory(item.symbol)}
              title="View detection log"
              className="p-1.5 rounded-lg text-xs transition-colors hover:bg-black/5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Remove Button */}
            <button
              onClick={() => onRemove(item.symbol)}
              title="Remove from watchlist"
              className="p-1.5 rounded-lg text-xs transition-colors hover:bg-black/5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Live Price & Movement Delta */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-3xl font-metric font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {formatPrice(item.price)}
            </div>
            <div className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <span>Prev close: {formatPrice(item.previous_close)}</span>
              {item.is_stale && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
                >
                  Cached fallback
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            {pctChange !== undefined ? (
              <div
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-metric font-bold text-sm"
                style={{
                  backgroundColor: isPositive ? 'var(--color-positive-bg)' : 'var(--color-negative-bg)',
                  color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)',
                  border: `1px solid ${isPositive ? 'var(--color-positive-border)' : 'var(--color-negative-border)'}`,
                }}
              >
                <span>{isPositive ? '▲ +' : '▼ '}</span>
                <span>{pctChange.toFixed(2)}%</span>
              </div>
            ) : (
              <span className="text-xs font-metric" style={{ color: 'var(--color-text-muted)' }}>
                Baseline set
              </span>
            )}
            <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              since last check
            </div>
          </div>
        </div>

        {/* Volatility Threshold Gauge */}
        <div
          className="rounded-xl p-3 border mb-4"
          style={{ backgroundColor: 'var(--color-surface-secondary)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    sig === 'high'
                      ? 'var(--color-negative)'
                      : sig === 'notable'
                      ? 'var(--color-warning)'
                      : 'var(--color-text-muted)',
                }}
              ></span>
              {sig === 'high' ? 'Significant move' : sig === 'notable' ? 'Notable move' : 'Normal range'}
            </span>
            <span className="font-metric font-bold text-xs" style={{ color: 'var(--color-text-primary)' }}>
              {ratio.toFixed(1)}× volatility band
            </span>
          </div>

          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(92, 61, 74, 0.1)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(6, barWidthPct)}%`,
                backgroundColor:
                  sig === 'high'
                    ? 'var(--color-negative)'
                    : sig === 'notable'
                    ? 'var(--color-warning)'
                    : 'var(--color-text-muted)',
              }}
            ></div>
          </div>

          {change?.signals && change.signals.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {change.signals.map((sigText) => (
                <span
                  key={sigText}
                  className="text-[10px] px-2 py-0.5 rounded font-meta"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.6)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                >
                  {sigText.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Checkpoint Review Timestamps */}
        <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <span className="block text-[10px] font-meta uppercase" style={{ color: 'var(--color-text-muted)' }}>Last Reviewed</span>
            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{getTimeAgo(item.last_reviewed_at)}</span>
          </div>
          <div>
            <span className="block text-[10px] font-meta uppercase" style={{ color: 'var(--color-text-muted)' }}>Review Price</span>
            <span className="font-metric font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {item.last_reviewed_price !== null && item.last_reviewed_price !== undefined
                ? formatPrice(item.last_reviewed_price)
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Review CTA button */}
      {item.has_unseen_change && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => onAcknowledge(item.symbol)}
            disabled={isAckPending}
            className="btn btn-primary w-full py-2 text-xs"
          >
            {isAckPending ? 'Updating…' : 'Mark as reviewed'}
          </button>
        </div>
      )}
    </div>
  )
}
