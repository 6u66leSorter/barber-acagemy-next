import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { getMaxUserId } from '../platform/max'

type Homework = { id: number; haircut_name?: string | null; text_content?: string | null; file_id?: string | null; status: string; lesson_number?: number | null }
type Comment = { id: number; text_content: string; author_role: string; first_name?: string | null; last_name?: string | null }
const safeImages = new Set(['demo-homework-crop.png', 'demo-homework-fade.png', 'demo-homework-beard.png'])

export function HomeworkDetailPage() {
  const { id } = useParams(); const maxUserId = getMaxUserId(); const [homework, setHomework] = useState<Homework | null>(null); const [comments, setComments] = useState<Comment[]>([]); const [text, setText] = useState(''); const [title, setTitle] = useState(''); const [message, setMessage] = useState('')
  const load = async () => { if (!id || !maxUserId) return; const response = await api.get(`/homeworks/${id}`, { params: { max_user_id: maxUserId } }); const data = response.data?.data; setHomework(data?.homework || null); setComments(data?.comments || []); setTitle(data?.homework?.haircut_name || ''); setText(data?.homework?.text_content || '') }
  useEffect(() => { void load() }, [id, maxUserId])
  const save = async (event: FormEvent) => { event.preventDefault(); if (!id || !maxUserId) return; await api.patch(`/student/homeworks/${id}`, { max_user_id: maxUserId, haircut_name: title, text_content: text }); setMessage('Изменения сохранены.'); void load() }
  if (!homework) return <p className="state-message">Загружаем работу…</p>
  return <section><div className="section-heading"><div><span className="eyebrow">Урок {homework.lesson_number || 'бонус'}</span><h2>{homework.haircut_name || 'Домашнее задание'}</h2></div></div>{homework.file_id && safeImages.has(homework.file_id) && <img className="detail-photo" src={`/${homework.file_id}`} alt={homework.haircut_name || 'Работа'} />}<p className="muted">Статус: {homework.status}</p><form className="tool-form" onSubmit={save}><label>Название<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Описание<textarea value={text} onChange={(event) => setText(event.target.value)} required /></label><button className="button" type="submit">Сохранить изменения</button></form>{message && <p className="success">{message}</p>}<h3>Комментарии</h3><div className="student-list">{comments.map((comment) => <article className="student-row" key={comment.id}><strong>{comment.author_role === 'teacher' ? 'Преподаватель' : 'Ученик'}</strong><p>{comment.text_content}</p></article>)}{!comments.length && <p className="muted">Комментариев пока нет.</p>}</div></section>
}
