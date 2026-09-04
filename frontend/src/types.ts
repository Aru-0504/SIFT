export interface ChangeInfo {
  pct_change: number
  threshold_used: number
  significance: 'normal' | 'notable' | 'high'
  signals: string[]
}

export interface WatchlistItem {
  symbol: string
  price: number
  previous_close: number
  is_stale: boolean
  stale_reason: string | null
  source: string
  fetched_at: string
  last_reviewed_at: string | null
  last_reviewed_price: number | null
  is_flagged: boolean
  has_unseen_change: boolean
  change_since_last_seen: ChangeInfo | null
}

export interface WatchlistResponse {
  items: WatchlistItem[]
  unseen_change_count: number
}

export interface ChangeHistoryEntry {
  symbol: string
  pct_change: number
  significance_score: number
  signals: {
    signals?: string[]
    significance?: string
    [key: string]: any
  }
  status: string
  created_at: string
}

export type FilterTab = 'all' | 'unseen' | 'flagged' | 'normal'
export type ViewMode = 'grid' | 'table'
