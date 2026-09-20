import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'

const endpoints = {
  student: '/student/homeworks',
  teacher: '/teacher/students',
  admin: '/admin/students',
} as const

export function RoleDataPage() {
  const { session } = useAuth()
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.role) return
    const maxUserId = getMaxUserId()
    if (!maxUserId) return
    api.get(endpoints[session.role], { params: { max_user_id: maxUserId } })
      .then((response) => setData(response.data?.data || null))
      .catch(() => setError('Не удалось получить данные для выбранной роли.'))
  }, [session?.role])

  if (!session?.role) return <p className="state-message">Сначала выберите роль.</p>
  return <section className="card"><span className="eyebrow">Тестовые данные</span><h2>Роль: {session.role}</h2>{error ? <p className="error">{error}</p> : <pre className="data-preview">{JSON.stringify(data, null, 2)}</pre>}</section>
}
