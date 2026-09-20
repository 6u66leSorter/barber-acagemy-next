import { BadRequestException, Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

@Injectable()
export class ProfileService {
  constructor(private readonly database: DatabaseService) {}
  updateAbout(userId: number, about: string) {
    const value = about.trim().slice(0, 4000)
    const student = this.database.db.prepare('UPDATE students SET about_me = ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(value, userId)
    const teacher = this.database.db.prepare('UPDATE teachers SET about_me = ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(value, userId)
    if (!student.changes && !teacher.changes) throw new BadRequestException('Профиль не найден.')
  }
  applyTeacher(userId: number, fullName: string, phone: string) {
    const existing = this.database.db.prepare("SELECT id FROM teacher_applications WHERE applicant_user_id = ? AND status = 'pending'").get(userId)
    if (existing) throw new BadRequestException('Заявка уже находится на рассмотрении.')
    this.database.db.prepare('INSERT INTO teacher_applications (applicant_user_id, full_name, phone) VALUES (?, ?, ?)').run(userId, fullName.trim(), phone.trim())
  }
  feedback(userId: number, subject: string, message: string) {
    const student = this.database.db.prepare('SELECT id FROM students WHERE user_id = ?').get(userId) as { id: number } | undefined
    if (!student) throw new BadRequestException('Обратная связь доступна ученикам.')
    if (!message.trim()) throw new BadRequestException('Сообщение не может быть пустым.')
    const key = `${subject}:${new Date().toISOString().slice(0, 10)}`
    this.database.db.prepare('INSERT OR REPLACE INTO private_feedback (student_id, request_key, subject, message) VALUES (?, ?, ?, ?)').run(student.id, key, subject, message.trim().slice(0, 4000))
  }
  requestEdit(userId: number, fullName: string, phone: string, metro?: string) {
    const student = this.database.db.prepare('SELECT id FROM students WHERE user_id = ?').get(userId) as { id: number } | undefined
    if (!student) throw new BadRequestException('Профиль ученика не найден.')
    this.database.db.prepare('INSERT INTO student_profile_edits (student_id, new_full_name, new_phone, new_metro) VALUES (?, ?, ?, ?)').run(student.id, fullName.trim(), phone.trim(), metro?.trim() || null)
  }
}
