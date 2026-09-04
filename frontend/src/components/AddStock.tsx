import { useState } from 'react'

export function AddStock({ onAdd, isPending }: { onAdd: (symbol: string) => void; isPending: boolean }) {
  const [value, setValue] = useState('')
  const quickSymbols = ['AAPL', 'RELIANCE.NS', 'TCS.NS', 'NVDA']

  const submit = () => {
    const symbol = value.trim().toUpperCase()
    if (!symbol) return
    onAdd(symbol)
    setValue('')
  }

  return (
    <div>
      <div className="flex gap-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Search stocks or add symbol (e.g., RELIANCE.NS, AAPL)"
          aria-label="Search stocks or add symbol"
          className="input flex-1"
          disabled={isPending}
        />
        <button
          onClick={submit}
          disabled={isPending || !value.trim()}
          className="btn btn-primary min-w-[84px]"
        >
          {isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Try a symbol</span>
        {quickSymbols.map((symbol) => (
          <button
            key={symbol}
            type="button"
            onClick={() => onAdd(symbol)}
            disabled={isPending}
            className="quick-symbol"
          >
            {symbol}
          </button>
        ))}
      </div>
    </div>
  )
}
