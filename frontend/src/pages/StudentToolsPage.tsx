import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import { Notice } from '../components/UiState'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'

type Action = 'homework' | 'about' | 'avatar' | 'profile' | 'feedback'

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

export function StudentToolsPage() {
  const { session, reload } = useAuth()
  const maxUserId = getMaxUserId()
  const profile = (session?.student || session?.teacher || {}) as Record<string, unknown>
  const [lesson, setLesson] = useState('1')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [workFile, setWorkFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [about, setAbout] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [metro, setMetro] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<Action | null>(null)
  const [feedbackSubject, setFeedbackSubject] = useState('academy')
  const [feedbackText, setFeedbackText] = useState('')

  useEffect(() => {
    setAbout(String(profile.about_me || ''))
    setFullName(String(profile.full_name || ''))
    setPhone(String(profile.phone || ''))
    setMetro(String(profile.metro || ''))
  }, [session])

  useEffect(() => {
    if (!workFile || !workFile.type.startsWith('image/')) { setPreview(''); return }
    const url = URL.createObjectURL(workFile)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [workFile])

  if (!maxUserId || !session?.role) return null

  const startAction = (action: Action) => { setBusy(action); setError(''); setMessage('') }
  const uploadHomeworkFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const response = await api.post('/files/homework', form, { params: { max_user_id: maxUserId }, headers: { 'Content-Type': 'multipart/form-data' } })
    return response.data?.data as { file_id: string; content_type?: string }
  }

  const submitHomework = async (event: FormEvent) => {
    event.preventDefault()
    if (!workFile || busy) { if (!workFile) setError('Выберите фото, видео или PDF с работой.'); return }
    startAction('homework')
    try {
      const uploaded = await uploadHomeworkFile(workFile)
      await api.post('/homeworks', { max_user_id: maxUserId, lesson_number: Number(lesson), content_type: uploaded.content_type || 'photo', file_id: uploaded.file_id, haircut_name: title.trim(), text_content: description.trim() })
      setTitle(''); setDescription(''); setWorkFile(null)
      setMessage('Работа отправлена преподавателю. Она появилась в разделе «Работы».')
    } catch { setError('Не удалось загрузить работу. Проверьте формат, размер файла и соединение.') }
    finally { setBusy(null) }
  }

  const saveAbout = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; startAction('about')
    try {
      await api.post(session.role === 'teacher' ? '/teacher/about' : '/student/about', { max_user_id: maxUserId, about_me: about.trim() })
      await reload(); setMessage('Описание профиля сохранено.')
    } catch { setError('Не удалось сохранить описание.') }
    finally { setBusy(null) }
  }

  const requestProfileEdit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; startAction('profile')
    try {
      await api.post('/student/profile-edit', { max_user_id: maxUserId, full_name: fullName.trim(), phone: phone.trim(), metro: metro.trim() })
      setMessage('Заявка отправлена администратору. Данные изменятся после согласования.')
    } catch { setError('Не удалось отправить изменения. Возможно, заявка уже ожидает проверки.') }
    finally { setBusy(null) }
  }

  const uploadAvatar = async (event: FormEvent) => {
    event.preventDefault(); if (!avatar || busy) return; startAction('avatar')
    const form = new FormData(); form.append('file', avatar)
    try {
      await api.post('/student/me/avatar', form, { params: { max_user_id: maxUserId }, headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage('Фотография профиля обновлена.'); setAvatar(null); await reload()
    } catch { setError('Не удалось загрузить фотографию. Используйте JPG, PNG или WEBP допустимого размера.') }
    finally { setBusy(null) }
  }

  const sendFeedback = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; startAction('feedback')
    try {
      await api.post('/student/feedback', { max_user_id: maxUserId, subject: feedbackSubject, message: feedbackText.trim() })
      setFeedbackText(''); setMessage('Спасибо! Обратная связь отправлена администратору.')
    } catch { setError('Не удалось отправить обратную связь.') }
    finally { setBusy(null) }
  }

  const chooseWorkFile = (event: ChangeEvent<HTMLInputElement>) => setWorkFile(event.target.files?.[0] || null)

  return <section className="fi">
    <div className="section-heading"><div><span className="eyebrow">Личный кабинет</span><h2>{session.role === 'teacher' ? 'Профиль преподавателя' : 'Профиль и обучение'}</h2><p className="muted">{session.role === 'teacher' ? 'Настройте описание, которое видят ученики' : 'Добавляйте работы и управляйте публичным профилем'}</p></div></div>
    {message && <Notice kind="success">{message}</Notice>}
    {error && <Notice kind="error">{error}</Notice>}

    {session.role === 'student' && <form className="tool-form feature-form" onSubmit={submitHomework}>
      <div className="form-title"><span className="form-icon" aria-hidden="true">＋</span><div><h3>Новая работа</h3><p>Загрузите результат урока для проверки</p></div></div>
      <div className="form-grid"><label>Номер урока<input type="number" min="1" max="1000" value={lesson} onChange={(event) => setLesson(event.target.value)} required /></label><label>Название работы<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, текстурный crop" required maxLength={200} /></label></div>
      <label>Комментарий<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что получилось и что вызвало сложности" maxLength={4000} /></label>
      <label className="file-picker"><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf" onChange={chooseWorkFile} /><span className="file-picker-icon" aria-hidden="true">↑</span><span><strong>{workFile ? workFile.name : 'Выбрать файл'}</strong><small>{workFile ? `${workFile.type || 'файл'} · ${formatFileSize(workFile.size)}` : 'JPG, PNG, WEBP, MP4, MOV или PDF'}</small></span></label>
      {preview && <img className="upload-preview" src={preview} alt="Предпросмотр выбранной работы" />}
      {workFile && !preview && <p className="selected-file" role="status">Файл готов к отправке: {workFile.name}</p>}
      <button className="button primary" disabled={busy !== null || !workFile} type="submit">{busy === 'homework' ? 'Загружаем…' : 'Отправить на проверку'}</button>
    </form>}

    <form className="tool-form" onSubmit={saveAbout}>
      <div className="form-title"><span className="form-icon" aria-hidden="true">◎</span><div><h3>О себе</h3><p>{session.role === 'student' ? 'Текст увидят посетители портфолио' : 'Текст увидят ваши ученики'}</p></div></div>
      <label>Описание<textarea value={about} onChange={(event) => setAbout(event.target.value)} placeholder="Расскажите о себе, подходе и опыте" maxLength={4000} /><small className="field-counter">{about.length}/4000</small></label>
      <button className="button" disabled={busy !== null} type="submit">{busy === 'about' ? 'Сохраняем…' : 'Сохранить описание'}</button>
    </form>

    {session.role === 'student' && <>
      <form className="tool-form" onSubmit={uploadAvatar}><div className="form-title"><span className="form-icon" aria-hidden="true">◉</span><div><h3>Фотография профиля</h3><p>Отображается в публичном портфолио</p></div></div><label className="file-picker compact"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] || null)} /><span className="file-picker-icon" aria-hidden="true">↑</span><span><strong>{avatar ? avatar.name : 'Выбрать фотографию'}</strong><small>JPG, PNG или WEBP</small></span></label><button className="button" disabled={!avatar || busy !== null} type="submit">{busy === 'avatar' ? 'Загружаем…' : 'Обновить фотографию'}</button></form>
      <form className="tool-form" onSubmit={requestProfileEdit}><div className="form-title"><span className="form-icon" aria-hidden="true">✎</span><div><h3>Личные данные</h3><p>Изменения проверит администратор</p></div></div><label>Имя и фамилия<input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} autoComplete="name" /></label><label>Телефон<input value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={7} inputMode="tel" autoComplete="tel" /></label><label>Ближайшее метро<input value={metro} onChange={(event) => setMetro(event.target.value)} /></label><button className="button" disabled={busy !== null} type="submit">{busy === 'profile' ? 'Отправляем…' : 'Отправить на согласование'}</button></form>
      <form className="tool-form" onSubmit={sendFeedback}><div className="form-title"><span className="form-icon" aria-hidden="true">♡</span><div><h3>Обратная связь</h3><p>Сообщение увидит администрация академии</p></div></div><label>Тема<select value={feedbackSubject} onChange={(event) => setFeedbackSubject(event.target.value)}><option value="academy">Об академии</option><option value="teacher">О преподавателе</option><option value="other">Другое</option></select></label><label>Сообщение<textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Расскажите, что можно улучшить" required minLength={3} maxLength={4000} /></label><button className="button" disabled={busy !== null || !feedbackText.trim()} type="submit">{busy === 'feedback' ? 'Отправляем…' : 'Отправить обратную связь'}</button></form>
    </>}
  </section>
}
