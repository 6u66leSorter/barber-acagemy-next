import { PropsWithChildren, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { getMax, getMaxUserId } from '../../platform/max'

type Theme = 'dark' | 'light'

const roleNames = {
  student: 'Ученик',
  teacher: 'Преподаватель',
  admin: 'Администратор',
} as const

function NavIcon({ children }: PropsWithChildren) {
  return <span aria-hidden="true">{children}</span>
}

export function AppShell({ children }: PropsWithChildren) {
  const { session, isDemoMode, selectDemoRole, loading } = useAuth()
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem('madcap-theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('madcap-theme', theme)
    const color = theme === 'dark' ? '#12100e' : '#f6f3ef'
    getMax()?.setHeaderColor?.(color)
    getMax()?.setBackgroundColor?.(color)
  }, [theme])

  const unreadCount = session?.unread_notifications_count || 0

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Перейти к содержимому</a>
      <header className="app-header">
        <div className="brand-lockup">
          <span className="eyebrow">MADCAP</span>
          <h1>Barber Academy</h1>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
          {session?.role && <span className="role-pill">{roleNames[session.role]}</span>}
        </div>
      </header>

      {isDemoMode && (
        <div className="demo-switcher" aria-label="Управление демо-режимом">
          <div><strong>Демо-режим</strong><small>Все роли доступны без MAX</small></div>
          <select
            aria-label="Выбор демо-роли"
            value={getMaxUserId() || 1000000001}
            disabled={loading}
            onChange={(event) => selectDemoRole(Number(event.target.value))}
          >
            <option value="1000000001">Ученик</option>
            <option value="1000000002">Преподаватель</option>
            <option value="1000000003">Администратор</option>
          </select>
        </div>
      )}

      <main className="app-main" id="main-content" tabIndex={-1}>{children}</main>

      <nav className="bottom-nav" aria-label="Основная навигация">
        <NavLink to="/" end><NavIcon>⌂</NavIcon><span className="nav-label">Главная</span></NavLink>
        {!session?.role && <NavLink to="/portfolio"><NavIcon>◇</NavIcon><span className="nav-label">Портфолио</span></NavLink>}
        {session?.role === 'student' && <>
          <NavLink to="/data"><NavIcon>✂</NavIcon><span className="nav-label">Работы</span></NavLink>
          <NavLink to="/chat"><NavIcon>↗</NavIcon><span className="nav-label">Чат</span></NavLink>
          <NavLink to="/tools"><NavIcon>◎</NavIcon><span className="nav-label">Профиль</span></NavLink>
        </>}
        {session?.role === 'teacher' && <>
          <NavLink to="/data"><NavIcon>✂</NavIcon><span className="nav-label">Ученики</span></NavLink>
          <NavLink to="/chat"><NavIcon>↗</NavIcon><span className="nav-label">Чат</span></NavLink>
          <NavLink to="/tools"><NavIcon>◎</NavIcon><span className="nav-label">Профиль</span></NavLink>
        </>}
        {session?.role === 'admin' && <>
          <NavLink to="/data"><NavIcon>▦</NavIcon><span className="nav-label">Сводка</span></NavLink>
          <NavLink to="/admin"><NavIcon>⌘</NavIcon><span className="nav-label">Управление</span></NavLink>
          <NavLink to="/chat"><NavIcon>↗</NavIcon><span className="nav-label">Чат</span></NavLink>
        </>}
        {session?.role && (
          <NavLink to="/notifications" className={({ isActive }) => `${isActive ? 'active ' : ''}notification-link`}>
            <span className="nav-icon-wrap"><NavIcon>●</NavIcon>{unreadCount > 0 && <b className="nav-badge" aria-label={`${unreadCount} непрочитанных`}>{unreadCount > 99 ? '99+' : unreadCount}</b>}</span>
            <span className="nav-label">События</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}
