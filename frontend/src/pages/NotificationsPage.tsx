import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { getMaxUserId } from '../platform/max'

type Notification = { id: number; body: string; created_at: string; read_at?: string | null }
export function NotificationsPage() {
  const id = getMaxUserId(); const [items, setItems] = useState<Notification[]>([])
  const load = () => id && api.get('/notifications', { params: { max_user_id: id } }).then((r) => setItems(r.data?.data?.notifications || []))
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 15000); return () => window.clearInterval(timer) }, [id])
  const read = async (notificationId: number) => { if (!id) return; await api.post('/notifications/read', { max_user_id: id, notification_id: notificationId }); void load() }
  return <section><div className="section-heading"><div><span className="eyebrow">Обучение</span><h2>Уведомления</h2></div></div><div className="student-list">{items.map((item) => <article className="student-row" key={item.id}><strong>{item.read_at ? 'Прочитано' : 'Новое'}</strong><p>{item.body}</p><span>{item.created_at}</span>{!item.read_at && <button className="text-button" type="button" onClick={() => void read(item.id)}>Отметить прочитанным</button>}</article>)}{!items.length && <p className="muted">Новых уведомлений нет.</p>}</div></section>
}
