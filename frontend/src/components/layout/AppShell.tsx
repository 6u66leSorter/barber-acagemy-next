import { PropsWithChildren, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { getMaxUserId } from '../../platform/max'

export function AppShell({ children }: PropsWithChildren) {
  const { session, isDemoMode, selectDemoRole } = useAuth()
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (window.localStorage.getItem('madcap-theme') as 'dark' | 'light') || 'light')
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('madcap-theme', theme) }, [theme])
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">MADCAP</span>
          <h1>Barber Academy</h1>
        </div>
        <div className="header-actions"><button type="button" className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Сменить тему">{theme === 'dark' ? '☀️' : '🌙'}</button>{session?.role && <span className="role-pill">{session.role}</span>}</div>
      </header>
      {isDemoMode && <div className="demo-switcher"><span>Локальная демо-роль:</span><select aria-label="Выбор демо-роли" value={getMaxUserId() || 1000000001} onChange={(event) => selectDemoRole(Number(event.target.value))}><option value="1000000001">Ученик</option><option value="1000000002">Преподаватель</option><option value="1000000003">Администратор</option></select></div>}
      <main className="app-main">{children}</main>
      <nav className="bottom-nav">
        <Link to="/">Главная</Link>
        {!session?.role && <Link to="/portfolio">Портфолио</Link>}
        {session?.role === 'student' && <><Link to="/data">Работы</Link><Link to="/chat">Чат</Link><Link to="/tools">Профиль</Link></>}
        {session?.role === 'teacher' && <><Link to="/data">Ученики</Link><Link to="/chat">Чат</Link><Link to="/tools">Профиль</Link></>}
        {session?.role === 'admin' && <><Link to="/data">Академия</Link><Link to="/chat">Чат</Link><Link to="/notifications">Уведомления</Link></>}
        {session?.role && <Link to="/notifications">Уведомления</Link>}
      </nav>
    </div>
  )
}
