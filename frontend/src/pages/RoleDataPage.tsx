import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { ApiImage } from '../components/ApiImage'
import { Notice, PageState } from '../components/UiState'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'

type Homework = {
  id: number
  lesson_number?: number | null
  haircut_name?: string | null
  content_type: string
  file_id?: string | null
  file_url?: string | null
  text_content?: string | null
  status: string
  student_name?: string
  rating?: number | null
  comment?: string | null
}

type Student = { id: number; full_name: string; pending_count?: number; about_me?: string | null; status?: string }
type Filter = 'all' | 'pending' | 'approved' | 'revision'

const imageFiles = new Set(['demo-homework-crop.png', 'demo-homework-fade.png', 'demo-homework-beard.png', 'demo-student-barber.png', 'demo-teacher-barber.png'])
const statusLabels: Record<string, string> = { pending: 'На проверке', approved: 'Одобрено', revision: 'На доработке', rejected: 'Отклонено' }
const studentStatusLabels: Record<string, string> = { moderation: 'На модерации', studying: 'Обучается', completed: 'Завершил обучение', rejected: 'Отклонён' }

function assetUrl(homework: Homework) {
  if (homework.file_url) return homework.file_url
  return homework.file_id && imageFiles.has(homework.file_id) ? `/${homework.file_id}` : null
}

function HomeworkCard({ homework, actions }: { homework: Homework; actions?: ReactNode }) {
  const image = assetUrl(homework)
  return <article className="homework-card">
    <ApiImage src={image} apiPath={!image && homework.file_id ? `/homeworks/${homework.id}/file` : null} alt={homework.haircut_name || 'Учебная работа'} fallback={<div className="media-placeholder homework-media-placeholder">Предпросмотр недоступен</div>} />
    <div className="homework-card-body">
      <div className="card-meta"><span>Урок {homework.lesson_number || 'бонус'}</span><span className={`status status-${homework.status}`}>{statusLabels[homework.status] || homework.status}</span></div>
      <h3>{homework.haircut_name || 'Учебная работа'}</h3>
      {homework.student_name && <p className="muted">Ученик: {homework.student_name}</p>}
      {homework.text_content && <p>{homework.text_content}</p>}
      {homework.rating && <p className="rating" aria-label={`Оценка ${homework.rating} из 5`}>{'★'.repeat(homework.rating)}{'☆'.repeat(5 - homework.rating)}</p>}
      {homework.comment && <p className="review">{homework.comment}</p>}
      {actions}
    </div>
  </article>
}

function FilterBar({ value, onChange, homeworks }: { value: Filter; onChange: (value: Filter) => void; homeworks: Homework[] }) {
  const count = (filter: Filter) => filter === 'all' ? homeworks.length : homeworks.filter((item) => item.status === filter).length
  const labels: Array<[Filter, string]> = [['all', 'Все'], ['pending', 'На проверке'], ['approved', 'Одобрены'], ['revision', 'Доработка']]
  return <div className="filter-bar" aria-label="Фильтр работ">{labels.map(([key, label]) => <button type="button" key={key} className={value === key ? 'active' : ''} aria-pressed={value === key} onClick={() => onChange(key)}>{label}<span>{count(key)}</span></button>)}</div>
}

function StudentData({ maxUserId }: { maxUserId: number }) {
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [comment, setComment] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get('/student/homeworks', { params: { max_user_id: maxUserId } })
      setHomeworks(response.data?.data?.homeworks || []); setError('')
    } catch { setError('Не удалось загрузить работы. Проверьте соединение с сервером.') }
    finally { setLoading(false) }
  }, [maxUserId])

  useEffect(() => { void load() }, [load])

  const sendComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !comment.trim() || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api.post(`/homeworks/${selected}/comments`, { max_user_id: maxUserId, text: comment.trim() })
      setComment(''); setSelected(null); setMessage('Комментарий сохранён.'); await load()
    } catch { setError('Не удалось сохранить комментарий. Текст оставлен в форме — повторите попытку.') }
    finally { setBusy(false) }
  }

  const visible = filter === 'all' ? homeworks : homeworks.filter((item) => item.status === filter)

  return <section className="fi">
    <div className="section-heading"><div><span className="eyebrow">Кабинет ученика</span><h2>Мои работы</h2><p className="muted">История заданий, оценки и обратная связь</p></div><span className="count-badge">{homeworks.length}</span></div>
    {message && <Notice kind="success">{message}</Notice>}{error && <Notice kind="error">{error}</Notice>}
    <FilterBar value={filter} onChange={setFilter} homeworks={homeworks} />
    {loading ? <PageState>Загружаем работы…</PageState> : <div className="homework-grid">{visible.map((homework) => <HomeworkCard key={homework.id} homework={homework} actions={<>
      {selected === homework.id ? <form className="inline-form embedded-form" onSubmit={sendComment}><label>Комментарий к работе<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Напишите преподавателю" required autoFocus maxLength={4000} /></label><div className="action-row"><button className="button primary" disabled={busy || !comment.trim()} type="submit">{busy ? 'Сохраняем…' : 'Отправить'}</button><button className="button quiet" disabled={busy} type="button" onClick={() => { setSelected(null); setComment('') }}>Отмена</button></div></form> : <div className="action-row card-actions"><Link className="button" to={`/homeworks/${homework.id}`}>Открыть работу</Link><button type="button" className="text-button" onClick={() => setSelected(homework.id)}>Комментарий</button></div>}
    </>} />)}{!visible.length && <PageState kind="empty" action={homeworks.length === 0 ? <Link className="button primary" to="/tools">Добавить первую работу</Link> : undefined}>{homeworks.length === 0 ? 'Работ пока нет. Загрузите результат первого урока.' : 'В этой категории работ пока нет.'}</PageState>}</div>}
  </section>
}

function TeacherData({ maxUserId }: { maxUserId: number }) {
  const [students, setStudents] = useState<Student[]>([])
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reviewTarget, setReviewTarget] = useState<number | null>(null)
  const [rating, setRating] = useState('5')
  const [reviewComment, setReviewComment] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingWorks, setLoadingWorks] = useState(false)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    setLoadingStudents(true)
    void api.get('/teacher/students', { params: { max_user_id: maxUserId } }).then((response) => {
      const items = response.data?.data?.students || []
      setStudents(items)
      if (items[0]) setSelectedStudent((current) => current || items[0].id)
    }).catch(() => setError('Не удалось загрузить учеников.')).finally(() => setLoadingStudents(false))
  }, [maxUserId])

  const loadHomeworks = useCallback(async (studentId: number) => {
    setLoadingWorks(true)
    try {
      const response = await api.get('/teacher/student-homeworks', { params: { max_user_id: maxUserId, student_id: studentId } })
      setHomeworks(response.data?.data?.homeworks || []); setError('')
    } catch { setError('Не удалось загрузить работы ученика.') }
    finally { setLoadingWorks(false) }
  }, [maxUserId])

  useEffect(() => { if (selectedStudent) void loadHomeworks(selectedStudent) }, [loadHomeworks, selectedStudent])

  const review = async (event: FormEvent, status: 'approved' | 'rejected') => {
    event.preventDefault()
    if (!reviewTarget || busy) return
    const numericRating = Number(rating)
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) { setError('Оценка должна быть от 1 до 5.'); return }
    if (!reviewComment.trim()) { setError('Добавьте отзыв или рекомендации ученику.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      await api.post('/teacher/review', { max_user_id: maxUserId, homework_id: reviewTarget, status, rating: numericRating, comment: reviewComment.trim() })
      setMessage(status === 'approved' ? 'Работа одобрена, оценка сохранена.' : 'Работа отправлена ученику на доработку.')
      setReviewTarget(null); setReviewComment('')
      if (selectedStudent) await loadHomeworks(selectedStudent)
    } catch { setError('Не удалось сохранить проверку. Проверьте доступ и попробуйте ещё раз.') }
    finally { setBusy(false) }
  }

  const visibleStudents = useMemo(() => students.filter((student) => student.full_name.toLocaleLowerCase('ru').includes(studentQuery.trim().toLocaleLowerCase('ru'))), [students, studentQuery])
  const visibleHomeworks = filter === 'all' ? homeworks : homeworks.filter((item) => item.status === filter)
  const currentStudent = students.find((student) => student.id === selectedStudent)

  return <section className="fi">
    <div className="section-heading"><div><span className="eyebrow">Кабинет преподавателя</span><h2>Проверка работ</h2><p className="muted">Выберите ученика и откройте нужную работу</p></div></div>
    {message && <Notice kind="success">{message}</Notice>}{error && <Notice kind="error">{error}</Notice>}
    <label className="search-field"><span>Поиск ученика</span><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Имя или фамилия" type="search" /></label>
    {loadingStudents ? <PageState>Загружаем учеников…</PageState> : <div className="student-tabs" aria-label="Выбор ученика">{visibleStudents.map((student) => <button type="button" className={selectedStudent === student.id ? 'student-tab active' : 'student-tab'} aria-pressed={selectedStudent === student.id} key={student.id} onClick={() => { setSelectedStudent(student.id); setReviewTarget(null) }}><strong>{student.full_name}</strong><small>{student.pending_count || 0} на проверке</small></button>)}{!visibleStudents.length && <PageState kind="empty">Ученики не найдены.</PageState>}</div>}
    {currentStudent && <div className="selected-student"><div><span className="eyebrow">Выбран ученик</span><strong>{currentStudent.full_name}</strong></div><span>{homeworks.length} работ</span></div>}
    <FilterBar value={filter} onChange={setFilter} homeworks={homeworks} />
    {loadingWorks ? <PageState>Загружаем работы ученика…</PageState> : <div className="homework-grid">{visibleHomeworks.map((homework) => <HomeworkCard key={homework.id} homework={homework} actions={<>
      {homework.status === 'pending' && (reviewTarget === homework.id ? <form className="review-form embedded-form" onSubmit={(event) => void review(event, 'approved')}><fieldset className="rating-fieldset"><legend>Оценка от 1 до 5</legend><div className="rating-buttons">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={Number(rating) === value ? 'active' : ''} aria-pressed={Number(rating) === value} aria-label={`${value} из 5`} onClick={() => setRating(String(value))}>★</button>)}</div></fieldset><label>Отзыв преподавателя<textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Что получилось и что улучшить" required autoFocus maxLength={4000} /></label><div className="action-row"><button className="button primary" disabled={busy} type="submit">{busy ? 'Сохраняем…' : 'Одобрить'}</button><button className="button danger" disabled={busy} type="button" onClick={(event) => void review(event, 'rejected')}>На доработку</button><button className="button quiet" disabled={busy} type="button" onClick={() => { setReviewTarget(null); setReviewComment('') }}>Отмена</button></div></form> : <div className="action-row card-actions"><button type="button" className="button primary" onClick={() => { setReviewTarget(homework.id); setRating('5'); setReviewComment('') }}>Проверить работу</button><Link className="text-button" to={`/homeworks/${homework.id}`}>Открыть</Link></div>)}
      {homework.status !== 'pending' && <div className="card-actions"><Link className="button" to={`/homeworks/${homework.id}`}>Открыть работу</Link></div>}
    </>} />)}{selectedStudent && !visibleHomeworks.length && <PageState kind="empty">У выбранного ученика нет работ в этой категории.</PageState>}</div>}
  </section>
}

function AdminData({ maxUserId }: { maxUserId: number }) {
  const [students, setStudents] = useState<Student[]>([])
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [teachers, setTeachers] = useState<{ id: number; full_name: string }[]>([])
  const [applications, setApplications] = useState<{ id: number; full_name: string; phone: string; status: string }[]>([])
  const [edits, setEdits] = useState<{ id: number; full_name: string; new_full_name: string; new_phone: string; status: string }[]>([])
  const [feedback, setFeedback] = useState<{ id: number; full_name: string; subject: string; message: string }[]>([])
  const [studentQuery, setStudentQuery] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsResponse, homeworksResponse, teachersResponse, applicationsResponse, editsResponse, feedbackResponse] = await Promise.all([
        api.get('/admin/students', { params: { max_user_id: maxUserId } }),
        api.get('/admin/homeworks', { params: { max_user_id: maxUserId } }),
        api.get('/admin/teachers', { params: { max_user_id: maxUserId } }),
        api.get('/admin/teacher-applications', { params: { max_user_id: maxUserId } }),
        api.get('/admin/profile-edits', { params: { max_user_id: maxUserId } }),
        api.get('/admin/feedback', { params: { max_user_id: maxUserId } }),
      ])
      setStudents(studentsResponse.data?.data?.students || []); setHomeworks(homeworksResponse.data?.data?.homeworks || []); setTeachers(teachersResponse.data?.data?.teachers || []); setApplications(applicationsResponse.data?.data?.applications || []); setEdits(editsResponse.data?.data?.edits || []); setFeedback(feedbackResponse.data?.data?.feedback || []); setError('')
    } catch { setError('Не удалось загрузить административную сводку.') }
    finally { setLoading(false) }
  }, [maxUserId])

  useEffect(() => { void load() }, [load])

  const action = async (path: string, body: Record<string, unknown>, key: string) => {
    if (busyId) return
    setBusyId(key); setMessage(''); setError('')
    try { await api.post(path, { max_user_id: maxUserId, ...body }); setMessage('Изменение сохранено.'); await load() }
    catch { setError('Не удалось выполнить операцию. Проверьте данные и повторите попытку.') }
    finally { setBusyId(null) }
  }

  const visibleStudents = students.filter((student) => student.full_name.toLocaleLowerCase('ru').includes(studentQuery.trim().toLocaleLowerCase('ru')))
  const pendingApplications = applications.filter((item) => item.status === 'pending')
  const pendingEdits = edits.filter((item) => item.status === 'pending')

  return <section className="fi">
    <div className="section-heading"><div><span className="eyebrow">Панель администратора</span><h2>Учебная статистика</h2><p className="muted">Сводка, заявки и последние работы</p></div></div>
    {message && <Notice kind="success">{message}</Notice>}{error && <Notice kind="error">{error}</Notice>}
    {loading ? <PageState>Загружаем данные академии…</PageState> : <>
      <div className="stats-grid"><div className="stat-card"><strong>{students.length}</strong><span>учеников</span></div><div className="stat-card"><strong>{teachers.length}</strong><span>преподавателей</span></div><div className="stat-card"><strong>{homeworks.filter((homework) => homework.status === 'pending').length}</strong><span>работ на проверке</span></div></div>
      <div className="admin-queue-summary"><span><strong>{pendingApplications.length}</strong> заявок преподавателей</span><span><strong>{pendingEdits.length}</strong> правок профиля</span><Link className="button" to="/admin">Полное управление</Link></div>
      <div className="section-heading compact"><div><span className="eyebrow">База академии</span><h3>Ученики</h3></div></div>
      <label className="search-field"><span>Поиск по имени или фамилии</span><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Например, Анна" type="search" /></label>
      <div className="student-list">{visibleStudents.map((student) => <article className="student-row" key={student.id}><strong>{student.full_name}</strong><span>{studentStatusLabels[student.status || ''] || student.status || 'Статус не указан'}</span>{student.about_me && <p>{student.about_me}</p>}</article>)}{!visibleStudents.length && <PageState kind="empty">Ученики не найдены.</PageState>}</div>

      <div className="section-heading compact"><div><span className="eyebrow">Очередь</span><h3>Заявки преподавателей</h3></div><span className="count-badge">{pendingApplications.length}</span></div>
      <div className="student-list">{pendingApplications.map((item) => <article className="student-row" key={item.id}><strong>{item.full_name}</strong><p>{item.phone}</p><div className="action-row"><button className="button primary" disabled={busyId !== null} type="button" onClick={() => void action('/admin/teacher-applications/review', { id: item.id, status: 'approved' }, `application-${item.id}`)}>{busyId === `application-${item.id}` ? 'Сохраняем…' : 'Одобрить'}</button><button className="button danger" disabled={busyId !== null} type="button" onClick={() => { if (window.confirm(`Отклонить заявку ${item.full_name}?`)) void action('/admin/teacher-applications/review', { id: item.id, status: 'rejected' }, `application-${item.id}`) }}>Отклонить</button></div></article>)}{!pendingApplications.length && <PageState kind="empty">Новых заявок нет.</PageState>}</div>

      <div className="section-heading compact"><div><span className="eyebrow">Согласование</span><h3>Изменения профилей</h3></div><span className="count-badge">{pendingEdits.length}</span></div>
      <div className="student-list">{pendingEdits.map((item) => <article className="student-row" key={item.id}><strong>{item.full_name}</strong><p>Новые данные: {item.new_full_name}, {item.new_phone}</p><div className="action-row"><button className="button primary" disabled={busyId !== null} type="button" onClick={() => void action('/admin/profile-edits/review', { id: item.id, status: 'approved' }, `edit-${item.id}`)}>Применить</button><button className="button danger" disabled={busyId !== null} type="button" onClick={() => { if (window.confirm(`Отклонить изменения профиля ${item.full_name}?`)) void action('/admin/profile-edits/review', { id: item.id, status: 'rejected', comment: 'Отклонено администратором' }, `edit-${item.id}`) }}>Отклонить</button></div></article>)}{!pendingEdits.length && <PageState kind="empty">Изменений на согласовании нет.</PageState>}</div>

      <div className="section-heading compact"><div><span className="eyebrow">Голос учеников</span><h3>Обратная связь</h3></div></div>
      <div className="student-list">{feedback.slice(0, 5).map((item) => <article className="student-row" key={item.id}><strong>{item.full_name}</strong><span>{item.subject === 'academy' ? 'Об академии' : item.subject === 'teacher' ? 'О преподавателе' : 'Другое'}</span><p>{item.message}</p></article>)}{!feedback.length && <PageState kind="empty">Обратной связи пока нет.</PageState>}</div>

      <div className="section-heading compact"><div><span className="eyebrow">Обучение</span><h3>Последние работы</h3></div></div>
      <div className="homework-grid">{homeworks.slice(0, 6).map((homework) => <HomeworkCard key={homework.id} homework={homework} />)}{!homeworks.length && <PageState kind="empty">Работ пока нет.</PageState>}</div>
    </>}
  </section>
}

export function RoleDataPage() {
  const { session } = useAuth()
  const maxUserId = getMaxUserId()
  if (!session?.role || !maxUserId) return <PageState kind="error">Сначала войдите в MAX или выберите демо-роль.</PageState>
  if (session.role === 'student') return <StudentData maxUserId={maxUserId} />
  if (session.role === 'teacher') return <TeacherData maxUserId={maxUserId} />
  return <AdminData maxUserId={maxUserId} />
}
