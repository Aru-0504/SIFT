import { WatchlistResponse } from './types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function authHeaders(): Promise<Record<string, string>> {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  signIn: async (email: string, password: string) => {
    return fetch(`${BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => handle<{ access_token: string; user_id: string }>(r))
  },

  signUp: async (email: string, password: string) => {
    return fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => handle<{ access_token: string; user_id: string }>(r))
  },

  getWatchlist: async () => {
    const headers = await authHeaders()
    return fetch(`${BASE_URL}/watchlist`, { headers }).then((r) => handle<WatchlistResponse>(r))
  },

  addSymbol: async (symbol: string) => {
    const headers = await authHeaders()
    return fetch(`${BASE_URL}/watchlist/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ symbol }),
    }).then((r) => handle(r))
  },

  removeSymbol: async (symbol: string) => {
    const headers = await authHeaders()
    return fetch(`${BASE_URL}/watchlist/items/${encodeURIComponent(symbol)}`, {
      method: 'DELETE',
      headers,
    }).then((r) => handle(r))
  },

  acknowledge: async (symbols?: string[]) => {
    const headers = await authHeaders()
    return fetch(`${BASE_URL}/watchlist/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ symbols: symbols ?? null }),
    }).then((r) => handle(r))
  },
}
