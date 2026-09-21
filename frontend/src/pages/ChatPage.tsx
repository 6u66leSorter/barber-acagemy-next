import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { Notice, PageState } from '../components/UiState'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'

type Peer = { user_id: number; full_name: string; role: 'student' | 'teacher' }
type Message = { id: number; sender_user_id: number; text_content?: string | null; created_at: string; is_own: number }

export function ChatPage() {
  const { session } = useAuth()
  const userId = getMaxUserId()
  const [peers, setPeers] = useState<Peer[]>([])
  const [peer, setPeer] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (recipient: number, quiet = false) => {
    if (!userId) return
    if (!quiet) setLoading(true)
    try {
      const response = await api.get('/chats/messages', { params: { max_user_id: userId, peer_user_id: recipient } })
      setMessages(response.data?.data?.messages || [])
      setError('')
    } catch {
      if (!quiet) setError('Не удалось загрузить сообщения. Проверьте соединение и попробуйте ещё раз.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId || !session?.role) return
    let cancelled = false
    setLoading(true)
    void api.get('/chats/students', { params: { max_user_id: userId } }).then((response) => {
      if (cancelled) return
      const list: Peer[] = response.data?.data?.students || []
      setPeers(list)
      const firstPeer = list[0]?.user_id || null
      setPeer(firstPeer)
      if (firstPeer) void loadMessages(firstPeer)
      else setLoading(false)
    }).catch(() => {
      if (!cancelled) {
        setError('Не удалось загрузить список собеседников. Повторите попытку позже.')
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [loadMessages, session?.role, userId])

  useEffect(() => {
    if (!peer) return
    const timer = window.setInterval(() => void loadMessages(peer, true), 15000)
    return () => window.clearInterval(timer)
  }, [loadMessages, peer])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!userId || !peer || !text.trim() || sending) return
    setSending(true)
    setError('')
    try {
      await api.post('/chats/messages', { max_user_id: userId, recipient_user_id: peer, text: text.trim() })
      setText('')
      await loadMessages(peer, true)
    } catch {
      setError('Сообщение не отправлено. Текст сохранён — проверьте соединение и повторите попытку.')
    } finally {
      setSending(false)
    }
  }

  const activePeer = peers.find((item) => item.user_id === peer)

  return <section className="fi">
    <div className="section-heading"><div><span className="eyebrow">Учебная связь</span><h2>Чат</h2><p className="muted">Только ваши назначенные учебные контакты</p></div></div>
    {error && <Notice kind="error">{error}</Notice>}
    {peers.length > 0 && <label className="search-field">Собеседник<select value={peer || ''} onChange={(event) => { const next = Number(event.target.value); setPeer(next); setMessages([]); void loadMessages(next) }}>{peers.map((item) => <option key={item.user_id} value={item.user_id}>{item.full_name} · {item.role === 'teacher' ? 'преподаватель' : 'ученик'}</option>)}</select></label>}
    {loading ? <PageState>Загружаем диалог…</PageState> : !peers.length ? <PageState kind="empty">У вас пока нет доступных собеседников. Чат появится после назначения преподавателя или ученика.</PageState> : <>
      <div className="chat-caption" aria-live="polite"><strong>{activePeer?.full_name}</strong><span>Сообщения доступны только участникам обучения</span></div>
      <div className="chat-list" aria-label={`Переписка с ${activePeer?.full_name || 'собеседником'}`}>{messages.map((message) => <article className={message.is_own ? 'chat-message own' : 'chat-message'} key={message.id}><p>{message.text_content}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></article>)}{!messages.length && <PageState kind="empty">Начните диалог — сообщения появятся здесь.</PageState>}<div ref={endRef} /></div>
      <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Сообщение</label><textarea id="chat-message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Напишите сообщение…" maxLength={4000} required /><button className="button primary" disabled={sending || !text.trim()} type="submit">{sending ? 'Отправляем…' : 'Отправить'}</button></form>
    </>}
  </section>
}
