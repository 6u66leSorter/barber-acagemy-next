import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

@Injectable()
export class GuestService {
  constructor(private readonly database: DatabaseService) {}
  students() { return this.database.db.prepare(`SELECT s.id, s.full_name, s.about_me, s.avatar_file_id, s.student_track, s.status FROM students s WHERE s.status IN ('studying','completed') ORDER BY s.full_name`).all() }
  portfolio(studentId: number) { return this.database.db.prepare(`SELECT h.id, h.lesson_number, h.is_bonus, h.haircut_name, h.content_type, h.file_id, h.text_content, h.created_at FROM homeworks h WHERE h.student_id = ? AND h.status = 'approved' ORDER BY h.created_at DESC`).all(studentId) }
  showcase() { return this.database.db.prepare(`SELECT h.id, h.student_id, h.lesson_number, h.haircut_name, h.content_type, h.file_id, h.text_content, s.full_name AS student_name FROM homeworks h JOIN students s ON s.id = h.student_id WHERE h.status = 'approved' ORDER BY h.created_at DESC LIMIT 100`).all() }
}
