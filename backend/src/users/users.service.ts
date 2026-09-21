import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

export type UserRole = 'guest' | 'student' | 'teacher' | 'admin'

export type UserRecord = {
  id: number
  max_user_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  role: UserRole
  verified_phone?: string | null
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

  requireByMaxId(maxUserId: number) {
    const user = this.findByMaxId(maxUserId)
    if (!user) throw new NotFoundException('Пользователь не найден.')
    return user
  }

  hasRole(userId: number, role: UserRole) {
    return this.rolesForUser(userId).includes(role)
  }

  requireRole(userId: number, role: UserRole) {
    const user = this.findById(userId)
    if (!user) throw new NotFoundException('Пользователь не найден.')
    if (!this.hasRole(userId, role)) throw new ForbiddenException('Недостаточно прав для этого действия.')
    return user
  }

  requireRoleByMaxId(maxUserId: number, role: UserRole) {
    const user = this.requireByMaxId(maxUserId)
    return this.requireRole(user.id, role)
  }

  addRole(userId: number, role: UserRole) {
    this.ensureRole(userId, role)
  }

  removeRole(userId: number, role: UserRole) {
    this.database.db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ?').run(userId, role)
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
    const studentRow = user && roles.includes('student')
      ? this.database.db.prepare(`SELECT s.*, u.max_user_id, u.username, u.first_name, u.last_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?`).get(user.id)
      : null
    const student = studentRow as Record<string, unknown> | null
    if (student) {
      const rating = this.database.db.prepare(`SELECT AVG(hr.rating) AS average_rating, COUNT(hr.rating) AS ratings_count FROM homework_reviews hr JOIN homeworks h ON h.id = hr.homework_id WHERE h.student_id = ? AND hr.status = 'approved'`).get(student.id) as { average_rating?: number | null; ratings_count?: number }
      student.average_rating = rating.average_rating == null ? null : Number(rating.average_rating)
      student.ratings_count = Number(rating.ratings_count || 0)
      student.has_avatar = Boolean(student.avatar_file_id)
      student.teachers = this.database.db.prepare('SELECT t.id, t.full_name FROM teachers t JOIN student_teachers st ON st.teacher_id = t.id WHERE st.student_id = ? ORDER BY t.full_name').all(student.id)
    }
    const teacher = user && roles.includes('teacher')
      ? this.database.db.prepare(`SELECT t.*, u.max_user_id, u.username, u.first_name, u.last_name FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.user_id = ?`).get(user.id)
      : null
    const isAdmin = roles.includes('admin')
    const isTeacher = roles.includes('teacher')
    const isStudent = Boolean(student)
    const retentionValue = Number(process.env.APP_NOTIFICATIONS_RETENTION_DAYS || 90)
    const retentionDays = Number.isInteger(retentionValue) && retentionValue > 0 ? Math.min(retentionValue, 3650) : 90
    return {
      hasUser: isAdmin || isTeacher || isStudent,
      role: isAdmin ? 'admin' : isTeacher ? 'teacher' : isStudent ? 'student' : null,
      roles,
      isAdmin,
      isTeacher,
      isStudent,
      isGuest: Boolean(user) && !isAdmin && !isTeacher && !isStudent,
      phoneVerified: Boolean(user?.verified_phone),
      student,
      teacher,
      unread_notifications_count: user
        ? Number((this.database.db.prepare("SELECT COUNT(*) AS count FROM app_notifications WHERE user_id = ? AND read_at IS NULL AND created_at >= datetime('now', ?)").get(user.id, `-${retentionDays} days`) as { count?: number } | undefined)?.count || 0)
        : 0,
    }
  }
}
