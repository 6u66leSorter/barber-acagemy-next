import { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { getMaxUserId } from '../../platform/max'

export function AppShell({ children }: PropsWithChildren) {
  const { session, isDemoMode, selectDemoRole } = useAuth()
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">MADCAP</span>
          <h1>Barber Academy</h1>
        </div>
        {session?.role && <span className="role-pill">{session.role}</span>}
      </header>
      {isDemoMode && <div className="demo-switcher"><span>Локальная демо-роль:</span><select aria-label="Выбор демо-роли" value={getMaxUserId() || 1000000001} onChange={(event) => selectDemoRole(Number(event.target.value))}><option value="1000000001">Ученик</option><option value="1000000002">Преподаватель</option><option value="1000000003">Администратор</option></select></div>}
      <main className="app-main">{children}</main>
      <nav className="bottom-nav">
        <Link to="/">Главная</Link>
        <Link to="/portfolio">Портфолио</Link>
        {session?.role && <Link to="/data">Данные</Link>}
        {session?.role && <Link to="/tools">Профиль</Link>}
        {session?.role && <Link to="/notifications">Уведомления</Link>}
      </nav>
    </div>
  )
}
