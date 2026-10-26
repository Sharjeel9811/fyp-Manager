import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { tokenStore } from '@/lib/api'

export type Role = 'STUDENT' | 'SUPERVISOR' | 'ADMIN'

export interface AuthUser {
  id: string
  email: string
  role: Role
  firstName: string
  lastName: string
  name: string
  emailVerified: boolean
  studentId: string | null
  employeeId: string | null
  phone: string | null
  bio: string | null
  department: string | null
  departmentId: string | null
  maxSupervisees: number | null
  availability: boolean | null
  /** Profile picture as a data: URI (null until the user uploads one). */
  avatar: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (payload: Record<string, unknown>) => Promise<AuthUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  updateUser: (user: AuthUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function homeForRole(role: Role): string {
  return role === 'ADMIN' ? '/admin/dashboard' : role === 'SUPERVISOR' ? '/supervisor/dashboard' : '/student/dashboard'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user)
    } catch {
      tokenStore.clear()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStore.set(data.token)
    setUser(data.user)
    return data.user as AuthUser
  }, [])

  const register = useCallback(async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/auth/register', payload)
    tokenStore.set(data.token)
    setUser(data.user)
    return data.user as AuthUser
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* token may already be invalid */
    }
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refresh, updateUser: setUser }),
    [user, loading, login, register, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
