import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ApiImage } from '../components/ApiImage'
import { Notice, PageState } from '../components/UiState'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'

type Homework = {
  id: number
  haircut_name?: string | null
  text_content?: string | null
  file_id?: string | null
  file_url?: string | null
  status: string
  lesson_number?: number | null
  rating?: number | null
  comment?: string | null
}
type Comment = { id: number; text_content: string; author_role: string; first_name?: string | null; last_name?: string | null; created_at?: string }

const safeImages = new Set(['demo-homework-crop.png', 'demo-homework-fade.png', 'demo-homework-beard.png'])
const statusLabels: Record<string, string> = { pending: 'На проверке', approved: 'Одобрено', revision: 'Нужна доработка', rejected: 'Отклонено' }

export function HomeworkDetailPage() {
  const { session } = useAuth()
  const { id } = useParams()
  const maxUserId = getMaxUserId()
  const [homework, setHomework] = useState<Homework | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'save' | 'comment' | 'revision' | null>(null)
  const [commentText, setCommentText] = useState('')
  const [revisionText, setRevisionText] = useState('')
  const [revisionFile, setRevisionFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    if (!id || !maxUserId) return
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/homeworks/${id}`, { params: { max_user_id: maxUserId } })
      const data = response.data?.data
      setHomework(data?.homework || null)
      setComments(data?.comments || [])
      setTitle(data?.homework?.haircut_name || '')
      setText(data?.homework?.text_content || '')
    } catch {
      setError('Работа не найдена или у вас нет доступа к ней.')
    } finally {
      setLoading(false)
    }
  }, [id, maxUserId])

  useEffect(() => { void load() }, [load])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !maxUserId || busy) return
    setBusy('save'); setError(''); setMessage('')
    try {
      await api.patch(`/student/homeworks/${id}`, { max_user_id: maxUserId, haircut_name: title.trim(), text_content: text.trim() })
      setMessage('Изменения сохранены.')
      await load()
    } catch { setError('Не удалось сохранить изменения. Возможно, работа уже закрыта для редактирования.') }
    finally { setBusy(null) }
  }

  const addComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !commentText.trim() || busy) return
    setBusy('comment'); setError(''); setMessage('')
    try {
      await api.post(`/homeworks/${id}/comments`, { max_user_id: maxUserId, text: commentText.trim() })
      setCommentText('')
      setMessage('Комментарий добавлен.')
      await load()
    } catch { setError('Не удалось добавить комментарий. Попробуйте ещё раз.') }
    finally { setBusy(null) }
  }

  const submitRevision = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !revisionText.trim() || busy) return
    setBusy('revision'); setError(''); setMessage('')
    try {
      let fileId: string | undefined
      if (revisionFile) {
        const form = new FormData()
        form.append('file', revisionFile)
        const uploaded = await api.post('/files/revision', form, { params: { max_user_id: maxUserId }, headers: { 'Content-Type': 'multipart/form-data' } })
        fileId = uploaded.data?.data?.file_id
      }
      await api.post(`/student/homeworks/${id}/revision`, { max_user_id: maxUserId, text: revisionText.trim(), file_id: fileId })
      setRevisionText(''); setRevisionFile(null); setMessage('Исправленная работа отправлена преподавателю.')
      await load()
    } catch { setError('Не удалось отправить исправление. Проверьте формат файла и соединение.') }
    finally { setBusy(null) }
  }

  if (loading) return <PageState>Загружаем работу…</PageState>
  if (error && !homework) return <PageState kind="error" action={<Link className="button" to="/data">Вернуться к работам</Link>}>{error}</PageState>
  if (!homework) return <PageState kind="empty">Работа не найдена.</PageState>

  const image = homework.file_url || (homework.file_id && safeImages.has(homework.file_id) ? `/${homework.file_id}` : null)
  const studentCanEdit = session?.role === 'student' && (homework.status === 'pending' || homework.status === 'revision')

  return <section className="fi">
    <Link className="back-link" to="/data">← Все работы</Link>
    <div className="section-heading"><div><span className="eyebrow">Урок {homework.lesson_number || 'бонус'}</span><h2>{homework.haircut_name || 'Домашнее задание'}</h2></div><span className={`status status-${homework.status}`}>{statusLabels[homework.status] || homework.status}</span></div>
    <ApiImage className="detail-photo" src={image} apiPath={!image && homework.file_id ? `/homeworks/${homework.id}/file` : null} alt={homework.haircut_name || 'Работа'} fallback={<div className="media-placeholder detail-placeholder">Предпросмотр файла недоступен</div>} />
    {homework.rating ? <div className="review-summary"><span className="rating" aria-label={`Оценка ${homework.rating} из 5`}>{'★'.repeat(homework.rating)}{'☆'.repeat(5 - homework.rating)}</span>{homework.comment && <p>{homework.comment}</p>}</div> : null}
    {message && <Notice kind="success">{message}</Notice>}
    {error && <Notice kind="error">{error}</Notice>}

    {studentCanEdit && <form className="tool-form" onSubmit={save}><div className="form-title"><span className="form-icon" aria-hidden="true">✎</span><div><h3>Описание работы</h3><p>Можно изменить, пока работа не одобрена</p></div></div><label>Название<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} /></label><label>Описание<textarea value={text} onChange={(event) => setText(event.target.value)} required maxLength={4000} /></label><button className="button" disabled={busy !== null} type="submit">{busy === 'save' ? 'Сохраняем…' : 'Сохранить изменения'}</button></form>}

    <div className="section-heading compact"><div><span className="eyebrow">Обсуждение</span><h3>Комментарии</h3></div><span className="count-badge">{comments.length}</span></div>
    <div className="student-list comments-list">{comments.map((comment) => <article className="student-row comment-card" key={comment.id}><strong>{comment.author_role === 'teacher' ? 'Преподаватель' : comment.author_role === 'admin' ? 'Администратор' : 'Ученик'}</strong><p>{comment.text_content}</p>{comment.created_at && <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString('ru-RU')}</time>}</article>)}{!comments.length && <PageState kind="empty">Комментариев пока нет.</PageState>}</div>
    <form className="tool-form" onSubmit={addComment}><label>Новый комментарий<textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Напишите сообщение по этой работе" required maxLength={4000} /></label><button className="button" disabled={busy !== null || !commentText.trim()} type="submit">{busy === 'comment' ? 'Отправляем…' : 'Добавить комментарий'}</button></form>

    {session?.role === 'student' && homework.status === 'revision' && <form className="tool-form feature-form" onSubmit={submitRevision}><div className="form-title"><span className="form-icon" aria-hidden="true">↻</span><div><h3>Отправить доработку</h3><p>Опишите исправления и при необходимости приложите новый файл</p></div></div><label>Что исправлено<textarea value={revisionText} onChange={(event) => setRevisionText(event.target.value)} placeholder="Коротко расскажите об изменениях" required maxLength={4000} /></label><label className="file-picker compact"><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf" onChange={(event) => setRevisionFile(event.target.files?.[0] || null)} /><span className="file-picker-icon" aria-hidden="true">↑</span><span><strong>{revisionFile ? revisionFile.name : 'Приложить исправленный файл'}</strong><small>Фото, видео или PDF</small></span></label><button className="button primary" disabled={busy !== null} type="submit">{busy === 'revision' ? 'Отправляем…' : 'Отправить исправление'}</button></form>}
  </section>
}
