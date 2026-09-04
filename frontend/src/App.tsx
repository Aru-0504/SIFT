import { useEffect, useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { Auth } from './components/Auth'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user has valid token in localStorage
    const token = localStorage.getItem('access_token')
    setIsAuthenticated(!!token)
    setLoading(false)
  }, [])

  const handleSignOut = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_id')
    setIsAuthenticated(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {isAuthenticated ? <Dashboard onSignOut={handleSignOut} /> : <Auth />}
    </div>
  )
}
