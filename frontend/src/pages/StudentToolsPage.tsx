import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'

const demoFiles = ['demo-homework-crop.png', 'demo-homework-fade.png', 'demo-homework-beard.png']

export function StudentToolsPage() {
  const { session, reload } = useAuth()
  const maxUserId = getMaxUserId()
  const [lesson, setLesson] = useState('1')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fileId, setFileId] = useState(demoFiles[0])
  const [about, setAbout] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [feedbackSubject, setFeedbackSubject] = useState('academy')
  const [feedbackText, setFeedbackText] = useState('')

  useEffect(() => { setAbout(String(session?.student?.about_me || session?.teacher?.about_me || '')) }, [session])
  if (!maxUserId || !session?.role) return null

  const submitHomework = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    try {
      await api.post('/homeworks', { max_user_id: maxUserId, lesson_number: Number(lesson), content_type: 'photo', file_id: fileId, haircut_name: title, text_content: description })
      setTitle(''); setDescription(''); setMessage('Работа отправлена на проверку.')
    } catch { setError('Не удалось отправить работу. Возможно, по этому уроку уже есть ДЗ на проверке.') }
  }

  const saveAbout = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    try {
      await api.post(session.role === 'teacher' ? '/teacher/about' : '/student/about', { max_user_id: maxUserId, about_me: about })
      await reload(); setMessage('Описание профиля сохранено.')
    } catch { setError('Не удалось сохранить описание.') }
  }
  const sendFeedback = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await api.post('/student/feedback', { max_user_id: maxUserId, subject: feedbackSubject, message: feedbackText }); setFeedbackText(''); setMessage('Обратная связь отправлена.') } catch { setError('Не удалось отправить обратную связь.') } }

  return <section>
    <div className="section-heading"><div><span className="eyebrow">Инструменты</span><h2>{session.role === 'teacher' ? 'Профиль преподавателя' : 'Профиль и новое ДЗ'}</h2></div></div>
    {message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}
    <form className="tool-form" onSubmit={saveAbout}><h3>О себе</h3><textarea value={about} onChange={(event) => setAbout(event.target.value)} placeholder="Расскажите о себе" maxLength={4000} /><button className="button" type="submit">Сохранить профиль</button></form>
    {session.role === 'student' && <form className="tool-form" onSubmit={sendFeedback}><h3>Обратная связь</h3><label>Тема<select value={feedbackSubject} onChange={(event) => setFeedbackSubject(event.target.value)}><option value="academy">Академия</option><option value="teacher">Преподаватель</option><option value="other">Другое</option></select></label><textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Ваше сообщение" required /><button className="button" type="submit">Отправить</button></form>}
    {session.role === 'student' && <form className="tool-form" onSubmit={submitHomework}><h3>Добавить домашнее задание</h3><label>Номер урока<input type="number" min="1" value={lesson} onChange={(event) => setLesson(event.target.value)} required /></label><label>Название работы<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, текстурный crop" required /></label><label>Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что было сделано" required /></label><label>Демонстрационное фото<select value={fileId} onChange={(event) => setFileId(event.target.value)}>{demoFiles.map((file) => <option key={file} value={file}>{file}</option>)}</select></label><img className="upload-preview" src={`/${fileId}`} alt="Предпросмотр работы" /><button className="button" type="submit">Отправить на проверку</button></form>}
  </section>
}
