import { WatchlistItem } from '../types'

const parseBackendTimestamp = (timestamp: string) => {
  return new Date(timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`)
}

const significanceStyles: Record<string, { border: string; badge: string; label: string }> = {
  high: { border: 'border-red-500/60', badge: 'bg-red-500/20 text-red-300', label: '🔴 High attention' },
  notable: { border: 'border-amber-400/60', badge: 'bg-amber-400/20 text-amber-300', label: '🟡 Notable' },
  normal: { border: 'border-slate-700', badge: 'bg-slate-700/40 text-slate-400', label: '⚪ No meaningful change' },
}

export function StockCard({
  item,
  onRemove,
}: {
  item: WatchlistItem
  onRemove: (symbol: string) => void
}) {
  const sig = item.change_since_last_seen?.significance ?? 'normal'
  const style = significanceStyles[sig]
  const pctChange = item.change_since_last_seen?.pct_change

  return (
    <div className={`rounded-xl border ${style.border} bg-slate-900 p-4 flex flex-col gap-2`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-slate-100 font-semibold text-lg">{item.symbol}</h3>
          <p className="text-slate-400 text-sm">
            {item.is_stale ? (
              <span className="text-amber-400">⚠ Delayed data — last updated {parseBackendTimestamp(item.fetched_at).toLocaleTimeString()}</span>
            ) : (
              <>As of {parseBackendTimestamp(item.fetched_at).toLocaleTimeString()}</>
            )}
          </p>
        </div>
        <button
          onClick={() => onRemove(item.symbol)}
          className="text-slate-500 hover:text-red-400 text-sm"
          aria-label={`Remove ${item.symbol}`}
        >
          ✕
        </button>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-slate-50">₹{item.price.toFixed(2)}</span>
        {pctChange !== undefined && pctChange !== null && (
          <span className={pctChange >= 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
            {pctChange >= 0 ? '+' : ''}
            {pctChange.toFixed(2)}%
          </span>
        )}
      </div>

      <span className={`self-start px-2 py-1 rounded-full text-xs font-medium ${style.badge}`}>
        {style.label}
      </span>

      {item.change_since_last_seen && item.change_since_last_seen.signals.length > 0 && (
        <ul className="text-xs text-slate-400 mt-1 space-y-0.5">
          {item.change_since_last_seen.signals.map((s) => (
            <li key={s}>• {s.replace(/_/g, ' ')}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
