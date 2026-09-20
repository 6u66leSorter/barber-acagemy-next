import { ForbiddenException, Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { UsersService } from '../users/users.service'

@Injectable()
export class AdminService {
  constructor(private readonly database: DatabaseService, private readonly users: UsersService) {}
  requireAdmin(maxUserId: number) { const user = this.users.requireByMaxId(maxUserId); if (!this.users.hasRole(user.id, 'admin')) throw new ForbiddenException('Требуется роль администратора.'); return user }
  teachers() { return this.database.db.prepare('SELECT t.*, u.max_user_id, u.username FROM teachers t JOIN users u ON u.id = t.user_id ORDER BY t.full_name').all() }
  students() { return this.database.db.prepare('SELECT s.*, u.max_user_id, u.username FROM students s JOIN users u ON u.id = s.user_id ORDER BY s.full_name').all() }
  homeworks() { return this.database.db.prepare('SELECT h.*, s.full_name AS student_name FROM homeworks h JOIN students s ON s.id = h.student_id ORDER BY h.created_at DESC').all() }
  applications() { return this.database.db.prepare('SELECT * FROM teacher_applications ORDER BY created_at DESC').all() }
  profileEdits() { return this.database.db.prepare('SELECT e.*, s.full_name FROM student_profile_edits e JOIN students s ON s.id = e.student_id ORDER BY e.created_at DESC').all() }
  audit() { return this.database.db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT 500').all() }
  feedback() { return this.database.db.prepare('SELECT f.*, s.full_name FROM private_feedback f JOIN students s ON s.id = f.student_id ORDER BY f.created_at DESC').all() }
  reviewTeacherApplication(id: number, status: 'approved' | 'rejected') {
    const application = this.database.db.prepare('SELECT * FROM teacher_applications WHERE id = ?').get(id) as { applicant_user_id: number; full_name: string } | undefined
    if (!application) throw new ForbiddenException('Заявка не найдена.')
    this.database.transaction(() => { this.database.db.prepare('UPDATE teacher_applications SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id); if (status === 'approved') { this.database.db.prepare("INSERT OR IGNORE INTO teachers (user_id, full_name) VALUES (?, ?)").run(application.applicant_user_id, application.full_name); this.users.addRole(application.applicant_user_id, 'teacher') } })
  }
  assign(studentId: number, teacherId: number) { this.database.db.prepare('INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES (?, ?)').run(studentId, teacherId) }
  unassign(studentId: number, teacherId: number) { this.database.db.prepare('DELETE FROM student_teachers WHERE student_id = ? AND teacher_id = ?').run(studentId, teacherId) }
  reviewProfileEdit(id: number, status: 'approved' | 'rejected', adminComment?: string, reviewedBy?: number) {
    const edit = this.database.db.prepare('SELECT * FROM student_profile_edits WHERE id = ?').get(id) as { student_id: number; new_full_name: string; new_phone: string; new_metro?: string | null } | undefined
    if (!edit) throw new ForbiddenException('Изменение профиля не найдено.')
    this.database.transaction(() => { this.database.db.prepare("UPDATE student_profile_edits SET status = ?, admin_comment = ?, reviewed_at = datetime('now'), reviewed_by_max_user_id = ? WHERE id = ?").run(status, adminComment?.trim() || null, reviewedBy || null, id); if (status === 'approved') this.database.db.prepare("UPDATE students SET full_name = ?, phone = ?, metro = ?, updated_at = datetime('now') WHERE id = ?").run(edit.new_full_name, edit.new_phone, edit.new_metro || null, edit.student_id) })
  }
}
