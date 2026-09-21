import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Notice, PageState } from '../components/UiState'
import { getMaxUserId } from '../platform/max'

type Notification = { id: number; body: string; created_at: string; read_at?: string | null }
export function NotificationsPage() {
  const id = getMaxUserId()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!id) return
    if (!quiet) setLoading(true)
    try {
      const response = await api.get('/notifications', { params: { max_user_id: id } })
      setItems(response.data?.data?.notifications || [])
      setError('')
    } catch {
      if (!quiet) setError('Не удалось загрузить уведомления. Проверьте соединение.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 15000)
    return () => window.clearInterval(timer)
  }, [load])

  const read = async (notificationId: number) => {
    if (!id || busyId) return
    setBusyId(notificationId)
    try {
      await api.post('/notifications/read', { max_user_id: id, notification_id: notificationId })
      setItems((current) => current.map((item) => item.id === notificationId ? { ...item, read_at: new Date().toISOString() } : item))
    } catch {
      setError('Не удалось отметить уведомление прочитанным.')
    } finally {
      setBusyId(null)
    }
  }

  const unreadCount = items.filter((item) => !item.read_at).length

  return <section className="fi"><div className="section-heading"><div><span className="eyebrow">Обучение</span><h2>События</h2><p className="muted">{unreadCount ? `${unreadCount} непрочитанных` : 'Всё прочитано'}</p></div></div>{error && <Notice kind="error">{error}</Notice>}{loading ? <PageState>Загружаем события…</PageState> : <div className="student-list notification-list">{items.map((item) => <article className={`student-row notification-item ${item.read_at ? 'is-read' : 'is-new'}`} key={item.id}><div className="notification-heading"><strong>{item.read_at ? 'Прочитано' : 'Новое событие'}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div><p>{item.body}</p>{!item.read_at && <button className="text-button" disabled={busyId === item.id} type="button" onClick={() => void read(item.id)}>{busyId === item.id ? 'Сохраняем…' : 'Отметить прочитанным'}</button>}</article>)}{!items.length && <PageState kind="empty">Уведомлений пока нет. Здесь появятся результаты проверки работ, комментарии и учебные события.</PageState>}</div>}</section>
}
