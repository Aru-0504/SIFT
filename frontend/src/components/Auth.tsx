import { useState } from 'react'
import { api } from '../api'

export function Auth() {
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = mode === 'sign_in'
        ? await api.signIn(email, password)
        : await api.signUp(email, password)

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user_id', data.user_id)
      window.location.reload()
    } catch (err) {
      setError((err as Error).message || (mode === 'sign_in' ? 'Sign in failed' : 'Sign up failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-md p-8 sm:p-12" style={{ backgroundColor: 'rgba(248, 242, 234, 0.9)', border: '1px solid var(--color-border)', borderRadius: '24px', boxShadow: '0 20px 40px rgba(45, 36, 31, 0.06)' }}>
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-display mb-2" style={{ color: 'var(--color-text-primary)' }}>SIFT</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.01em' }}>Know what changed since you last checked.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-meta mb-2" style={{ color: 'var(--color-text-secondary)' }}>EMAIL</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-meta mb-2" style={{ color: 'var(--color-text-secondary)' }}>PASSWORD</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="input"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-xs p-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-negative)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !email || !password}
            className="btn btn-primary w-full"
            style={{ padding: '12px 16px' }}
          >
            {loading ? 'Please wait…' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
          </button>

          <button
            onClick={() => {
              setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')
              setError(null)
            }}
            className="btn btn-ghost w-full text-sm"
            disabled={loading}
          >
            {mode === 'sign_in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>

        <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Your watchlist is private to your account.</p>
        </div>
      </div>
    </div>
  )
}
