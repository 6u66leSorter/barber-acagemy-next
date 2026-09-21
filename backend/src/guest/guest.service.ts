import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

@Injectable()
export class GuestService {
  constructor(private readonly database: DatabaseService) {}
  students() { return this.database.db.prepare(`SELECT s.id, s.full_name, s.about_me, s.avatar_file_id, s.student_track, s.status, s.lessons_count, s.metro, (SELECT AVG(hr.rating) FROM homework_reviews hr JOIN homeworks h ON h.id = hr.homework_id WHERE h.student_id = s.id AND hr.status = 'approved') AS average_rating, (SELECT COUNT(hr.rating) FROM homework_reviews hr JOIN homeworks h ON h.id = hr.homework_id WHERE h.student_id = s.id AND hr.status = 'approved') AS ratings_count FROM students s WHERE s.status IN ('studying','completed') ORDER BY s.full_name`).all() }
  portfolio(studentId: number) {
    const student = this.database.db.prepare(`SELECT s.id, s.full_name, s.lessons_count, s.student_track, s.metro, s.about_me, s.avatar_file_id, (SELECT AVG(hr.rating) FROM homework_reviews hr JOIN homeworks h ON h.id = hr.homework_id WHERE h.student_id = s.id AND hr.status = 'approved') AS average_rating, (SELECT COUNT(hr.rating) FROM homework_reviews hr JOIN homeworks h ON h.id = hr.homework_id WHERE h.student_id = s.id AND hr.status = 'approved') AS ratings_count FROM students s WHERE s.id = ? AND s.status IN ('studying','completed')`).get(studentId) as Record<string, unknown> | undefined
    if (!student) throw new NotFoundException('Профиль недоступен.')
    const teachers = this.database.db.prepare('SELECT t.id, t.full_name FROM teachers t JOIN student_teachers st ON st.teacher_id = t.id WHERE st.student_id = ? ORDER BY t.full_name').all(studentId)
    const homeworks = this.database.db.prepare(`SELECT h.id, h.lesson_number, h.is_bonus, h.haircut_name, h.content_type, h.file_id, h.text_content, h.created_at, (SELECT hr.rating FROM homework_reviews hr WHERE hr.homework_id = h.id AND hr.status = 'approved' ORDER BY hr.id DESC LIMIT 1) AS rating, (SELECT hr.comment FROM homework_reviews hr WHERE hr.homework_id = h.id AND hr.status = 'approved' ORDER BY hr.id DESC LIMIT 1) AS review_comment FROM homeworks h WHERE h.student_id = ? AND h.status = 'approved' ORDER BY h.created_at DESC`).all(studentId)
    return { student: { ...student, teachers }, homeworks }
  }
  showcase() { return this.database.db.prepare(`SELECT h.id, h.student_id, h.lesson_number, h.haircut_name, h.content_type, h.file_id, h.text_content, s.full_name AS student_name FROM homeworks h JOIN students s ON s.id = h.student_id WHERE h.status = 'approved' AND s.status IN ('studying','completed') ORDER BY h.created_at DESC LIMIT 100`).all() }
}
