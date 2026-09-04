import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { StockCard } from './StockCard'
import { AddStock } from './AddStock'
import { FilterTab, ViewMode, ChangeHistoryEntry } from '../types'
import logoUrl from '../../logo.png'

export function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const queryClient = useQueryClient()
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [historySymbol, setHistorySymbol] = useState<string | null>(null)

  // Main watchlist query with 45-second polling (matching cache TTL)
  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
    refetchInterval: 45_000,
  })

  // History query when modal is active
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['history', historySymbol],
    queryFn: () => (historySymbol ? api.getHistory(historySymbol) : Promise.resolve([])),
    enabled: !!historySymbol,
  })

  const addMutation = useMutation({
    mutationFn: api.addSymbol,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const removeMutation = useMutation({
    mutationFn: api.removeSymbol,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const ackMutation = useMutation({
    mutationFn: (symbols?: string[]) => api.acknowledge(symbols),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const flagMutation = useMutation({
    mutationFn: api.toggleFlag,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const items = data?.items ?? []
  const unseenCount = data?.unseen_change_count ?? 0
  const flaggedCount = items.filter((i) => i.is_flagged).length

  // Filtered stocks based on tab and search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.symbol.toLowerCase().includes(searchQuery.trim().toLowerCase())
      if (!matchesSearch) return false

      if (filterTab === 'unseen') {
        return item.has_unseen_change || item.change_since_last_seen?.significance !== 'normal'
      }
      if (filterTab === 'flagged') {
        return item.is_flagged
      }
      if (filterTab === 'normal') {
        return item.change_since_last_seen?.significance === 'normal' || !item.change_since_last_seen
      }
      return true
    })
  }, [items, filterTab, searchQuery])

  const formatPrice = (price: number) =>
    `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
    if (diffMins < 60) return `${diffMins} min ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Top Navigation */}
      <nav
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'rgba(248, 242, 234, 0.95)',
        }}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-4">
          {/* Prominent Logo */}
          <div className="flex items-center">
            <img
              src={logoUrl}
              alt="SIFT — Stock Insight Filtering & Tracking"
              className="h-12 sm:h-14 md:h-16 w-auto max-w-[240px] sm:max-w-[300px] md:max-w-[340px] object-contain object-left drop-shadow-sm transition-transform hover:scale-[1.02]"
            />
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live Data Badge */}
            <div
              className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-full text-xs font-semibold shadow-sm"
              style={{
                backgroundColor: 'rgba(85, 107, 72, 0.12)',
                color: 'var(--color-positive)',
                border: '1px solid var(--color-positive-border)',
              }}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${isFetching ? 'animate-ping' : ''}`}
                style={{ backgroundColor: 'var(--color-positive)' }}
              ></span>
              <span className="font-medium tracking-wide">
                {isFetching ? 'Syncing market…' : 'Live feed active'}
              </span>
            </div>

            {/* Quick Refresh Button */}
            <button
              onClick={() => refetch()}
              title="Refresh Watchlist Now"
              className="p-2.5 rounded-full hover:bg-black/5 active:scale-95 transition-all"
              style={{
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              <svg
                className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {/* Sign Out Button */}
            <button
              onClick={onSignOut}
              className="btn btn-secondary text-xs px-4 py-2 font-semibold shadow-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="editorial-card p-4 flex items-center justify-between">
            <div>
              <p className="font-meta" style={{ color: 'var(--color-text-muted)' }}>TOTAL TRACKED</p>
              <p className="text-2xl font-metric font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                {items.length}
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: 'var(--color-surface-secondary)', color: 'var(--color-accent)' }}
            >
              #
            </div>
          </div>

          <div
            className="editorial-card p-4 flex items-center justify-between"
            style={{
              backgroundColor: unseenCount > 0 ? 'rgba(141, 90, 82, 0.06)' : 'var(--color-surface)',
              borderColor: unseenCount > 0 ? 'var(--color-negative-border)' : 'var(--color-border)',
            }}
          >
            <div>
              <p className="font-meta" style={{ color: 'var(--color-text-muted)' }}>ACTION REQUIRED</p>
              <p className="text-2xl font-metric font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                {unseenCount}
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{
                backgroundColor: unseenCount > 0 ? 'var(--color-negative-bg)' : 'var(--color-surface-secondary)',
                color: unseenCount > 0 ? 'var(--color-negative)' : 'var(--color-text-muted)',
              }}
            >
              !
            </div>
          </div>

          <div className="editorial-card p-4 flex items-center justify-between">
            <div>
              <p className="font-meta" style={{ color: 'var(--color-text-muted)' }}>FLAGGED FOR LATER</p>
              <p className="text-2xl font-metric font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                {flaggedCount}
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
            >
              ★
            </div>
          </div>
        </div>

        {/* Checkpoint Anomaly Hero */}
        {unseenCount > 0 && (
          <section
            className="mb-8 p-6 sm:p-7 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(92, 61, 74, 0.12), rgba(184, 139, 105, 0.08))',
              border: '1px solid var(--color-border)',
            }}
          >
            <p className="font-meta mb-2" style={{ color: 'var(--color-text-muted)' }}>
              SINCE YOU LAST CHECKED
            </p>
            <h2 className="text-2xl sm:text-3xl font-heading mb-2" style={{ color: 'var(--color-text-primary)' }}>
              What changed, and what mattered.
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              We filter out noise and surface only moves that stand out relative to each stock’s recent behavior.
              <span className="block mt-1 text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
                {unseenCount} meaningful {unseenCount === 1 ? 'change' : 'changes'} detected since your last visit.
              </span>
            </p>
            <button
              onClick={() => ackMutation.mutate()}
              disabled={ackMutation.isPending}
              className="btn btn-primary"
            >
              {ackMutation.isPending ? 'Updating…' : `Mark all (${unseenCount}) as reviewed`}
            </button>
          </section>
        )}

        {/* Add Stock Component */}
        <AddStock onAdd={(s) => addMutation.mutate(s)} isPending={addMutation.isPending} />

        {addMutation.isError && (
          <div
            className="p-3 mb-6 rounded-xl text-xs flex items-center justify-between"
            style={{
              backgroundColor: 'var(--color-negative-bg)',
              color: 'var(--color-negative)',
              border: '1px solid var(--color-negative-border)',
            }}
          >
            <span>{(addMutation.error as Error).message}</span>
            <button onClick={() => addMutation.reset()} className="underline font-semibold">
              Dismiss
            </button>
          </div>
        )}

        {/* Controls Toolbar: Tabs, Search, View Mode */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div
            className="flex items-center gap-1.5 p-1 rounded-xl overflow-x-auto"
            style={{ backgroundColor: 'var(--color-surface-secondary)', border: '1px solid var(--color-border)' }}
          >
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterTab === 'all' ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: filterTab === 'all' ? '#FFFFFF' : 'transparent',
                color: filterTab === 'all' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              All Stocks ({items.length})
            </button>
            <button
              onClick={() => setFilterTab('unseen')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filterTab === 'unseen' ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: filterTab === 'unseen' ? '#FFFFFF' : 'transparent',
                color: filterTab === 'unseen' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              <span>Needs Attention</span>
              {unseenCount > 0 && (
                <span
                  className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold text-white"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {unseenCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilterTab('flagged')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterTab === 'flagged' ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: filterTab === 'flagged' ? '#FFFFFF' : 'transparent',
                color: filterTab === 'flagged' ? 'var(--color-warning)' : 'var(--color-text-secondary)',
              }}
            >
              Flagged ({flaggedCount})
            </button>
            <button
              onClick={() => setFilterTab('normal')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterTab === 'normal' ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: filterTab === 'normal' ? '#FFFFFF' : 'transparent',
                color: filterTab === 'normal' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Within Baseline
            </button>
          </div>

          {/* Search & Layout View Mode Switcher */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-52">
              <input
                type="text"
                placeholder="Filter symbols…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field py-1 px-3 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1.5 text-xs text-slate-500 hover:text-black"
                >
                  ✕
                </button>
              )}
            </div>

            <div
              className="flex items-center p-1 rounded-xl"
              style={{ backgroundColor: 'var(--color-surface-secondary)', border: '1px solid var(--color-border)' }}
            >
              <button
                onClick={() => setViewMode('grid')}
                title="Card Grid View"
                className="p-1 rounded-lg transition-all"
                style={{
                  backgroundColor: viewMode === 'grid' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Compact Table View"
                className="p-1 rounded-lg transition-all"
                style={{
                  backgroundColor: viewMode === 'table' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'table' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-16 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Loading your watchlist…
            </p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div
            className="p-6 rounded-xl mb-8 text-center"
            style={{
              backgroundColor: 'var(--color-negative-bg)',
              border: '1px solid var(--color-negative-border)',
            }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--color-negative)' }}>
              Couldn't load your watchlist: {(error as Error).message}
            </p>
            <button onClick={() => refetch()} className="btn btn-primary mt-4 text-xs">
              Retry Connection
            </button>
          </div>
        )}

        {/* Empty Watchlist */}
        {!isLoading && !isError && items.length === 0 && (
          <div className="text-center py-16 px-8">
            <h2 className="text-xl font-heading mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Your watchlist is empty.
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Add the names you follow and SIFT will flag only the moves that matter since your last check.
            </p>
          </div>
        )}

        {/* No Filter Matches */}
        {!isLoading && !isError && items.length > 0 && filteredItems.length === 0 && (
          <div className="editorial-card p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No stocks matched your active filter or search query.
            </p>
            <button
              onClick={() => {
                setFilterTab('all')
                setSearchQuery('')
              }}
              className="btn btn-ghost text-xs mt-2"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* View Mode: Card Grid */}
        {!isLoading && !isError && filteredItems.length > 0 && viewMode === 'grid' && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-2">
            {filteredItems.map((item) => (
              <StockCard
                key={item.symbol}
                item={item}
                onRemove={(s) => removeMutation.mutate(s)}
                onToggleFlag={(s) => flagMutation.mutate(s)}
                onAcknowledge={(s) => ackMutation.mutate([s])}
                onViewHistory={(s) => setHistorySymbol(s)}
                isAckPending={ackMutation.isPending}
                isFlagPending={flagMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* View Mode: Tabular Overview */}
        {!isLoading && !isError && filteredItems.length > 0 && viewMode === 'table' && (
          <div className="editorial-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-[10px] font-meta uppercase"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface-secondary)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-right">Since Check</th>
                    <th className="py-3 px-4">Threshold</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Reviewed</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: 'var(--color-border)' }}>
                  {filteredItems.map((item) => {
                    const change = item.change_since_last_seen
                    const sig = change?.significance ?? 'normal'
                    const pct = change?.pct_change
                    const isPos = (pct ?? 0) >= 0

                    return (
                      <tr key={item.symbol} className="hover:bg-black/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-ticker font-bold" style={{ color: 'var(--color-text-primary)' }}>
                          <span className="flex items-center gap-1.5">
                            {item.symbol}
                            {item.has_unseen_change && (
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }}></span>
                            )}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-metric font-semibold text-right" style={{ color: 'var(--color-text-primary)' }}>
                          {formatPrice(item.price)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {pct !== undefined ? (
                            <span
                              className="font-metric font-bold"
                              style={{ color: isPos ? 'var(--color-positive)' : 'var(--color-negative)' }}
                            >
                              {isPos ? '+' : ''}{pct.toFixed(2)}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-metric" style={{ color: 'var(--color-text-secondary)' }}>
                          {change ? `±${change.threshold_used.toFixed(2)}%` : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                            style={{
                              backgroundColor:
                                sig === 'high'
                                  ? 'var(--color-negative-bg)'
                                  : sig === 'notable'
                                  ? 'var(--color-warning-bg)'
                                  : 'var(--color-surface-secondary)',
                              color:
                                sig === 'high'
                                  ? 'var(--color-negative)'
                                  : sig === 'notable'
                                  ? 'var(--color-warning)'
                                  : 'var(--color-text-muted)',
                            }}
                          >
                            {sig === 'high' ? 'Significant' : sig === 'notable' ? 'Notable' : 'Normal'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4" style={{ color: 'var(--color-text-muted)' }}>
                          {getTimeAgo(item.last_reviewed_at)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.has_unseen_change && (
                              <button
                                onClick={() => ackMutation.mutate([item.symbol])}
                                title="Mark as reviewed"
                                className="p-1.5 rounded text-xs font-semibold"
                                style={{ backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
                              >
                                ✓
                              </button>
                            )}
                            <button
                              onClick={() => flagMutation.mutate(item.symbol)}
                              title={item.is_flagged ? 'Unflag' : 'Flag'}
                              className="p-1.5 rounded text-xs"
                              style={{
                                color: item.is_flagged ? 'var(--color-warning)' : 'var(--color-text-muted)',
                                backgroundColor: item.is_flagged ? 'var(--color-warning-bg)' : 'transparent',
                              }}
                            >
                              ★
                            </button>
                            <button
                              onClick={() => setHistorySymbol(item.symbol)}
                              title="History"
                              className="p-1.5 rounded text-xs hover:bg-black/5"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              🕒
                            </button>
                            <button
                              onClick={() => removeMutation.mutate(item.symbol)}
                              title="Remove"
                              className="p-1.5 rounded text-xs hover:bg-black/5"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* History Inspection Modal */}
      {historySymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="editorial-card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            {/* Modal Header */}
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-ticker text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {historySymbol}
                  </span>
                  <span className="font-meta" style={{ color: 'var(--color-text-muted)' }}>
                    DETECTION HISTORY
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Past significant anomalies recorded for this symbol
                </p>
              </div>
              <button
                onClick={() => setHistorySymbol(null)}
                className="p-1.5 rounded-lg text-sm hover:bg-black/5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 divide-y space-y-3" style={{ borderColor: 'var(--color-border)' }}>
              {isHistoryLoading && (
                <div className="py-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Loading history…
                </div>
              )}

              {!isHistoryLoading && (!historyData || historyData.length === 0) && (
                <div className="py-10 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  No significant movements recorded yet for {historySymbol}.
                </div>
              )}

              {!isHistoryLoading &&
                historyData &&
                historyData.map((entry: ChangeHistoryEntry, idx: number) => {
                  const isPos = entry.pct_change >= 0
                  return (
                    <div key={idx} className="pt-3 first:pt-0">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="font-metric font-bold text-sm"
                          style={{ color: isPos ? 'var(--color-positive)' : 'var(--color-negative)' }}
                        >
                          {isPos ? '+' : ''}{entry.pct_change.toFixed(2)}%
                        </span>
                        <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs flex items-center gap-2 mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                        <span>Threshold: ±{entry.significance_score.toFixed(2)}%</span>
                        <span>•</span>
                        <span className="capitalize">{entry.status}</span>
                      </div>
                      {entry.signals?.signals && entry.signals.signals.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.signals.signals.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] px-2 py-0.5 rounded font-meta"
                              style={{
                                backgroundColor: 'var(--color-surface-secondary)',
                                color: 'var(--color-text-secondary)',
                                border: '1px solid var(--color-border)',
                              }}
                            >
                              {s.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex justify-end" style={{ borderColor: 'var(--color-border)' }}>
              <button onClick={() => setHistorySymbol(null)} className="btn btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
