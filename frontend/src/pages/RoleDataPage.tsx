import { FormEvent, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId } from '../platform/max'

type Homework = {
  id: number
  lesson_number?: number | null
  haircut_name?: string | null
  content_type: string
  file_id?: string | null
  text_content?: string | null
  status: string
  student_name?: string
  rating?: number | null
  comment?: string | null
}

type Student = { id: number; full_name: string; pending_count?: number; about_me?: string | null; status?: string }

const imageFiles = new Set(['demo-homework-crop.png', 'demo-homework-fade.png', 'demo-homework-beard.png', 'demo-student-barber.png', 'demo-teacher-barber.png'])
const statusLabels: Record<string, string> = { pending: 'На проверке', approved: 'Одобрено', revision: 'На доработке', rejected: 'Отклонено' }

function assetUrl(fileId?: string | null) {
  return fileId && imageFiles.has(fileId) ? `/${fileId}` : null
}

function HomeworkCard({ homework, actions }: { homework: Homework; actions?: ReactNode }) {
  const image = assetUrl(homework.file_id)
  return <article className="homework-card">
    {image && <img src={image} alt={homework.haircut_name || 'Учебная работа'} />}
    <div className="homework-card-body"><div className="card-meta"><span>Урок {homework.lesson_number || 'бонус'}</span><span className={`status status-${homework.status}`}>{statusLabels[homework.status] || homework.status}</span></div><h3>{homework.haircut_name || 'Учебная работа'}</h3>{homework.student_name && <p className="muted">Ученик: {homework.student_name}</p>}{homework.text_content && <p>{homework.text_content}</p>}{homework.rating && <p className="rating">{'★'.repeat(homework.rating)}{'☆'.repeat(5 - homework.rating)}</p>}{homework.comment && <p className="review">{homework.comment}</p>}{actions}</div>
  </article>
}

function StudentData({ maxUserId }: { maxUserId: number }) {
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [comment, setComment] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const load = () => api.get('/student/homeworks', { params: { max_user_id: maxUserId } }).then((r) => setHomeworks(r.data?.data?.homeworks || []))
  useEffect(() => { void load() }, [])
  const sendComment = async (event: FormEvent) => { event.preventDefault(); if (!selected || !comment.trim()) return; await api.post(`/homeworks/${selected}/comments`, { max_user_id: maxUserId, text: comment }); setComment(''); setSelected(null); setMessage('Комментарий сохранён.'); void load() }
  return <section><div className="section-heading"><div><span className="eyebrow">Кабинет ученика</span><h2>Мои работы</h2></div><span className="count-badge">{homeworks.length}</span></div>{message && <p className="success">{message}</p>}<div className="homework-grid">{homeworks.map((homework) => <HomeworkCard key={homework.id} homework={homework} actions={<button className="text-button" onClick={() => setSelected(homework.id)}>Оставить комментарий</button>} />)}</div>{selected && <form className="inline-form" onSubmit={sendComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Напишите комментарий к работе" required /><button className="button" type="submit">Сохранить</button></form>}</section>
}

function TeacherData({ maxUserId }: { maxUserId: number }) {
  const [students, setStudents] = useState<Student[]>([])
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const loadStudents = () => api.get('/teacher/students', { params: { max_user_id: maxUserId } }).then((r) => { const items = r.data?.data?.students || []; setStudents(items); if (!selectedStudent && items[0]) setSelectedStudent(items[0].id) })
  useEffect(() => { void loadStudents() }, [])
  useEffect(() => { if (selectedStudent) void api.get('/teacher/student-homeworks', { params: { max_user_id: maxUserId, student_id: selectedStudent } }).then((r) => setHomeworks(r.data?.data?.homeworks || [])) }, [selectedStudent])
  const review = async (homeworkId: number, status: 'approved' | 'rejected') => { const rating = Number(window.prompt('Оценка от 1 до 5', '5') || 5); const comment = window.prompt('Отзыв преподавателя', 'Хорошая работа, продолжайте!') || ''; await api.post('/teacher/review', { max_user_id: maxUserId, homework_id: homeworkId, status, rating, comment }); setMessage('Проверка сохранена.'); if (selectedStudent) { const r = await api.get('/teacher/student-homeworks', { params: { max_user_id: maxUserId, student_id: selectedStudent } }); setHomeworks(r.data?.data?.homeworks || []) } }
  return <section><div className="section-heading"><div><span className="eyebrow">Кабинет преподавателя</span><h2>Проверка работ</h2></div></div>{message && <p className="success">{message}</p>}<div className="student-tabs">{students.map((student) => <button className={selectedStudent === student.id ? 'student-tab active' : 'student-tab'} key={student.id} onClick={() => setSelectedStudent(student.id)}>{student.full_name}<small>{student.pending_count || 0} на проверке</small></button>)}</div><div className="homework-grid">{homeworks.map((homework) => <HomeworkCard key={homework.id} homework={homework} actions={homework.status === 'pending' && <div className="action-row"><button className="button" onClick={() => void review(homework.id, 'approved')}>Одобрить</button><button className="button danger" onClick={() => void review(homework.id, 'rejected')}>На доработку</button></div>} />)}</div></section>
}

function AdminData({ maxUserId }: { maxUserId: number }) {
  const [students, setStudents] = useState<Student[]>([])
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  useEffect(() => { void Promise.all([api.get('/admin/students', { params: { max_user_id: maxUserId } }), api.get('/admin/homeworks', { params: { max_user_id: maxUserId } })]).then(([studentsResponse, homeworksResponse]) => { setStudents(studentsResponse.data?.data?.students || []); setHomeworks(homeworksResponse.data?.data?.homeworks || []) }) }, [maxUserId])
  return <section><div className="section-heading"><div><span className="eyebrow">Панель администратора</span><h2>Учебная статистика</h2></div></div><div className="stats-grid"><div className="stat-card"><strong>{students.length}</strong><span>учеников</span></div><div className="stat-card"><strong>{homeworks.length}</strong><span>работ</span></div><div className="stat-card"><strong>{homeworks.filter((homework) => homework.status === 'pending').length}</strong><span>на проверке</span></div></div><h3>Последние работы</h3><div className="homework-grid">{homeworks.slice(0, 6).map((homework) => <HomeworkCard key={homework.id} homework={homework} />)}</div></section>
}

export function RoleDataPage() {
  const { session } = useAuth()
  const maxUserId = getMaxUserId()
  if (!session?.role || !maxUserId) return <p className="state-message">Сначала выберите роль.</p>
  if (session.role === 'student') return <StudentData maxUserId={maxUserId} />
  if (session.role === 'teacher') return <TeacherData maxUserId={maxUserId} />
  return <AdminData maxUserId={maxUserId} />
}
