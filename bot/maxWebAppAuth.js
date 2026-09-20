import crypto from 'crypto'

const positiveMaxAge = () => {
  const configured = Number(process.env.MAX_INIT_DATA_MAX_AGE_SEC || 3600)
  return Number.isFinite(configured) && configured > 0 ? configured : 3600
}

/**
 * Проверяет подписанные MAX initData по алгоритму WebAppData.
 * Возвращает только данные из проверенной строки, никогда — значения из отдельных заголовков.
 */
export const parseAndValidateMaxWebAppInitData = (rawInitData, botToken, nowSec = Date.now() / 1000) => {
  if (typeof rawInitData !== 'string' || !rawInitData || !botToken) return null

  try {
    const params = new URLSearchParams(rawInitData)
    const hashes = params.getAll('hash')
    const users = params.getAll('user')
    const authDates = params.getAll('auth_date')
    if (hashes.length !== 1 || users.length !== 1 || authDates.length !== 1) return null

    const receivedHash = hashes[0]
    if (!/^[a-f\d]{64}$/i.test(receivedHash)) return null

    const authDate = Number(authDates[0])
    const ageSec = nowSec - authDate
    if (!Number.isInteger(authDate) || ageSec < -60 || ageSec > positiveMaxAge()) return null

    const dataCheckString = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    const received = Buffer.from(receivedHash, 'hex')
    const calculated = Buffer.from(calculatedHash, 'hex')
    if (received.length !== calculated.length || !crypto.timingSafeEqual(received, calculated)) {
      return null
    }

    const user = JSON.parse(users[0])
    const maxUserId = Number(user?.id)
    if (!Number.isSafeInteger(maxUserId) || maxUserId <= 0) return null

    return {
      maxUserId,
      user,
      authDate,
      startParam: params.get('start_param') || null,
    }
  } catch {
    return null
  }
}
