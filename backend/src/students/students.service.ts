import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { UsersService } from '../users/users.service'

export type StudentStatus = 'moderation' | 'studying' | 'completed' | 'rejected'
export type StudentTrack = 'student' | 'intern' | 'barber'

@Injectable()
export class StudentsService {
  constructor(private readonly database: DatabaseService, private readonly users: UsersService) {}

  byUserId(userId: number) {
    return this.database.db.prepare(`SELECT s.*, u.max_user_id, u.username, u.first_name, u.last_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?`).get(userId) as Record<string, unknown> | undefined
  }

  byId(studentId: number) {
    return this.database.db.prepare(`SELECT s.*, u.max_user_id, u.username, u.first_name, u.last_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?`).get(studentId) as Record<string, unknown> | undefined
  }

  byMaxUserId(maxUserId: number) {
    return this.database.db.prepare(`SELECT s.*, u.max_user_id, u.username, u.first_name, u.last_name FROM students s JOIN users u ON s.user_id = u.id WHERE u.max_user_id = ?`).get(maxUserId) as Record<string, unknown> | undefined
  }

  register(input: { maxUserId: number; fullName: string; phone: string; lessonsCount: number; metro?: string | null; username?: string | null; firstName?: string | null; lastName?: string | null }) {
    if (this.byMaxUserId(input.maxUserId)) throw new ConflictException('Заявка уже существует.')
    const fullName = input.fullName.trim()
    if (fullName.length < 2) throw new BadRequestException('Укажите ФИО.')
    if (!/^\+?[0-9 ()-]{7,20}$/.test(input.phone.trim())) throw new BadRequestException('Укажите корректный номер телефона.')
    if (!Number.isInteger(input.lessonsCount) || input.lessonsCount <= 0) throw new BadRequestException('Количество занятий должно быть целым числом больше нуля.')

    const user = this.users.getOrCreateGuest(input.maxUserId, { username: input.username, firstName: input.firstName, lastName: input.lastName })
    this.users.ensureRole(user.id, 'student')
    const result = this.database.db.prepare(`INSERT INTO students (user_id, full_name, phone, lessons_count, status, metro) VALUES (?, ?, ?, ?, 'moderation', ?)`).run(
      user.id,
      fullName,
      input.phone.trim(),
      input.lessonsCount,
      input.metro?.trim() || null,
    )
    return this.byId(Number(result.lastInsertRowid))
  }

  updateAbout(userId: number, aboutMe: string) {
    const student = this.byUserId(userId)
    if (!student) throw new NotFoundException('Ученик не найден.')
    this.database.db.prepare("UPDATE students SET about_me = ?, updated_at = datetime('now') WHERE id = ?").run(aboutMe.trim().slice(0, 1000) || null, student.id)
    return this.byId(Number(student.id))
  }

  updateAvatar(userId: number, fileId: string) {
    const student = this.byUserId(userId)
    if (!student) throw new NotFoundException('Ученик не найден.')
    this.database.db.prepare("UPDATE students SET avatar_file_id = ?, updated_at = datetime('now') WHERE id = ?").run(fileId, student.id)
  }

  homeworks(userId: number, includeReviewed = false) {
    const student = this.byUserId(userId)
    if (!student) throw new NotFoundException('Ученик не найден.')
    const statusFilter = includeReviewed ? '' : "AND h.status = 'pending'"
    return this.database.db.prepare(`SELECT h.*, (SELECT COUNT(*) FROM homework_reviews hr WHERE hr.homework_id = h.id) AS review_count, (SELECT COUNT(*) FROM homework_files hf WHERE hf.homework_id = h.id) AS extra_files_count FROM homeworks h WHERE h.student_id = ? ${statusFilter} ORDER BY CASE WHEN h.status = 'pending' THEN 0 ELSE 1 END, h.created_at DESC`).all(student.id)
  }

  homeworksByMaxId(maxUserId: number, includeReviewed = false) {
    const user = this.users.findByMaxId(maxUserId)
    if (!user) throw new NotFoundException('Пользователь не найден.')
    return this.homeworks(user.id, includeReviewed)
  }

  updateAboutByMaxId(maxUserId: number, aboutMe: string) {
    const user = this.users.findByMaxId(maxUserId) || this.users.getOrCreateGuest(maxUserId)
    return this.updateAbout(user.id, aboutMe)
  }

  rating(studentId: number) {
    const row = this.database.db.prepare(`SELECT AVG(hr.rating) AS average_rating, COUNT(hr.rating) AS ratings_count FROM homework_reviews hr JOIN homeworks h ON hr.homework_id = h.id WHERE h.student_id = ? AND hr.rating IS NOT NULL AND hr.status = 'approved'`).get(studentId) as { average_rating?: number; ratings_count?: number } | undefined
    return { average_rating: row?.average_rating == null ? null : Number(row.average_rating), ratings_count: Number(row?.ratings_count || 0) }
  }

  requestProfileEdit(userId: number, input: { fullName: string; phone: string; metro?: string | null }) {
    const student = this.byUserId(userId)
    if (!student) throw new NotFoundException('Ученик не найден.')
    this.database.db.prepare("UPDATE student_profile_edits SET status = 'rejected' WHERE student_id = ? AND status = 'pending'").run(student.id)
    return this.database.db.prepare('INSERT INTO student_profile_edits (student_id, new_full_name, new_phone, new_metro) VALUES (?, ?, ?, ?)').run(student.id, input.fullName.trim(), input.phone.trim(), input.metro?.trim() || null)
  }
}
