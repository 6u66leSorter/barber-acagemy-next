import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { AccessService } from '../src/access/access.service'
import { normalizePhone, validateMaxContact } from '../src/access/phone.util'
import { UsersService } from '../src/users/users.service'

describe('phone access', () => {
  const token = 'test-token'

  function signed(phone: string, userId: number, authDate = 1_700_000_000) {
    const normalized = normalizePhone(phone) as string
    const check = `authDate=${authDate}\nphone=${normalized}\nuserId=${userId}`
    return { phone, authDate: String(authDate), hash: crypto.createHmac('sha256', token).update(check).digest('hex') }
  }

  it('normalizes Russian phone formats and verifies MAX signature', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567')
    expect(normalizePhone('8 999 123 45 67')).toBe('79991234567')
    expect(validateMaxContact({ ...signed('+7 999 123-45-67', 42), userId: 42 }, token, 1_700_000_010)?.phone).toBe('79991234567')
    expect(validateMaxContact({ ...signed('+7 999 123-45-67', 42), hash: '0'.repeat(64), userId: 42 }, token, 1_700_000_010)).toBeNull()
    expect(validateMaxContact({ ...signed('+7 999 123-45-67', 42), userId: 42 }, token, 1_700_001_000)).toBeNull()
  })

  it('keeps an unknown phone guest-only and activates invited roles', () => {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, max_user_id INTEGER UNIQUE NOT NULL, username TEXT, first_name TEXT, last_name TEXT, role TEXT DEFAULT 'guest', verified_phone TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE user_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, role TEXT, UNIQUE(user_id, role));
      CREATE TABLE students (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, full_name TEXT, phone TEXT, lessons_count INTEGER, metro TEXT, status TEXT, avatar_file_id TEXT);
      CREATE TABLE teachers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, full_name TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE phone_role_invitations (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, role TEXT, full_name TEXT, lessons_count INTEGER, metro TEXT, student_status TEXT, claimed_user_id INTEGER, claimed_at TEXT, created_by_user_id INTEGER, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(phone, role));
      CREATE TABLE app_notifications (id INTEGER PRIMARY KEY, user_id INTEGER, read_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER, action TEXT, meta TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    `)
    const database = { db: sqlite, transaction: <T>(work: () => T) => sqlite.transaction(work)() } as never
    const users = new UsersService(database)
    const access = new AccessService(database, users)
    process.env.MAX_BOT_TOKEN = token

    const guestResult = access.verifyContact({ id: 1001 }, signed('+7 900 000-00-01', 1001, Math.floor(Date.now() / 1000)))
    expect(guestResult.access).toBe('guest')
    expect(guestResult.session.role).toBeNull()

    sqlite.prepare("INSERT INTO phone_role_invitations (phone, role, full_name, created_by_user_id) VALUES ('79000000002', 'teacher', 'Мария Преподаватель', 1)").run()
    const teacherResult = access.verifyContact({ id: 1002 }, signed('+7 900 000-00-02', 1002, Math.floor(Date.now() / 1000)))
    expect(teacherResult.session.role).toBe('teacher')
    expect(sqlite.prepare('SELECT full_name FROM teachers').get()).toEqual(expect.objectContaining({ full_name: 'Мария Преподаватель' }))
    process.env.INITIAL_ADMIN_PHONE = '+7 900 000-00-03'
    const adminResult = access.verifyContact({ id: 1003 }, signed('+7 900 000-00-03', 1003, Math.floor(Date.now() / 1000)))
    expect(adminResult.session.role).toBe('admin')
    delete process.env.INITIAL_ADMIN_PHONE
    sqlite.close()
  })
})
