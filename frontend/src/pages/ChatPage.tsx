import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'

type Peer = { user_id: number; full_name: string; role: 'student' | 'teacher' }
type Message = { id: number; sender_user_id: number; text_content?: string | null; created_at: string; is_own: number }

export function ChatPage() {
  const { session } = useAuth(); const userId = getMaxUserId(); const [peers, setPeers] = useState<Peer[]>([]); const [peer, setPeer] = useState<number | null>(null); const [messages, setMessages] = useState<Message[]>([]); const [text, setText] = useState(''); const [error, setError] = useState('')
  const loadMessages = (recipient: number) => userId && api.get('/chats/messages', { params: { max_user_id: userId, peer_user_id: recipient } }).then((r) => setMessages(r.data?.data?.messages || [])).catch(() => setError('Не удалось загрузить сообщения.'))
  useEffect(() => { if (userId && session?.role) void api.get('/chats/students', { params: { max_user_id: userId } }).then((r) => { const list = r.data?.data?.students || []; setPeers(list); if (list[0]) { setPeer(list[0].user_id); void loadMessages(list[0].user_id) } }).catch(() => setError('Не удалось загрузить список собеседников.')) }, [session?.role, userId])
  const send = async (event: FormEvent) => { event.preventDefault(); if (!userId || !peer || !text.trim()) return; try { await api.post('/chats/messages', { max_user_id: userId, recipient_user_id: peer, text: text.trim() }); setText(''); void loadMessages(peer) } catch { setError('Не удалось отправить сообщение.') } }
  return <section><div className="section-heading"><div><span className="eyebrow">Учебная связь</span><h2>Чат</h2></div></div>{error && <p className="error">{error}</p>}{peers.length > 0 && <label className="search-field">Собеседник<select value={peer || ''} onChange={(event) => { const next = Number(event.target.value); setPeer(next); void loadMessages(next) }}>{peers.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name}</option>)}</select></label>}<div className="chat-list">{messages.map((message) => <article className={message.is_own ? 'chat-message own' : 'chat-message'} key={message.id}><p>{message.text_content}</p><small>{message.created_at}</small></article>)}{!messages.length && <p className="muted">Сообщений пока нет.</p>}</div>{peer && <form className="inline-form" onSubmit={send}><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Напишите сообщение" required /><button className="button" type="submit">Отправить</button></form>}</section>
}
