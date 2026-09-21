import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

@Injectable()
export class ProfileService {
  constructor(private readonly database: DatabaseService) {}
  updateStudentAbout(userId: number, about: string) {
    const value = about.trim().slice(0, 4000)
    const student = this.database.db.prepare('UPDATE students SET about_me = ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(value, userId)
    if (!student.changes) throw new BadRequestException('Профиль ученика не найден.')
  }
  updateTeacherAbout(userId: number, about: string) {
    const value = about.trim().slice(0, 4000)
    const teacher = this.database.db.prepare('UPDATE teachers SET about_me = ?, updated_at = datetime(\'now\') WHERE user_id = ?').run(value, userId)
    if (!teacher.changes) throw new BadRequestException('Профиль преподавателя не найден.')
  }
  applyTeacher(userId: number, fullName: string, phone: string) {
    const name = fullName.trim()
    const normalizedPhone = phone.trim()
    if (name.length < 2) throw new BadRequestException('Укажите ФИО.')
    if (!/^\+?[0-9 ()-]{7,20}$/.test(normalizedPhone)) throw new BadRequestException('Укажите корректный номер телефона.')
    const teacher = this.database.db.prepare('SELECT 1 FROM teachers WHERE user_id = ?').get(userId)
    if (teacher) throw new ConflictException('Роль преподавателя уже назначена.')
    const existing = this.database.db.prepare("SELECT id FROM teacher_applications WHERE applicant_user_id = ? AND status = 'pending'").get(userId)
    if (existing) throw new ConflictException('Заявка уже находится на рассмотрении.')
    this.database.db.prepare('INSERT INTO teacher_applications (applicant_user_id, full_name, phone) VALUES (?, ?, ?)').run(userId, name, normalizedPhone)
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
    const name = fullName.trim()
    const normalizedPhone = phone.trim()
    if (name.length < 2) throw new BadRequestException('Укажите ФИО.')
    if (!/^\+?[0-9 ()-]{7,20}$/.test(normalizedPhone)) throw new BadRequestException('Укажите корректный номер телефона.')
    this.database.transaction(() => {
      this.database.db.prepare("UPDATE student_profile_edits SET status = 'rejected', admin_comment = 'Заменено новой заявкой', reviewed_at = datetime('now') WHERE student_id = ? AND status = 'pending'").run(student.id)
      this.database.db.prepare('INSERT INTO student_profile_edits (student_id, new_full_name, new_phone, new_metro) VALUES (?, ?, ?, ?)').run(student.id, name, normalizedPhone, metro?.trim() || null)
    })
  }
}
