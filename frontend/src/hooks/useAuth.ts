import { createContext, useContext, useState, useCallback, useEffect } from 'react'

export const AUTH_TOKEN_KEY = 'token'

interface AuthContextValue {
  token: string | null
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useAuthState() {
  const [token, setToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(AUTH_TOKEN_KEY)
  )

  // Sync avec les changements de localStorage (autre onglet ou clear manuel)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY || e.key === null) {
        setToken(localStorage.getItem(AUTH_TOKEN_KEY))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback((nextToken: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken)
    setToken(nextToken)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setToken(null)
  }, [])

  return { token, isAuthenticated: Boolean(token), login, logout }
}
