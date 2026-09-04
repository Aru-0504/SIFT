import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { SymbolSearchResult } from '../types'

interface AddStockProps {
  onAdd: (symbol: string) => void
  isPending: boolean
}

export function AddStock({ onAdd, isPending }: AddStockProps) {
  const [value, setValue] = useState('')
  const [results, setResults] = useState<SymbolSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const quickPicks = [
    { label: 'AAPL', name: 'Apple Inc', symbol: 'AAPL' },
    { label: 'NVDA', name: 'Nvidia Corp', symbol: 'NVDA' },
    { label: 'MSFT', name: 'Microsoft Corp', symbol: 'MSFT' },
    { label: 'TSLA', name: 'Tesla Inc', symbol: 'TSLA' },
    { label: 'AMZN', name: 'Amazon.com Inc', symbol: 'AMZN' },
    { label: 'RELIANCE', name: 'Reliance Industries', symbol: 'RELIANCE.NS' },
  ]

  // Debounced search query
  useEffect(() => {
    const trimmed = value.trim()
    if (!trimmed || trimmed.length < 1) {
      setResults([])
      setIsSearching(false)
      setIsOpen(false)
      return
    }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchSymbols(trimmed)
        setResults(data || [])
        setIsOpen((data || []).length > 0)
        setHighlightedIndex(-1)
      } catch (err) {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 220)

    return () => clearTimeout(timer)
  }, [value])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (symbol: string) => {
    onAdd(symbol.toUpperCase())
    setValue('')
    setIsOpen(false)
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen && results.length > 0) {
        setIsOpen(true)
        setHighlightedIndex(0)
      } else if (results.length > 0) {
        setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isOpen && highlightedIndex >= 0 && results[highlightedIndex]) {
        handleSelect(results[highlightedIndex].symbol)
      } else if (value.trim()) {
        handleSelect(value.trim())
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="editorial-card p-5 sm:p-6 mb-8 relative z-20" ref={containerRef}>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (!isOpen && e.target.value.trim()) setIsOpen(true)
            }}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search by name or ticker (e.g. Apple, NVDA, Reliance, TSLA)..."
            aria-label="Stock search"
            className="input-field pr-20"
            disabled={isPending}
            autoComplete="off"
          />

          {/* Right Status Badge / Enter Hint */}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5 pointer-events-none">
            {isSearching ? (
              <svg className="animate-spin h-4 w-4 text-emerald-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            ) : (
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono rounded text-slate-500 bg-black/5 border border-black/10">
                ENTER
              </kbd>
            )}
          </div>

          {/* Autocomplete Dropdown Menu */}
          {isOpen && results.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden shadow-2xl transition-all"
              style={{
                backgroundColor: 'rgba(255, 252, 248, 0.98)',
                backdropFilter: 'blur(12px)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                maxHeight: '320px',
              }}
            >
              <div className="p-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2" style={{ color: 'var(--color-text-muted)' }}>
                  Matching Stocks ({results.length})
                </span>
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  Use ↑↓ to navigate
                </span>
              </div>

              <div className="overflow-y-auto max-h-[260px] py-1 divide-y divide-black/5">
                {results.map((item, idx) => {
                  const isHighlighted = idx === highlightedIndex
                  return (
                    <button
                      key={`${item.symbol}-${idx}`}
                      type="button"
                      onClick={() => handleSelect(item.symbol)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        isHighlighted ? 'bg-black/[0.06]' : 'hover:bg-black/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Ticker badge */}
                        <span
                          className="font-mono font-bold text-sm px-2.5 py-1 rounded-md shrink-0 shadow-xs"
                          style={{
                            backgroundColor: isHighlighted ? 'var(--color-accent)' : 'rgba(30, 63, 32, 0.08)',
                            color: isHighlighted ? '#ffffff' : 'var(--color-accent)',
                          }}
                        >
                          {item.symbol}
                        </span>

                        {/* Company Name */}
                        <div className="truncate">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {item.name}
                          </p>
                          {item.type && (
                            <p className="text-[11px] capitalize" style={{ color: 'var(--color-text-muted)' }}>
                              {item.type}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Exchange & Country Tag */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.exchange && (
                          <span
                            className="text-[11px] font-medium px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.05)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {item.exchange}
                          </span>
                        )}
                        {item.country && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded hidden sm:inline-block"
                            style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.03)',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            {item.country}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            if (value.trim()) handleSelect(value.trim())
          }}
          disabled={isPending || !value.trim()}
          className="btn btn-primary sm:w-auto w-full px-6 shadow-sm"
        >
          {isPending ? 'Adding…' : 'Add symbol'}
        </button>
      </div>

      {/* Suggested Quick Add Tags */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Quick picks:</span>
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

