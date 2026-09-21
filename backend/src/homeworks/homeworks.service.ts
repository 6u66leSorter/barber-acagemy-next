import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { UsersService } from '../users/users.service'
import { NotificationsService } from '../notifications/notifications.service'
import { FilesService } from '../files/files.service'

export type HomeworkStatus = 'pending' | 'approved' | 'rejected' | 'revision'
export type HomeworkContentType = 'photo' | 'video' | 'text' | 'document'

@Injectable()
export class HomeworksService {
  constructor(private readonly database: DatabaseService, private readonly users: UsersService, private readonly notifications: NotificationsService, private readonly files: FilesService) {}

  byId(id: number) {
    return this.database.db.prepare(`SELECT h.*, s.full_name AS student_name, s.user_id AS student_user_id, u.max_user_id AS student_max_user_id FROM homeworks h JOIN students s ON h.student_id = s.id JOIN users u ON s.user_id = u.id WHERE h.id = ?`).get(id) as Record<string, unknown> | undefined
  }

  details(homeworkId: number, userId: number) {
    const homework = this.byId(homeworkId)
    if (!homework) throw new NotFoundException('Домашнее задание не найдено.')
    const studentId = Number(homework.student_id)
    const isStudent = homework.student_user_id === userId
    const isTeacher = this.database.db.prepare('SELECT 1 FROM student_teachers WHERE student_id = ? AND teacher_id IN (SELECT id FROM teachers WHERE user_id = ?)').get(studentId, userId)
    if (!isStudent && !isTeacher && !this.users.hasRole(userId, 'admin')) throw new ForbiddenException('Нет доступа к этой работе.')
    return { homework, attachments: this.attachments(homeworkId), comments: this.comments(homeworkId) }
  }

  attachments(homeworkId: number) {
    return this.database.db.prepare('SELECT id, homework_id, file_id, content_type, sort_order, created_at FROM homework_files WHERE homework_id = ? ORDER BY sort_order ASC, id ASC').all(homeworkId)
  }

  comments(homeworkId: number) {
    return this.database.db.prepare(`SELECT hc.*, u.first_name, u.last_name, u.username, CASE WHEN EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = u.id) THEN 'teacher' WHEN EXISTS (SELECT 1 FROM students s WHERE s.user_id = u.id) THEN 'student' ELSE 'admin' END AS author_role FROM homework_comments hc JOIN users u ON u.id = hc.author_user_id WHERE hc.homework_id = ? ORDER BY hc.id ASC`).all(homeworkId)
  }

  create(input: { studentId: number; ownerUserId: number; lessonNumber?: number | null; isBonus?: boolean; contentType: HomeworkContentType; fileId?: string | null; textContent?: string | null; haircutName?: string | null }) {
    const duplicate = this.database.db.prepare(`SELECT id FROM homeworks WHERE student_id = ? AND status = 'pending' AND is_bonus = ? AND lesson_number IS ? LIMIT 1`).get(input.studentId, input.isBonus ? 1 : 0, input.isBonus ? null : input.lessonNumber ?? null)
    if (duplicate) throw new BadRequestException('Работа с таким уроком уже ожидает проверки.')
    if (input.fileId) this.files.assertOwned(input.fileId, input.ownerUserId, ['homework'])
    if (input.contentType !== 'text' && !input.fileId) throw new BadRequestException('Для этого типа работы требуется загруженный файл.')
    const result = this.database.db.prepare(`INSERT INTO homeworks (student_id, lesson_number, is_bonus, content_type, file_id, text_content, status, haircut_name) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).run(input.studentId, input.lessonNumber ?? null, input.isBonus ? 1 : 0, input.contentType, input.fileId || null, input.textContent?.trim() || null, input.haircutName?.trim() || null)
    const homework = this.byId(Number(result.lastInsertRowid))
    const teachers = this.database.db.prepare('SELECT t.user_id FROM student_teachers st JOIN teachers t ON t.id = st.teacher_id WHERE st.student_id = ?').all(input.studentId) as Array<{ user_id: number }>
    teachers.forEach((teacher) => this.notifications.create(teacher.user_id, 'homework_submitted', `Новая работа «${input.haircutName || 'Без названия'}» ожидает проверки.`, { homework_id: homework?.id }))
    return homework
  }

  update(homeworkId: number, userId: number, input: { haircutName?: string; textContent?: string; fileId?: string | null }) {
    const homework = this.byId(homeworkId)
    if (!homework) throw new NotFoundException('Домашнее задание не найдено.')
    if (homework.student_user_id !== userId) throw new ForbiddenException('Нет доступа к этой работе.')
    if (!['pending', 'revision'].includes(String(homework.status))) throw new BadRequestException('Изменять можно только работу на проверке или доработке.')
    if (input.fileId) this.files.assertOwned(input.fileId, userId, ['homework'])
    this.database.db.prepare("UPDATE homeworks SET haircut_name = COALESCE(?, haircut_name), text_content = COALESCE(?, text_content), file_id = COALESCE(?, file_id), updated_at = datetime('now') WHERE id = ?").run(input.haircutName?.trim() || null, input.textContent?.trim() || null, input.fileId || null, homeworkId)
    return this.byId(homeworkId)
  }

  studentHomeworks(userId: number, includeReviewed = false) {
    const student = this.database.db.prepare('SELECT id FROM students WHERE user_id = ?').get(userId) as { id: number } | undefined
    if (!student) throw new NotFoundException('Ученик не найден.')
    const statusClause = includeReviewed ? '' : "AND h.status = 'pending'"
    return this.database.db.prepare(`SELECT h.*, (SELECT COUNT(*) FROM homework_reviews hr WHERE hr.homework_id = h.id) AS review_count, (SELECT COUNT(*) FROM homework_files hf WHERE hf.homework_id = h.id) AS extra_files_count, (SELECT hr.rating FROM homework_reviews hr WHERE hr.homework_id = h.id ORDER BY hr.id DESC LIMIT 1) AS rating, (SELECT hr.comment FROM homework_reviews hr WHERE hr.homework_id = h.id ORDER BY hr.id DESC LIMIT 1) AS comment FROM homeworks h WHERE h.student_id = ? ${statusClause} ORDER BY CASE WHEN h.status = 'pending' THEN 0 ELSE 1 END, h.created_at DESC`).all(student.id)
  }

  teacherStudents(teacherId: number) {
    return this.database.db.prepare(`SELECT s.id, s.full_name, s.lessons_count, s.status, s.student_track, s.metro, s.about_me, s.avatar_file_id, COUNT(CASE WHEN h.status = 'pending' THEN 1 END) AS pending_count FROM students s JOIN student_teachers st ON s.id = st.student_id LEFT JOIN homeworks h ON s.id = h.student_id WHERE st.teacher_id = ? AND s.status IN ('studying','completed') GROUP BY s.id ORDER BY pending_count DESC, s.full_name`).all(teacherId)
  }

  teacherDashboard(teacherId: number) {
    const students = this.teacherStudents(teacherId) as Array<Record<string, unknown>>
    const pending = this.database.db.prepare(`SELECT h.id, h.student_id, h.lesson_number, h.is_bonus, h.haircut_name, h.created_at, s.full_name AS student_name FROM homeworks h JOIN students s ON s.id = h.student_id JOIN student_teachers st ON st.student_id = s.id WHERE st.teacher_id = ? AND h.status = 'pending' ORDER BY h.created_at DESC`).all(teacherId) as Array<Record<string, unknown>>
    const seen = new Set<number>()
    const lastStudents = pending.filter((row) => { const id = Number(row.student_id); if (seen.has(id)) return false; seen.add(id); return true }).slice(0, 3).map((row) => ({ student_id: row.student_id, student_name: row.student_name }))
    return { pendingCount: pending.length, latest: pending[0] || null, students, lastStudents }
  }

  teacherHomeworks(teacherId: number, studentId: number, includeReviewed = true) {
    const access = this.database.db.prepare('SELECT 1 FROM student_teachers WHERE teacher_id = ? AND student_id = ?').get(teacherId, studentId)
    if (!access) throw new ForbiddenException('Ученик не закреплён за преподавателем.')
    const statusClause = includeReviewed ? '' : "AND h.status = 'pending'"
    return this.database.db.prepare(`SELECT h.*, s.full_name AS student_name, s.user_id AS student_user_id, (SELECT hr.rating FROM homework_reviews hr WHERE hr.homework_id = h.id ORDER BY hr.id DESC LIMIT 1) AS rating, (SELECT hr.comment FROM homework_reviews hr WHERE hr.homework_id = h.id ORDER BY hr.id DESC LIMIT 1) AS comment FROM homeworks h JOIN students s ON s.id = h.student_id WHERE h.student_id = ? ${statusClause} ORDER BY h.created_at DESC`).all(studentId)
  }

  review(input: { homeworkId: number; teacherId: number; rating?: number | null; comment?: string | null; status: 'approved' | 'rejected' }) {
    const homework = this.byId(input.homeworkId)
    if (!homework) throw new NotFoundException('Домашнее задание не найдено.')
    const studentId = Number(homework.student_id)
    const assigned = this.database.db.prepare('SELECT 1 FROM student_teachers WHERE teacher_id = ? AND student_id = ?').get(input.teacherId, studentId)
    if (!assigned) throw new ForbiddenException('Нет доступа к этому ученику.')
    if (input.rating != null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) throw new BadRequestException('Оценка должна быть от 1 до 5.')
    return this.database.transaction(() => {
      const result = this.database.db.prepare('INSERT INTO homework_reviews (homework_id, teacher_id, rating, comment, status) VALUES (?, ?, ?, ?, ?)').run(input.homeworkId, input.teacherId, input.rating ?? null, input.comment?.trim() || null, input.status)
      const nextStatus: HomeworkStatus = input.status === 'approved' ? 'approved' : 'revision'
      this.database.db.prepare("UPDATE homeworks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(nextStatus, input.homeworkId)
      const studentUserId = Number(homework.student_user_id)
      const verb = input.status === 'approved' ? 'одобрена' : 'отправлена на доработку'
      this.notifications.create(studentUserId, 'homework_reviewed', `Работа «${String(homework.haircut_name || 'Домашнее задание')}» ${verb}.`, { homework_id: input.homeworkId })
      if (input.status === 'approved') this.createFeedbackMilestone(studentId, studentUserId)
      return Number(result.lastInsertRowid)
    })
  }

  private createFeedbackMilestone(studentId: number, studentUserId: number) {
    const completed = Number((this.database.db.prepare("SELECT COUNT(*) AS count FROM homeworks WHERE student_id = ? AND status = 'approved' AND is_bonus = 0").get(studentId) as { count: number }).count)
    for (const milestone of [5, 10, 15]) {
      if (completed < milestone) continue
      const result = this.database.db.prepare('INSERT OR IGNORE INTO feedback_milestones (student_id, milestone) VALUES (?, ?)').run(studentId, milestone)
      if (result.changes) this.notifications.create(studentUserId, 'feedback_milestone', `Вы завершили ${milestone} работ. Поделитесь впечатлениями о преподавателе и академии.`, { milestone })
    }
  }

  addComment(homeworkId: number, authorUserId: number, text: string) {
    const homework = this.byId(homeworkId)
    if (!homework) throw new NotFoundException('Домашнее задание не найдено.')
    const studentId = Number(homework.student_id)
    const student = this.database.db.prepare('SELECT 1 FROM students WHERE id = ? AND user_id = ?').get(studentId, authorUserId)
    const teacher = this.database.db.prepare('SELECT 1 FROM student_teachers WHERE student_id = ? AND teacher_id IN (SELECT id FROM teachers WHERE user_id = ?)').get(studentId, authorUserId)
    if (!student && !teacher && !this.users.hasRole(authorUserId, 'admin')) throw new ForbiddenException('Нет доступа к обсуждению.')
    const value = text.trim()
    if (!value) throw new BadRequestException('Комментарий не может быть пустым.')
    const result = this.database.db.prepare('INSERT INTO homework_comments (homework_id, author_user_id, text_content) VALUES (?, ?, ?)').run(homeworkId, authorUserId, value.slice(0, 4000))
    const studentUserId = Number(homework.student_user_id)
    if (authorUserId === studentUserId) {
      const teacherUsers = this.database.db.prepare('SELECT t.user_id FROM student_teachers st JOIN teachers t ON t.id = st.teacher_id WHERE st.student_id = ?').all(studentId) as Array<{ user_id: number }>
      teacherUsers.forEach((teacher) => this.notifications.create(teacher.user_id, 'homework_comment', 'Ученик оставил комментарий к домашней работе.', { homework_id: homeworkId }))
    } else this.notifications.create(studentUserId, 'homework_comment', 'Преподаватель оставил комментарий к домашней работе.', { homework_id: homeworkId })
    return Number(result.lastInsertRowid)
  }

  submitRevision(homeworkId: number, userId: number, text: string, fileId?: string | null) {
    const homework = this.byId(homeworkId)
    if (!homework) throw new NotFoundException('Домашнее задание не найдено.')
    if (homework.student_user_id !== userId) throw new ForbiddenException('Нет доступа к этой работе.')
    if (homework.status !== 'revision') throw new BadRequestException('Работа не ожидает доработки.')
    if (fileId) this.files.assertOwned(fileId, userId, ['revision'])
    const value = text.trim()
    if (!value) throw new BadRequestException('Опишите выполненную доработку.')
    this.database.db.prepare("UPDATE homeworks SET revision_student_text = ?, revision_student_file_id = COALESCE(?, revision_student_file_id), status = 'pending', updated_at = datetime('now') WHERE id = ?").run(value, fileId || null, homeworkId)
    const teachers = this.database.db.prepare('SELECT t.user_id FROM student_teachers st JOIN teachers t ON t.id = st.teacher_id WHERE st.student_id = ?').all(Number(homework.student_id)) as Array<{ user_id: number }>
    teachers.forEach((teacher) => this.notifications.create(teacher.user_id, 'homework_resubmitted', 'Ученик отправил доработанную работу на повторную проверку.', { homework_id: homeworkId }))
  }
}
