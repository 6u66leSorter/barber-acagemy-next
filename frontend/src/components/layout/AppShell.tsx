import { PropsWithChildren, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { getMax, getMaxUserId } from '../../platform/max'

export function AppShell({ children }: PropsWithChildren) {
  const { session, isDemoMode, selectDemoRole } = useAuth()
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (window.localStorage.getItem('madcap-theme') as 'dark' | 'light') || 'light')
  useEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem('madcap-theme', theme); const color=theme==='dark'?'#12100e':'#f6f3ef'; getMax()?.setHeaderColor?.(color); getMax()?.setBackgroundColor?.(color) }, [theme])
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
        <NavLink to="/" end><span>⌂</span>Главная</NavLink>
        {!session?.role && <NavLink to="/portfolio"><span>◇</span>Портфолио</NavLink>}
        {session?.role === 'student' && <><NavLink to="/data"><span>✂</span>Работы</NavLink><NavLink to="/chat"><span>↗</span>Чат</NavLink><NavLink to="/tools"><span>◎</span>Профиль</NavLink></>}
        {session?.role === 'teacher' && <><NavLink to="/data"><span>✂</span>Ученики</NavLink><NavLink to="/chat"><span>↗</span>Чат</NavLink><NavLink to="/tools"><span>◎</span>Профиль</NavLink></>}
        {session?.role === 'admin' && <><NavLink to="/data"><span>▦</span>Сводка</NavLink><NavLink to="/admin"><span>⌘</span>Управление</NavLink><NavLink to="/chat"><span>↗</span>Чат</NavLink></>}
        {session?.role && <NavLink to="/notifications"><span>●</span>События</NavLink>}
      </nav>
    </div>
  )
}
