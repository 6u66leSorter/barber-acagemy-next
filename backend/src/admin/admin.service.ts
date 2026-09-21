import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { NotificationsService } from '../notifications/notifications.service'
import { UsersService } from '../users/users.service'

@Injectable()
export class AdminService {
  constructor(private readonly database: DatabaseService, private readonly users: UsersService, private readonly notifications: NotificationsService) {}
  private appendAudit(actorUserId: number, action: string, meta: Record<string, unknown>) { this.database.db.prepare('INSERT INTO audit_log (actor_user_id, action, meta) VALUES (?, ?, ?)').run(actorUserId, action, JSON.stringify(meta)) }
  requireAdmin(maxUserId: number) { const user = this.users.requireByMaxId(maxUserId); if (!this.users.hasRole(user.id, 'admin')) throw new ForbiddenException('Требуется роль администратора.'); return user }
  teachers() { return this.database.db.prepare("SELECT t.*, u.max_user_id, u.username, (SELECT COUNT(*) FROM student_teachers st WHERE st.teacher_id = t.id) AS students_count FROM teachers t JOIN users u ON u.id = t.user_id WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = t.user_id AND ur.role = 'teacher') ORDER BY t.full_name").all() }
  students(status?: string) { return status ? this.database.db.prepare('SELECT s.*, u.max_user_id, u.username FROM students s JOIN users u ON u.id = s.user_id WHERE s.status = ? ORDER BY s.full_name').all(status) : this.database.db.prepare('SELECT s.*, u.max_user_id, u.username FROM students s JOIN users u ON u.id = s.user_id ORDER BY s.full_name').all() }
  student(studentId: number) {
    const student = this.database.db.prepare(`SELECT s.*, u.max_user_id, u.username, u.first_name, u.last_name, (SELECT AVG(hr.rating) FROM homework_reviews hr JOIN homeworks h ON h.id = hr.homework_id WHERE h.student_id = s.id AND hr.status = 'approved') AS average_rating, (SELECT COUNT(hr.rating) FROM homework_reviews hr JOIN homeworks h ON h.id = hr.homework_id WHERE h.student_id = s.id AND hr.status = 'approved') AS ratings_count FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?`).get(studentId) as Record<string, unknown> | undefined
    if (!student) throw new NotFoundException('Ученик не найден.')
    const teachers = this.database.db.prepare('SELECT t.id, t.full_name FROM teachers t JOIN student_teachers st ON st.teacher_id = t.id WHERE st.student_id = ? ORDER BY t.full_name').all(studentId) as Array<{ id: number; full_name: string }>
    const homeworks = this.database.db.prepare(`SELECT h.*, (SELECT hr.rating FROM homework_reviews hr WHERE hr.homework_id = h.id ORDER BY hr.id DESC LIMIT 1) AS rating, (SELECT hr.comment FROM homework_reviews hr WHERE hr.homework_id = h.id ORDER BY hr.id DESC LIMIT 1) AS review_comment FROM homeworks h WHERE h.student_id = ? ORDER BY h.created_at DESC`).all(studentId)
    return { student: { ...student, teachers, teacher_ids: teachers.map((row) => row.id) }, homeworks }
  }
  homeworks() { return this.database.db.prepare('SELECT h.*, s.full_name AS student_name FROM homeworks h JOIN students s ON s.id = h.student_id ORDER BY h.created_at DESC').all() }
  applications() { return this.database.db.prepare('SELECT * FROM teacher_applications ORDER BY created_at DESC').all() }
  profileEdits() { return this.database.db.prepare('SELECT e.*, s.full_name FROM student_profile_edits e JOIN students s ON s.id = e.student_id ORDER BY e.created_at DESC').all() }
  audit() { return this.database.db.prepare('SELECT a.*, a.meta AS details, u.max_user_id AS actor_max_user_id, u.username AS actor_username FROM audit_log a JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC, a.id DESC LIMIT 500').all() }
  feedback() { return this.database.db.prepare('SELECT f.*, s.full_name FROM private_feedback f JOIN students s ON s.id = f.student_id ORDER BY f.created_at DESC').all() }
  reviewTeacherApplication(id: number, status: 'approved' | 'rejected', actorUserId?: number) {
    const application = this.database.db.prepare('SELECT * FROM teacher_applications WHERE id = ?').get(id) as { applicant_user_id: number; full_name: string; status: string } | undefined
    if (!application) throw new NotFoundException('Заявка не найдена.')
    if (application.status !== 'pending') throw new ConflictException('Заявка уже обработана.')
    this.database.transaction(() => { this.database.db.prepare('UPDATE teacher_applications SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id); if (status === 'approved') { this.database.db.prepare("INSERT OR IGNORE INTO teachers (user_id, full_name) VALUES (?, ?)").run(application.applicant_user_id, application.full_name); this.users.addRole(application.applicant_user_id, 'teacher') }; this.notifications.create(application.applicant_user_id, 'teacher_application_result', status === 'approved' ? 'Ваша заявка преподавателя одобрена.' : 'Ваша заявка преподавателя отклонена.', { application_id: id }); if (actorUserId) this.appendAudit(actorUserId, `teacher_application_${status}`, { application_id: id }) })
  }
  assign(studentId: number, teacherId: number, actorUserId?: number) {
    const student = this.database.db.prepare('SELECT user_id, full_name, status FROM students WHERE id = ?').get(studentId) as { user_id: number; full_name: string; status: string } | undefined
    const teacher = this.database.db.prepare("SELECT t.user_id, t.full_name FROM teachers t WHERE t.id = ? AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = t.user_id AND ur.role = 'teacher')").get(teacherId) as { user_id: number; full_name: string } | undefined
    if (!student || !teacher) throw new NotFoundException('Преподаватель или ученик не найден.')
    if (!['studying', 'completed'].includes(student.status)) throw new BadRequestException('Назначение доступно только активному ученику.')
    const result = this.database.db.prepare('INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES (?, ?)').run(studentId, teacherId)
    if (!result.changes) return false
    this.notifications.create(teacher.user_id, 'student_assigned', `К вам прикреплён ученик: ${student.full_name}.`, { student_id: studentId }); this.notifications.create(student.user_id, 'teacher_assigned', `Вас прикрепили к преподавателю: ${teacher.full_name}.`, { teacher_id: teacherId }); if (actorUserId) this.appendAudit(actorUserId, 'admin_assign_student', { student_id: studentId, teacher_id: teacherId })
    return true
  }
  unassign(studentId: number, teacherId: number, actorUserId?: number) {
    const student = this.database.db.prepare('SELECT user_id, full_name FROM students WHERE id = ?').get(studentId) as { user_id: number; full_name: string } | undefined
    const teacher = this.database.db.prepare('SELECT user_id, full_name FROM teachers WHERE id = ?').get(teacherId) as { user_id: number; full_name: string } | undefined
    if (!student || !teacher) throw new NotFoundException('Преподаватель или ученик не найден.')
    const result = this.database.db.prepare('DELETE FROM student_teachers WHERE student_id = ? AND teacher_id = ?').run(studentId, teacherId)
    if (!result.changes) return false
    this.notifications.create(teacher.user_id, 'student_unassigned', `Ученик ${student.full_name} снят с вашего ведения.`); this.notifications.create(student.user_id, 'teacher_unassigned', `Преподаватель ${teacher.full_name} снят с вашего обучения.`); if (actorUserId) this.appendAudit(actorUserId, 'admin_unassign_student', { student_id: studentId, teacher_id: teacherId })
    return true
  }
  reviewProfileEdit(id: number, status: 'approved' | 'rejected', adminComment?: string, reviewedByMaxUserId?: number, actorUserId?: number) {
    const edit = this.database.db.prepare('SELECT e.*, s.user_id FROM student_profile_edits e JOIN students s ON s.id = e.student_id WHERE e.id = ?').get(id) as { student_id: number; user_id: number; new_full_name: string; new_phone: string; new_metro?: string | null; status: string } | undefined
    if (!edit) throw new NotFoundException('Изменение профиля не найдено.')
    if (edit.status !== 'pending') throw new ConflictException('Заявка уже обработана.')
    this.database.transaction(() => { this.database.db.prepare("UPDATE student_profile_edits SET status = ?, admin_comment = ?, reviewed_at = datetime('now'), reviewed_by_max_user_id = ? WHERE id = ?").run(status, adminComment?.trim() || null, reviewedByMaxUserId || null, id); if (status === 'approved') this.database.db.prepare("UPDATE students SET full_name = ?, phone = ?, metro = ?, updated_at = datetime('now') WHERE id = ?").run(edit.new_full_name, edit.new_phone, edit.new_metro || null, edit.student_id); this.notifications.create(edit.user_id, 'profile_edit_result', status === 'approved' ? 'Изменения профиля одобрены.' : `Изменения профиля отклонены.${adminComment ? ` Причина: ${adminComment}` : ''}`, { edit_id: id }); if (actorUserId) this.appendAudit(actorUserId, `profile_edit_${status}`, { edit_id: id }) })
  }

  createStudent(input: { maxUserId: number; fullName: string; phone: string; lessonsCount: number; metro?: string; status?: string }, actorUserId: number) {
    const user = this.users.getOrCreateGuest(input.maxUserId); if (this.database.db.prepare('SELECT 1 FROM students WHERE user_id = ?').get(user.id)) throw new ConflictException('Ученик уже существует.')
    const result = this.database.db.prepare('INSERT INTO students (user_id, full_name, phone, lessons_count, metro, status) VALUES (?, ?, ?, ?, ?, ?)').run(user.id, input.fullName.trim(), input.phone.trim(), input.lessonsCount, input.metro?.trim() || null, input.status || 'studying'); this.users.addRole(user.id, 'student'); const id = Number(result.lastInsertRowid); this.appendAudit(actorUserId, 'admin_student_create', { student_id: id, max_user_id: input.maxUserId }); return this.student(id)
  }
  updateStudent(studentId: number, input: { fullName?: string; phone?: string; lessonsCount?: number; metro?: string; studentTrack?: string; status?: string; teacherIds?: number[] }, actorUserId: number) {
    const current = this.database.db.prepare('SELECT * FROM students WHERE id = ?').get(studentId) as Record<string, unknown> | undefined; if (!current) throw new NotFoundException('Ученик не найден.')
    const teacherIds = input.teacherIds == null ? null : [...new Set(input.teacherIds)]; teacherIds?.forEach((id) => { if (!this.database.db.prepare("SELECT 1 FROM teachers t WHERE t.id = ? AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = t.user_id AND ur.role = 'teacher')").get(id)) throw new BadRequestException(`Активный преподаватель с id ${id} не найден.`) })
    this.database.transaction(() => { this.database.db.prepare("UPDATE students SET full_name = ?, phone = ?, lessons_count = ?, metro = ?, student_track = ?, status = ?, updated_at = datetime('now') WHERE id = ?").run(input.fullName?.trim() || current.full_name, input.phone?.trim() || current.phone, input.lessonsCount ?? current.lessons_count, input.metro === undefined ? current.metro : input.metro.trim() || null, input.studentTrack || current.student_track, input.status || current.status, studentId); if (teacherIds) { this.database.db.prepare('DELETE FROM student_teachers WHERE student_id = ?').run(studentId); const stmt = this.database.db.prepare('INSERT INTO student_teachers (student_id, teacher_id) VALUES (?, ?)'); teacherIds.forEach((id) => stmt.run(studentId, id)) }; this.appendAudit(actorUserId, 'admin_student_update', { student_id: studentId, ...input }) }); return this.student(studentId)
  }
  setStudentStatus(studentId: number, action: string, teacherIds: number[] | undefined, actorUserId: number) { const status = action === 'reject' ? 'rejected' : action === 'set_completed' ? 'completed' : 'studying'; const data = this.updateStudent(studentId, { status, teacherIds }, actorUserId); const userId = Number((data.student as Record<string, unknown>).user_id); this.notifications.create(userId, 'student_status', status === 'studying' ? 'Ваша заявка одобрена.' : status === 'completed' ? 'Обучение завершено.' : 'Ваша заявка отклонена.', { student_id: studentId, status }); return data }
  manageTeacher(targetMaxUserId: number, action: 'assign' | 'remove', fullName: string | undefined, actorUserId: number) {
    const target = this.users.findByMaxId(targetMaxUserId)
    if (!target) throw new NotFoundException('Пользователь не найден. Сначала он должен открыть приложение.')
    this.database.transaction(() => {
      if (action === 'assign') {
        this.users.addRole(target.id, 'teacher')
        this.database.db.prepare('INSERT OR IGNORE INTO teachers (user_id, full_name) VALUES (?, ?)').run(target.id, fullName?.trim() || [target.first_name, target.last_name].filter(Boolean).join(' ') || target.username || 'Преподаватель')
        if (fullName?.trim()) this.database.db.prepare("UPDATE teachers SET full_name = ?, updated_at = datetime('now') WHERE user_id = ?").run(fullName.trim(), target.id)
        this.notifications.create(target.id, 'teacher_role_assigned', 'Вам назначена роль преподавателя.')
      } else {
        this.users.removeRole(target.id, 'teacher')
        this.database.db.prepare('DELETE FROM student_teachers WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = ?)').run(target.id)
        this.notifications.create(target.id, 'teacher_role_removed', 'Роль преподавателя снята.')
      }
      this.appendAudit(actorUserId, `admin_teacher_${action}`, { target_max_user_id: targetMaxUserId })
    })
  }
}
