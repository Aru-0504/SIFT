import { useState } from 'react'

interface AddStockProps {
  onAdd: (symbol: string) => void
  isPending: boolean
}

export function AddStock({ onAdd, isPending }: AddStockProps) {
  const [value, setValue] = useState('')
  const quickPicks = [
    { label: 'AAPL', name: 'Apple Inc', symbol: 'AAPL' },
    { label: 'NVDA', name: 'Nvidia Corp', symbol: 'NVDA' },
    { label: 'MSFT', name: 'Microsoft Corp', symbol: 'MSFT' },
    { label: 'TSLA', name: 'Tesla Inc', symbol: 'TSLA' },
    { label: 'AMZN', name: 'Amazon.com Inc', symbol: 'AMZN' },
    { label: 'GOOGL', name: 'Alphabet Inc', symbol: 'GOOGL' },
  ]

  const submit = () => {
    const symbol = value.trim().toUpperCase()
    if (!symbol) return
    onAdd(symbol)
    setValue('')
  }

  return (
    <div className="editorial-card p-5 sm:p-6 mb-8">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Enter symbol (e.g., AAPL, NVDA, MSFT, TSLA)..."
            aria-label="Stock ticker symbol"
            className="input-field pr-16"
            disabled={isPending}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono rounded text-slate-500 bg-black/5 border border-black/10">
              ENTER
            </kbd>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={isPending || !value.trim()}
          className="btn btn-primary sm:w-auto w-full px-6"
        >
          {isPending ? 'Adding…' : 'Add symbol'}
        </button>
      </div>

      {/* Suggested Quick Add Tags */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Try a symbol:</span>
        {quickPicks.map((pick) => (
          <button
            key={pick.symbol}
            type="button"
            onClick={() => onAdd(pick.symbol)}
            disabled={isPending}
            title={pick.name}
            className="quick-chip"
          >
            <span>{pick.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
