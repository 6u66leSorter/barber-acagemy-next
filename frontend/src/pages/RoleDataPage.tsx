import { FormEvent, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'
import { ApiImage } from '../components/ApiImage'

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

const imageFiles = new Set(['demo-homework-crop.png', 'demo-homework-fade.png', 'demo-homework-beard.png', 'demo-student-barber.png', 'demo-teacher-barber.png'])
const statusLabels: Record<string, string> = { pending: 'На проверке', approved: 'Одобрено', revision: 'На доработке', rejected: 'Отклонено' }

function assetUrl(homework: Homework) {
  if (homework.file_url) return homework.file_url
  return homework.file_id && imageFiles.has(homework.file_id) ? `/${homework.file_id}` : null
}

function HomeworkCard({ homework, actions }: { homework: Homework; actions?: ReactNode }) {
  const image = assetUrl(homework)
  return <article className="homework-card">
    <ApiImage src={image} apiPath={!image&&homework.file_id?`/homeworks/${homework.id}/file`:null} alt={homework.haircut_name || 'Учебная работа'} />
    <div className="homework-card-body"><div className="card-meta"><span>Урок {homework.lesson_number || 'бонус'}</span><span className={`status status-${homework.status}`}>{statusLabels[homework.status] || homework.status}</span></div><h3>{homework.haircut_name || 'Учебная работа'}</h3>{homework.student_name && <p className="muted">Ученик: {homework.student_name}</p>}{homework.text_content && <p>{homework.text_content}</p>}{homework.rating && <p className="rating">{'★'.repeat(homework.rating)}{'☆'.repeat(5 - homework.rating)}</p>}{homework.comment && <p className="review">{homework.comment}</p>}{actions}</div>
  </article>
}

function StudentData({ maxUserId }: { maxUserId: number }) {
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [comment, setComment] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const load = () => api.get('/student/homeworks', { params: { max_user_id: maxUserId } }).then((r) => setHomeworks(r.data?.data?.homeworks || [])).catch(() => setMessage('Не удалось загрузить работы. Проверьте, что API запущен.'))
  useEffect(() => { void load() }, [])
  const sendComment = async (event: FormEvent) => { event.preventDefault(); if (!selected || !comment.trim()) return; try { await api.post(`/homeworks/${selected}/comments`, { max_user_id: maxUserId, text: comment.trim() }); setComment(''); setSelected(null); setMessage('Комментарий сохранён.'); void load() } catch { setMessage('Не удалось сохранить комментарий. Повторите попытку.') } }
  return <section><div className="section-heading"><div><span className="eyebrow">Кабинет ученика</span><h2>Мои работы</h2></div><span className="count-badge">{homeworks.length}</span></div>{message && <p className="success">{message}</p>}<div className="homework-grid">{homeworks.map((homework) => <HomeworkCard key={homework.id} homework={homework} actions={<>{selected === homework.id ? <form className="inline-form" onSubmit={sendComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Напишите комментарий к работе" required autoFocus /><div className="action-row"><button className="button" type="submit">Сохранить</button><button className="text-button" type="button" onClick={() => setSelected(null)}>Отмена</button></div></form> : <div className="action-row"><Link className="text-button" to={`/homeworks/${homework.id}`}>Подробнее</Link><button type="button" className="text-button" onClick={() => setSelected(homework.id)}>Оставить комментарий</button></div>}</>} />)}</div></section>
}

function TeacherData({ maxUserId }: { maxUserId: number }) {
  const [students, setStudents] = useState<Student[]>([])
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [reviewTarget, setReviewTarget] = useState<number | null>(null)
  const [rating, setRating] = useState('5')
  const [reviewComment, setReviewComment] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const loadStudents = () => api.get('/teacher/students', { params: { max_user_id: maxUserId } }).then((r) => { const items = r.data?.data?.students || []; setStudents(items); if (!selectedStudent && items[0]) setSelectedStudent(items[0].id) })
  useEffect(() => { void loadStudents() }, [])
  useEffect(() => { if (selectedStudent) void api.get('/teacher/student-homeworks', { params: { max_user_id: maxUserId, student_id: selectedStudent } }).then((r) => setHomeworks(r.data?.data?.homeworks || [])) }, [selectedStudent])
  const review = async (event: FormEvent, status: 'approved' | 'rejected') => { event.preventDefault(); if (!reviewTarget) return; const numericRating = Number(rating); if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) { setMessage('Оценка должна быть от 1 до 5.'); return } try { await api.post('/teacher/review', { max_user_id: maxUserId, homework_id: reviewTarget, status, rating: numericRating, comment: reviewComment.trim() }); setMessage('Проверка сохранена.'); setReviewTarget(null); setReviewComment(''); if (selectedStudent) { const r = await api.get('/teacher/student-homeworks', { params: { max_user_id: maxUserId, student_id: selectedStudent } }); setHomeworks(r.data?.data?.homeworks || []) } } catch { setMessage('Не удалось сохранить проверку. Проверьте права преподавателя.') } }
  const visibleStudents = students.filter((student) => student.full_name.toLocaleLowerCase('ru').includes(studentQuery.trim().toLocaleLowerCase('ru')))
  return <section><div className="section-heading"><div><span className="eyebrow">Кабинет преподавателя</span><h2>Проверка работ</h2></div></div>{message && <p className="success">{message}</p>}<label className="search-field">Поиск ученика<input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Имя или фамилия" type="search" /></label><div className="student-tabs">{visibleStudents.map((student) => <button type="button" className={selectedStudent === student.id ? 'student-tab active' : 'student-tab'} key={student.id} onClick={() => setSelectedStudent(student.id)}>{student.full_name}<small>{student.pending_count || 0} на проверке</small></button>)}{!visibleStudents.length && <p className="muted">Ученики не найдены.</p>}</div><div className="homework-grid">{homeworks.map((homework) => <HomeworkCard key={homework.id} homework={homework} actions={homework.status === 'pending' && <>{reviewTarget === homework.id ? <form className="review-form" onSubmit={(event) => void review(event, 'approved')}><label>Оценка <select value={rating} onChange={(event) => setRating(event.target.value)}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></label><textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Отзыв преподавателя" required autoFocus /><div className="action-row"><button className="button" type="submit">Одобрить и сохранить</button><button className="button danger" type="button" onClick={(event) => void review(event, 'rejected')}>На доработку</button><button className="text-button" type="button" onClick={() => setReviewTarget(null)}>Отмена</button></div></form> : <div className="action-row"><button type="button" className="button" onClick={() => { setReviewTarget(homework.id); setRating('5') }}>Проверить</button></div>}</>} />)}</div></section>
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
  const load = () => Promise.all([api.get('/admin/students', { params: { max_user_id: maxUserId } }), api.get('/admin/homeworks', { params: { max_user_id: maxUserId } }), api.get('/admin/teachers', { params: { max_user_id: maxUserId } }), api.get('/admin/teacher-applications', { params: { max_user_id: maxUserId } }), api.get('/admin/profile-edits', { params: { max_user_id: maxUserId } }), api.get('/admin/feedback', { params: { max_user_id: maxUserId } })]).then(([s, h, t, a, e, f]) => { setStudents(s.data?.data?.students || []); setHomeworks(h.data?.data?.homeworks || []); setTeachers(t.data?.data?.teachers || []); setApplications(a.data?.data?.applications || []); setEdits(e.data?.data?.edits || []); setFeedback(f.data?.data?.feedback || []) })
  useEffect(() => { void load() }, [maxUserId])
  const action = async (path: string, body: Record<string, unknown>) => { try { await api.post(path, { max_user_id: maxUserId, ...body }); setMessage('Изменение сохранено.'); await load() } catch { setMessage('Не удалось выполнить операцию.') } }
  const visibleStudents = students.filter((student) => student.full_name.toLocaleLowerCase('ru').includes(studentQuery.trim().toLocaleLowerCase('ru')))
  return <section><div className="section-heading"><div><span className="eyebrow">Панель администратора</span><h2>Учебная статистика</h2></div></div>{message && <p className="success">{message}</p>}<div className="stats-grid"><div className="stat-card"><strong>{students.length}</strong><span>учеников</span></div><div className="stat-card"><strong>{teachers.length}</strong><span>преподавателей</span></div><div className="stat-card"><strong>{homeworks.filter((homework) => homework.status === 'pending').length}</strong><span>работ на проверке</span></div></div><h3>Ученики</h3><label className="search-field">Поиск по имени или фамилии<input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Например, Анна" type="search" /></label><div className="student-list">{visibleStudents.map((student) => <article className="student-row" key={student.id}><strong>{student.full_name}</strong><span>{student.status === 'studying' ? 'Обучается' : student.status || '—'}</span>{student.about_me && <p>{student.about_me}</p>}</article>)}{!visibleStudents.length && <p className="muted">Ученики не найдены.</p>}</div><h3>Заявки преподавателей</h3>{applications.filter((item) => item.status === 'pending').map((item) => <article className="student-row" key={item.id}><strong>{item.full_name}</strong><span>{item.phone}</span><div className="action-row"><button className="button" type="button" onClick={() => void action('/admin/teacher-applications/review', { id: item.id, status: 'approved' })}>Одобрить</button><button className="button danger" type="button" onClick={() => void action('/admin/teacher-applications/review', { id: item.id, status: 'rejected' })}>Отклонить</button></div></article>)}{!applications.filter((item) => item.status === 'pending').length && <p className="muted">Новых заявок нет.</p>}<h3>Изменения профилей</h3>{edits.filter((item) => item.status === 'pending').map((item) => <article className="student-row" key={item.id}><strong>{item.full_name}</strong><p>{item.new_full_name}, {item.new_phone}</p><div className="action-row"><button className="button" type="button" onClick={() => void action('/admin/profile-edits/review', { id: item.id, status: 'approved' })}>Применить</button><button className="button danger" type="button" onClick={() => void action('/admin/profile-edits/review', { id: item.id, status: 'rejected', comment: 'Отклонено администратором' })}>Отклонить</button></div></article>)}<h3>Обратная связь</h3>{feedback.slice(0, 5).map((item) => <article className="student-row" key={item.id}><strong>{item.full_name} · {item.subject}</strong><p>{item.message}</p></article>)}<h3>Последние работы</h3><div className="homework-grid">{homeworks.slice(0, 6).map((homework) => <HomeworkCard key={homework.id} homework={homework} />)}</div></section>
}

export function RoleDataPage() {
  const { session } = useAuth()
  const maxUserId = getMaxUserId()
  if (!session?.role || !maxUserId) return <p className="state-message">Сначала выберите роль.</p>
  if (session.role === 'student') return <StudentData maxUserId={maxUserId} />
  if (session.role === 'teacher') return <TeacherData maxUserId={maxUserId} />
  return <AdminData maxUserId={maxUserId} />
}
