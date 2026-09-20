import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { RoleDashboard } from './RoleDashboard'

export function HomePage() {
  const { session, loading, error } = useAuth()
  if (loading) return <p className="state-message">Загрузка профиля…</p>
  if (error) return <p className="state-message error">{error}</p>
  if (!session) return <section className="card"><h2>Откройте приложение в MAX</h2><p>Для входа нужен подписанный запуск мини-приложения MAX.</p><Link className="button" to="/guest">Открыть публичное портфолио</Link></section>
  return session.role ? <RoleDashboard /> : <section className="card"><span className="eyebrow">Ваш кабинет</span><h2>Регистрация</h2><p>Аккаунт найден, но учебная роль ещё не назначена.</p></section>
}
