import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AuthProvider } from './features/auth/AuthProvider'
import { HomePage } from './pages/HomePage'
import { GuestPage } from './pages/GuestPage'
import { LoadingPage } from './pages/LoadingPage'

export default function App() {
  return (
    <AuthProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guest" element={<GuestPage />} />
          <Route path="/loading" element={<LoadingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AuthProvider>
  )
}
