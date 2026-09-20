import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

const labels: Record<string, string> = { student: 'Кабинет ученика', teacher: 'Кабинет преподавателя', admin: 'Панель администратора' }

export function RoleDashboard() {
  const { session } = useAuth()
  if (!session?.role) return null
  return <section className="card">
    <span className="eyebrow">MADCAP Barber Academy</span>
    <h2>{labels[session.role] || 'Личный кабинет'}</h2>
    <p>Разделы приложения подключаются через типизированный API. Вы вошли с ролью: {session.role}.</p>
    <nav className="dashboard-links">
      {session.role === 'student' && <><Link className="button" to="/student/homeworks">Мои домашние задания</Link><Link className="button secondary" to="/notifications">Уведомления</Link></>}
      {session.role === 'teacher' && <><Link className="button" to="/teacher/review">Проверка работ</Link><Link className="button secondary" to="/chat">Чат</Link></>}
      {session.role === 'admin' && <><Link className="button" to="/admin">Администрирование</Link><Link className="button secondary" to="/notifications">Уведомления</Link></>}
    </nav>
  </section>
}
