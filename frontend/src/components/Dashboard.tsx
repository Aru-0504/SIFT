import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { AddStock } from './AddStock'
import logoUrl from '../../logo-SIFT.png'

export function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
    refetchInterval: 45_000, // matches backend cache TTL
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
    mutationFn: () => api.acknowledge(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const unseenCount = data?.unseen_change_count ?? 0
  const items = data?.items ?? []
  const dataSource = items.find((item) => item.source)?.source
  const dataLabel = dataSource === 'demo' ? 'Demo data' : dataSource === 'twelve_data' ? 'Live data' : 'Data status'
  
  // Separate items by significance
  const significantItems = items.filter(item => item.change_since_last_seen?.significance !== 'normal')
  const normalItems = items.filter(item => item.change_since_last_seen?.significance === 'normal' || !item.change_since_last_seen)
  
  // Format time since last update
  const parseBackendTimestamp = (timestamp: string) => {
    return new Date(timestamp.endsWith('Z') ? timestamp : `${timestamp}Z`)
  }

  const getTimeAgo = (timestamp: string) => {
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

  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`
  }

  const formatPctChange = (pct: number) => {
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${pct.toFixed(2)}%`
  }

  const getSignalMultiplier = (threshold: number, pctChange: number) => {
    if (threshold === 0) return '0×'
    const multiplier = Math.abs(pctChange) / threshold
    return `${multiplier.toFixed(1)}×`
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Navigation */}
      <nav className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(248, 242, 234, 0.9)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt="SIFT logo" className="h-10 w-10 rounded-lg object-contain" />
            <div>
              <h1 className="text-xl font-display" style={{ color: 'var(--color-text-primary)' }}>SIFT</h1>
              <p className="text-xs hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>Stock Insight Filtering & Tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs" style={{ backgroundColor: dataSource === 'demo' ? 'rgba(176, 123, 62, 0.12)' : 'rgba(110, 117, 88, 0.12)', color: dataSource === 'demo' ? 'var(--color-warning)' : 'var(--color-positive)' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-positive)' }}></span>
              {dataLabel}
            </div>
            <button onClick={onSignOut} className="btn btn-ghost text-sm">
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {/* Checkpoint Hero */}
        {unseenCount > 0 && (
          <section className="mb-8 p-6 sm:p-7 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(92, 61, 74, 0.12), rgba(184, 139, 105, 0.08))', border: '1px solid var(--color-border)' }}>
            <p className="text-[10px] font-meta mb-2" style={{ color: 'var(--color-text-muted)' }}>SINCE YOU LAST CHECKED</p>
            <h2 className="text-2xl sm:text-3xl font-heading mb-2" style={{ color: 'var(--color-text-primary)' }}>What changed, and what mattered.</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              We filter out noise and surface only moves that stand out relative to each stock’s recent behavior.
              <span className="block mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {unseenCount} meaningful change{unseenCount > 1 ? 's' : ''} need your attention.
              </span>
            </p>
            <button 
              onClick={() => ackMutation.mutate()}
              disabled={ackMutation.isPending}
              className="btn btn-primary"
            >
              Mark as reviewed
            </button>
          </section>
        )}

        {/* Add Stock */}
        <section className="mb-8">
          <AddStock onAdd={(s) => addMutation.mutate(s)} isPending={addMutation.isPending} />
          {addMutation.isError && (
            <p className="text-xs mt-2" style={{ color: 'var(--color-negative)' }}>{(addMutation.error as Error).message}</p>
          )}
        </section>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading your watchlist…</p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="p-4 rounded-lg mb-8" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <p className="text-sm" style={{ color: 'var(--color-negative)' }}>Couldn't load your watchlist: {(error as Error).message}</p>
          </div>
        )}

        {/* Empty State */}
        {data && data.items.length === 0 && (
          <div className="text-center py-16 px-8">
            <h2 className="text-xl font-heading mb-2" style={{ color: 'var(--color-text-primary)' }}>Your watchlist is empty.</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Add the names you follow and SIFT will flag only the moves that matter since your last check.
            </p>
            <button 
              onClick={() => document.querySelector('input')?.focus()}
              className="btn btn-primary"
            >
              Add your first stock
            </button>
          </div>
        )}

        {/* Needs Attention Section */}
        {significantItems.length > 0 && (
          <section className="mb-8">
            <div className="mb-4">
              <h3 className="text-lg font-heading mb-1" style={{ color: 'var(--color-text-primary)' }}>Meaningful movement</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.02em' }}>Filtered for relevance, not raw noise</p>
            </div>
            
            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {/* Table Header - Desktop */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
                <div className="col-span-3 text-xs font-meta" style={{ color: 'var(--color-text-muted)' }}>STOCK</div>
                <div className="col-span-2 text-xs font-meta text-right" style={{ color: 'var(--color-text-muted)' }}>PRICE</div>
                <div className="col-span-2 text-xs font-meta text-right" style={{ color: 'var(--color-text-muted)' }}>SINCE CHECK</div>
                <div className="col-span-3 text-xs font-meta" style={{ color: 'var(--color-text-muted)' }}>SIGNAL</div>
                <div className="col-span-2 text-xs font-meta" style={{ color: 'var(--color-text-muted)' }}>STATUS</div>
              </div>
              
              {/* Table Rows */}
              {significantItems.map((item) => {
                const change = item.change_since_last_seen
                const isPositive = change && change.pct_change !== undefined ? change.pct_change >= 0 : false
                const signalText = change?.signals?.[0]?.replace(/_/g, ' ') || 'Unusual movement'
                const multiplier = change && change.pct_change !== undefined ? getSignalMultiplier(change.threshold_used, change.pct_change) : '0×'
                
                return (
                  <div 
                    key={item.symbol}
                    className="grid grid-cols-12 gap-4 px-4 py-4 border-b hover:bg-opacity-50 transition-colors cursor-pointer sm:grid-cols-12"
                    style={{ 
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Mobile layout - stacked */}
                    <div className="col-span-12 sm:hidden">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-ticker text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.symbol}</div>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium" style={{ 
                          backgroundColor: change?.significance === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: change?.significance === 'high' ? 'var(--color-negative)' : 'var(--color-warning)'
                        }}>
                          {change?.significance === 'high' ? 'Significant' : 'Notable'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-metric text-sm" style={{ color: 'var(--color-text-primary)' }}>{formatPrice(item.price)}</div>
                        <div className={`text-xs font-metric ${isPositive ? '' : ''}`} style={{ color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                          {formatPctChange(change?.pct_change || 0)}
                        </div>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{signalText}</div>
                      <div className="text-xs font-metric mt-1" style={{ color: 'var(--color-text-secondary)' }}>{multiplier} normal</div>
                    </div>
                    
                    {/* Desktop layout - grid */}
                    <div className="hidden sm:col-span-3 sm:block">
                      <div className="font-ticker text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.symbol}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.symbol}</div>
                    </div>
                    <div className="hidden sm:col-span-2 sm:block sm:text-right">
                      <div className="font-metric text-sm" style={{ color: 'var(--color-text-primary)' }}>{formatPrice(item.price)}</div>
                      <div className={`text-xs font-metric ${isPositive ? '' : ''}`} style={{ color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                        {formatPctChange(change?.pct_change || 0)}
                      </div>
                    </div>
                    <div className="hidden sm:col-span-2 sm:block sm:text-right">
                      <div className="text-xs font-metric" style={{ color: 'var(--color-text-secondary)' }}>{multiplier} normal</div>
                    </div>
                    <div className="hidden sm:col-span-3 sm:block">
                      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{signalText}</div>
                    </div>
                    <div className="hidden sm:col-span-2 sm:block">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium" style={{ 
                        backgroundColor: change?.significance === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: change?.significance === 'high' ? 'var(--color-negative)' : 'var(--color-warning)'
                      }}>
                        {change?.significance === 'high' ? 'Significant' : 'Notable'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* No Meaningful Change Section */}
        {normalItems.length > 0 && (
          <section className="mb-8">
            <div className="mb-4">
              <h3 className="text-lg font-heading mb-1" style={{ color: 'var(--color-text-primary)' }}>Within the normal range</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.02em' }}>These names are behaving within their recent baseline</p>
            </div>
            
            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {normalItems.map((item) => {
                const change = item.change_since_last_seen
                const isPositive = change && change.pct_change !== undefined ? change.pct_change >= 0 : false
                
                return (
                  <div 
                    key={item.symbol}
                    className="grid grid-cols-12 gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-opacity-50 transition-colors sm:grid-cols-12"
                    style={{ 
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Mobile layout - stacked */}
                    <div className="col-span-12 sm:hidden">
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-ticker text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.symbol}</div>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs" style={{ 
                          backgroundColor: 'rgba(100, 116, 139, 0.1)',
                          color: 'var(--color-text-muted)'
                        }}>
                          Normal
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="font-metric text-sm" style={{ color: 'var(--color-text-primary)' }}>{formatPrice(item.price)}</div>
                        <div className={`text-xs font-metric ${isPositive ? '' : ''}`} style={{ color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                          {change ? formatPctChange(change.pct_change) : '—'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Desktop layout - grid */}
                    <div className="hidden sm:col-span-4 sm:block">
                      <div className="font-ticker text-sm" style={{ color: 'var(--color-text-primary)' }}>{item.symbol}</div>
                    </div>
                    <div className="hidden sm:col-span-3 sm:block sm:text-right">
                      <div className="font-metric text-sm" style={{ color: 'var(--color-text-primary)' }}>{formatPrice(item.price)}</div>
                    </div>
                    <div className="hidden sm:col-span-3 sm:block sm:text-right">
                      <div className={`text-xs font-metric ${isPositive ? '' : ''}`} style={{ color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                        {change ? formatPctChange(change.pct_change) : '—'}
                      </div>
                    </div>
                    <div className="hidden sm:col-span-2 sm:block">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs" style={{ 
                        backgroundColor: 'rgba(100, 116, 139, 0.1)',
                        color: 'var(--color-text-muted)'
                      }}>
                        Normal
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Watchlist Summary */}
        {items.length > 0 && (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="text-lg font-heading" style={{ color: 'var(--color-text-primary)' }}>Your watchlist</h3>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <div 
                    key={item.symbol}
                    className="relative group"
                  >
                    <span className="font-ticker text-xs px-2 py-1 rounded" style={{ 
                      backgroundColor: 'var(--color-surface-secondary)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)'
                    }}>
                      {item.symbol}
                    </span>
                    <button
                      onClick={() => removeMutation.mutate(item.symbol)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: 'var(--color-negative)', color: 'white' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Data freshness indicator */}
            {items.length > 0 && (
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {items[0].source === 'demo' ? 'Demo data refreshed' : 'Data updated'} {getTimeAgo(items[0].fetched_at)}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
