import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import { setOnUnauthorized } from '../api/client'
import { clearTokens, getTokens } from '../api/tokenStore'
import type { LoginRequest, RegisterRequest, RegisterResult, Role, User } from '../api/types'

interface AuthContextValue {
  user: User | null
  initializing: boolean
  login: (payload: LoginRequest) => Promise<User>
  register: (payload: RegisterRequest) => Promise<RegisterResult>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    setOnUnauthorized(() => {
      clearTokens()
      setUser(null)
    })
  }, [])

  useEffect(() => {
    if (!getTokens()) {
      setInitializing(false)
      return
    }
    authApi
      .fetchMe()
      // signOut() có thể kết thúc trước request này; token đã xóa thì không khôi phục user nữa
      .then((me) => {
        if (getTokens()) setUser(me)
      })
      .catch(() => {
        clearTokens()
        setUser(null)
      })
      .finally(() => setInitializing(false))
  }, [])

  const login = useCallback(async (payload: LoginRequest) => {
    const me = await authApi.loginAsUser(payload)
    setUser(me)
    return me
  }, [])

  // Đăng ký không tạo phiên: backend chỉ trả userId, người dùng phải xác minh email rồi tự đăng nhập.
  const register = useCallback((payload: RegisterRequest) => authApi.register(payload), [])

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      clearTokens()
    }
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!getTokens()) return
    const fresh = await authApi.fetchMe()
    setUser(fresh)
  }, [])

  const value = useMemo(
    () => ({ user, initializing, login, register, signOut, refreshUser, setUser }),
    [user, initializing, login, register, signOut, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function dashboardPathForRole(role: Role | undefined): string {
  if (role === 'TUTOR') return '/tutor'
  if (role === 'ADMIN') return '/admin'
  return '/parent'
}
