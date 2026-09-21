import crypto from 'node:crypto'

export function normalizePhone(value: string) {
  const phone = String(value || '').replace(/\D/g, '')
  if (phone.length === 10) return `7${phone}`
  if (phone.length === 11 && phone.startsWith('8')) return `7${phone.slice(1)}`
  if (phone.length < 11 || phone.length > 15) return null
  return phone
}

function maxAgeSeconds() {
  const value = Number(process.env.MAX_CONTACT_MAX_AGE_SEC || 300)
  return Number.isFinite(value) && value > 0 ? value : 300
}

export function validateMaxContact(input: { phone: string; authDate: string; hash: string; userId: number }, token: string, now = Date.now() / 1000) {
  const phone = normalizePhone(input.phone)
  const authDate = Number(input.authDate)
  if (!phone || !token || !Number.isInteger(authDate) || !Number.isSafeInteger(input.userId) || input.userId <= 0 || !/^[a-f\d]{64}$/i.test(input.hash)) return null
  const age = now - authDate
  if (age < -60 || age > maxAgeSeconds()) return null
  const checkString = `authDate=${input.authDate}\nphone=${phone}\nuserId=${input.userId}`
  const expected = crypto.createHmac('sha256', token).update(checkString).digest()
  const received = Buffer.from(input.hash, 'hex')
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null
  return { phone, authDate }
}
