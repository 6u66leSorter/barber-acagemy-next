import crypto from 'node:crypto'
import { parseAndValidateMaxInitData } from './max-init-data'

function signedData(token: string, userId: number, authDate: number, extras: Array<[string, string]> = []) {
  const params = new URLSearchParams([['auth_date', String(authDate)], ['user', JSON.stringify({ id: userId, first_name: 'Тест' })], ...extras])
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  params.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'))
  return params.toString()
}

describe('MAX init data validation', () => {
  const token = 'test-token'
  const now = 2_000_000_000

  it('accepts a valid signed payload', () => {
    expect(parseAndValidateMaxInitData(signedData(token, 123, now - 10), token, now)?.maxUserId).toBe(123)
  })

  it('rejects tampering and expired data', () => {
    const valid = signedData(token, 123, now - 10)
    expect(parseAndValidateMaxInitData(valid.replace('123', '124'), token, now)).toBeNull()
    expect(parseAndValidateMaxInitData(signedData(token, 123, now - 7200), token, now)).toBeNull()
  })

  it('rejects duplicated protected fields', () => {
    const raw = `${signedData(token, 123, now - 10)}&user=${encodeURIComponent(JSON.stringify({ id: 999 }))}`
    expect(parseAndValidateMaxInitData(raw, token, now)).toBeNull()
  })
})
