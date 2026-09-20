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
      <Link className="button" to="/data">Открыть тестовые данные</Link>
    </nav>
  </section>
}
