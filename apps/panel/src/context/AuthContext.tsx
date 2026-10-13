import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getMe, User } from '../api/client'

interface AuthCtx {
  user: User | null
  loading: boolean
  setAuth: (token: string, user: User) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('token')) { setLoading(false); return }
    getMe()
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const setAuth = (token: string, u: User) => {
    localStorage.setItem('token', token)
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, setAuth, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
