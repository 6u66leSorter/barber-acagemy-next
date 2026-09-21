import { Link } from 'react-router-dom'
import { PageState } from '../components/UiState'
import { useAuth } from '../features/auth/AuthProvider'
import { RoleDashboard } from './RoleDashboard'
import { OnboardingPage } from './OnboardingPage'

export function HomePage() {
  const { session, loading, error, reload } = useAuth()
  if (loading) return <PageState>Загружаем профиль…</PageState>
  if (error) return <PageState kind="error" action={<button className="button" type="button" onClick={() => void reload()}>Попробовать снова</button>}>Не удалось войти: {error}</PageState>
  if (!session) return <section className="hero-card"><span className="eyebrow">MADCAP Barber Academy</span><h2>Откройте дневник в MAX</h2><p>Личный кабинет доступен из карточки бота. Публичные работы можно посмотреть без входа.</p><Link className="button primary" to="/portfolio">Открыть портфолио</Link></section>
  return session.role ? <RoleDashboard /> : <OnboardingPage />
}
