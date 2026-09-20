import { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

export function AppShell({ children }: PropsWithChildren) {
  const { session } = useAuth()
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="eyebrow">MADCAP</span>
          <h1>Barber Academy</h1>
        </div>
        {session?.role && <span className="role-pill">{session.role}</span>}
      </header>
      <main className="app-main">{children}</main>
      <nav className="bottom-nav">
        <Link to="/">Главная</Link>
        <Link to="/guest">Портфолио</Link>
      </nav>
    </div>
  )
}
