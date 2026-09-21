import { FormEvent, useState } from 'react'
import { api } from '../api/client'
import { Notice } from '../components/UiState'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'

type Mode = 'student' | 'teacher'

export function OnboardingPage() {
  const { reload } = useAuth()
  const maxUserId = getMaxUserId()
  const [mode, setMode] = useState<Mode>('student')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [metro, setMetro] = useState('')
  const [lessons, setLessons] = useState('15')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!maxUserId) return
    if (busy) return
    setBusy(true); setMessage(''); setError('')
    try {
      if (mode === 'student') {
        await api.post('/students', { max_user_id: maxUserId, full_name: fullName.trim(), phone: phone.trim(), metro: metro.trim(), lessons_count: Number(lessons) })
        await reload()
      } else {
        await api.post('/teacher-application', { max_user_id: maxUserId, full_name: fullName.trim(), phone: phone.trim() })
        setMessage('Заявка отправлена. Администратор увидит её в очереди и сообщит о решении.')
      }
    } catch { setError('Не удалось отправить данные. Проверьте поля или вернитесь позже — возможно, заявка уже создана.') }
    finally { setBusy(false) }
  }

  return <section className="onboarding fi">
    <div className="hero-card">
      <span className="eyebrow">Добро пожаловать в MADCAP</span>
      <h2>Выберите свой путь</h2>
      <p>Зарегистрируйтесь как ученик или отправьте заявку на роль преподавателя.</p>
    </div>
    <div className="segmented" role="tablist" aria-label="Выбор роли">
      <button type="button" role="tab" aria-selected={mode === 'student'} className={mode === 'student' ? 'active' : ''} onClick={() => { setMode('student'); setMessage(''); setError('') }}>Я ученик</button>
      <button type="button" role="tab" aria-selected={mode === 'teacher'} className={mode === 'teacher' ? 'active' : ''} onClick={() => { setMode('teacher'); setMessage(''); setError('') }}>Я преподаватель</button>
    </div>
    <form className="tool-form" onSubmit={submit}>
      <div><span className="eyebrow">{mode === 'student' ? 'Регистрация' : 'Заявка'}</span><h3>{mode === 'student' ? 'Начать обучение' : 'Стать преподавателем'}</h3></div>
      <label>Имя и фамилия<input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} required autoComplete="name" /></label>
      <label>Телефон<input value={phone} onChange={(event) => setPhone(event.target.value)} minLength={7} required inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" /></label>
      {mode === 'student' && <><label>Ближайшее метро<input value={metro} onChange={(event) => setMetro(event.target.value)} placeholder="Например, Тверская" /></label><label>Количество уроков<select value={lessons} onChange={(event) => setLessons(event.target.value)}><option value="5">5 уроков</option><option value="10">10 уроков</option><option value="15">15 уроков</option><option value="20">20 уроков</option></select></label></>}
      {message && <Notice kind="success">{message}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <button className="button primary btn-w" type="submit" disabled={busy}>{busy ? 'Отправляем…' : mode === 'student' ? 'Создать профиль' : 'Отправить заявку'}</button>
    </form>
  </section>
}
