import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { getMaxUserId, isDemoMode, prepareMax, setDemoUserId } from '../../platform/max'

export type Session = {
  hasUser: boolean
  role: 'student' | 'teacher' | 'admin' | null
  roles: string[]
  isAdmin: boolean
  isTeacher: boolean
  isStudent: boolean
  isGuest: boolean
  phoneVerified: boolean
  student: Record<string, unknown> | null
  teacher: Record<string, unknown> | null
  unread_notifications_count: number
}

type AuthContextValue = { session: Session | null; loading: boolean; error: string; isDemoMode: boolean; selectDemoRole: (maxUserId: number) => void; reload: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = async () => {
    setLoading(true)
    setError('')
    try {
      const id = getMaxUserId()
      if (!id) {
        setSession(null)
        return
      }
      const response = await api.get<{ ok: boolean; data: Session }>('/session', { params: { max_user_id: id } })
      setSession(response.data.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить сессию')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { prepareMax(); void reload() }, [])
  const selectDemoRole = (maxUserId: number) => {
    setDemoUserId(maxUserId)
    void reload()
  }
  const value = useMemo(() => ({ session, loading, error, isDemoMode, selectDemoRole, reload }), [session, loading, error])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
