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
  change_since_last_seen: ChangeInfo | null
}

export interface WatchlistResponse {
  items: WatchlistItem[]
  unseen_change_count: number
}
