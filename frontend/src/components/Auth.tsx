import { useState } from 'react'
import { api } from '../api'
import logoUrl from '../../logo.png'

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
      const data =
        mode === 'sign_in'
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
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Horizontal 2-Column Editorial Card */}
      <div
        className="w-full max-w-4xl editorial-card overflow-hidden grid grid-cols-1 md:grid-cols-12 shadow-2xl"
        style={{
          backgroundColor: 'rgba(248, 242, 234, 0.95)',
          borderRadius: '24px',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Left Column: Brand, Tagline & Philosophy */}
        <div
          className="md:col-span-5 p-8 sm:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r"
          style={{
            borderColor: 'var(--color-border)',
            background: 'linear-gradient(180deg, rgba(232, 217, 200, 0.45) 0%, rgba(248, 242, 234, 0.2) 100%)',
          }}
        >
          <div>
            <img
              src={logoUrl}
              alt="SIFT — Stock Insight Filtering & Tracking"
              className="h-12 sm:h-14 md:h-16 w-auto max-w-[260px] sm:max-w-[280px] object-contain object-left mb-6 transition-transform hover:scale-[1.01]"
            />

            <div className="space-y-3.5">
              <h2
                className="text-2xl sm:text-3xl font-heading leading-tight"
                style={{ color: 'var(--color-text-primary)' }}
              >
                The market moved. SIFT noticed.
              </h2>
              <p
                className="text-base sm:text-lg font-bold tracking-tight"
                style={{ color: 'var(--color-accent)' }}
              >
                Not every move deserves your attention.
              </p>
              <p
                className="text-sm sm:text-[15px] leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                SIFT remembers where you left off and surfaces the changes that actually stand out from a stock's normal behavior.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="space-y-2.5 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-accent)' }}></span>
                <span>Contextual volatility diffing</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-positive)' }}></span>
                <span>Explicit acknowledgment checkpoints</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-warning)' }}></span>
                <span>Shared upstream provider cache</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Credentials Form */}
        <div className="md:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-8">
              <h3 className="text-2xl sm:text-3xl font-heading leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                {mode === 'sign_in' ? 'Sign in to your watchlist' : 'Create your account'}
              </h3>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs sm:text-sm font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field py-3 px-4 text-base"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  className="input-field py-3 px-4 text-base"
                  disabled={loading}
                />
              </div>

              {error && (
                <div
                  className="text-sm p-3.5 rounded-xl"
                  style={{
                    backgroundColor: 'var(--color-negative-bg)',
                    color: 'var(--color-negative)',
                    border: '1px solid var(--color-negative-border)',
                  }}
                >
                  {error}
                </div>
              )}

              <div className="pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <button
                  onClick={submit}
                  disabled={loading || !email || !password}
                  className="btn btn-primary px-8 py-3 text-base font-semibold sm:w-auto w-full shadow-md"
                >
                  {loading ? 'Please wait…' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
                </button>

                <button
                  onClick={() => {
                    setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')
                    setError(null)
                  }}
                  className="btn btn-ghost text-sm font-medium px-2 sm:w-auto w-full"
                  disabled={loading}
                >
                  {mode === 'sign_in'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>

            <div className="mt-10 pt-6 text-center border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs sm:text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                Your checkpoints and watchlist items are isolated and private to your account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
