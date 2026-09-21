import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Notice } from '../components/UiState'
import { useAuth } from '../features/auth/AuthProvider'
import { getMaxUserId, requestMaxContact } from '../platform/max'

export function OnboardingPage() {
  const { reload, isDemoMode, session } = useAuth()
  const maxUserId = getMaxUserId()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const verify = async () => {
    if (!maxUserId || busy) return
    setBusy(true); setMessage(''); setError('')
    try {
      const contact = await requestMaxContact()
      const response = await api.post('/access/verify-phone', { max_user_id: maxUserId, phone: contact.phone, auth_date: contact.authDate, hash: contact.hash })
      setMessage(response.data?.data?.access === 'assigned' ? 'Номер подтверждён. Доступ к назначенной роли открыт.' : 'Номер подтверждён, но назначения для него пока нет. Вам доступен гостевой просмотр.')
      await reload()
    } catch (cause) {
      const unavailable = cause instanceof Error && cause.message === 'contact_unavailable'
      setError(unavailable ? 'Подтверждение номера работает только внутри мини-приложения MAX.' : 'Не удалось подтвердить номер. Если вы отказались от передачи контакта, нажмите кнопку ещё раз.')
    }
    finally { setBusy(false) }
  }

  return <section className="onboarding fi">
    <div className="hero-card">
      <span className="eyebrow">Добро пожаловать в MADCAP</span>
      <h2>Подтвердите доступ</h2>
      <p>Если администратор добавил ваш номер как ученика, преподавателя или администратора, MAX безопасно активирует нужный кабинет.</p>
    </div>
    <div className="tool-form">
      <div><span className="eyebrow">Вход без MAX ID</span><h3>Поделиться номером из MAX</h3></div>
      <p className="muted">Номер не нужно вводить вручную. MAX покажет системное окно согласия, а сервер проверит цифровую подпись. Другим пользователям доступны только публичные портфолио.</p>
      {session?.phoneVerified && <Notice kind="success">Номер уже подтверждён. Администратор ещё не назначил ему учебную роль.</Notice>}
      {isDemoMode && <Notice kind="info">В демо-режиме роли выбираются в верхней панели. Проверка реального номера доступна только внутри MAX.</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <button className="button primary btn-w" type="button" disabled={busy || isDemoMode} onClick={() => void verify()}>{busy ? 'Проверяем…' : 'Поделиться номером'}</button>
      <Link className="button btn-w" to="/portfolio">Смотреть портфолио как гость</Link>
    </div>
  </section>
}
