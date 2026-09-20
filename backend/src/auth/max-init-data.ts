import crypto from 'node:crypto'

export type ParsedMaxInitData = {
  maxUserId: number
  user: Record<string, unknown>
  authDate: number
  startParam: string | null
}

function maxAgeSeconds() {
  const value = Number(process.env.MAX_INIT_DATA_MAX_AGE_SEC || 3600)
  return Number.isFinite(value) && value > 0 ? value : 3600
}

export function parseAndValidateMaxInitData(raw: string, botToken: string, now = Date.now() / 1000): ParsedMaxInitData | null {
  if (!raw || !botToken) return null

  try {
    const params = new URLSearchParams(raw)
    const hashes = params.getAll('hash')
    const users = params.getAll('user')
    const dates = params.getAll('auth_date')
    if (hashes.length !== 1 || users.length !== 1 || dates.length !== 1) return null
    if (!/^[a-f\d]{64}$/i.test(hashes[0])) return null

    const authDate = Number(dates[0])
    const age = now - authDate
    if (!Number.isInteger(authDate) || age < -60 || age > maxAgeSeconds()) return null

    const checkString = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex')
    const received = Buffer.from(hashes[0], 'hex')
    const calculated = Buffer.from(expected, 'hex')
    if (received.length !== calculated.length || !crypto.timingSafeEqual(received, calculated)) return null

    const user = JSON.parse(users[0]) as Record<string, unknown>
    const maxUserId = Number(user.id)
    if (!Number.isSafeInteger(maxUserId) || maxUserId <= 0) return null

    return { maxUserId, user, authDate, startParam: params.get('start_param') || null }
  } catch {
    return null
  }
}
