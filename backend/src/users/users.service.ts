import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

export type UserRole = 'guest' | 'student' | 'teacher' | 'admin'

export type UserRecord = {
  id: number
  max_user_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  role: UserRole
}

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  findByMaxId(maxUserId: number): UserRecord | undefined {
    return this.database.db.prepare('SELECT * FROM users WHERE max_user_id = ?').get(maxUserId) as UserRecord | undefined
  }

  findById(id: number): UserRecord | undefined {
    return this.database.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord | undefined
  }

  rolesForUser(userId: number): UserRole[] {
    return (this.database.db.prepare('SELECT role FROM user_roles WHERE user_id = ? ORDER BY role').all(userId) as Array<{ role: UserRole }>).map((row) => row.role)
  }

  getOrCreateGuest(maxUserId: number, profile?: { username?: string | null; firstName?: string | null; lastName?: string | null }) {
    const existing = this.findByMaxId(maxUserId)
    if (existing) {
      this.database.db.prepare(`UPDATE users SET username = COALESCE(?, username), first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), updated_at = datetime('now') WHERE id = ?`).run(
        profile?.username ?? null,
        profile?.firstName ?? null,
        profile?.lastName ?? null,
        existing.id,
      )
      this.ensureRole(existing.id, existing.role)
      return this.findById(existing.id) as UserRecord
    }

    const result = this.database.db.prepare(`INSERT INTO users (max_user_id, username, first_name, last_name, role) VALUES (?, ?, ?, ?, 'guest')`).run(
      maxUserId,
      profile?.username ?? null,
      profile?.firstName ?? null,
      profile?.lastName ?? null,
    )
    this.ensureRole(Number(result.lastInsertRowid), 'guest')
    return this.findById(Number(result.lastInsertRowid)) as UserRecord
  }

  ensureRole(userId: number, role: UserRole) {
    this.database.db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').run(userId, role)
  }

  sessionFor(maxUserId: number) {
    const user = this.findByMaxId(maxUserId)
    const roles = user ? this.rolesForUser(user.id) : []
    const student = user
      ? this.database.db.prepare(`SELECT s.*, u.max_user_id, u.username, u.first_name, u.last_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?`).get(user.id)
      : null
    const teacher = user
      ? this.database.db.prepare(`SELECT t.*, u.max_user_id, u.username, u.first_name, u.last_name FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.user_id = ?`).get(user.id)
      : null
    const isAdmin = roles.includes('admin')
    const isTeacher = roles.includes('teacher')
    const isStudent = Boolean(student)
    return {
      hasUser: isAdmin || isTeacher || isStudent,
      role: isAdmin ? 'admin' : isTeacher ? 'teacher' : isStudent ? 'student' : null,
      roles,
      isAdmin,
      isTeacher,
      isStudent,
      isGuest: Boolean(user) && !isAdmin && !isTeacher && !isStudent,
      student,
      teacher,
      unread_notifications_count: user
        ? Number((this.database.db.prepare('SELECT COUNT(*) AS count FROM app_notifications WHERE user_id = ? AND read_at IS NULL').get(user.id) as { count?: number } | undefined)?.count || 0)
        : 0,
    }
  }
}
