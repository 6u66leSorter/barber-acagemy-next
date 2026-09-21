import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { NotificationsService } from '../notifications/notifications.service'
import { UserRole } from '../users/users.service'

type StudentId = { id: number }
type RoleRow = { role: UserRole }

@Injectable()
export class ChatService {
  constructor(private readonly database: DatabaseService, private readonly notifications: NotificationsService) {}

  peers(userId: number) {
    this.requireEnabled()
    const roles = this.roles(userId)
    if (roles.includes('admin')) {
      return this.database.db.prepare(`
        SELECT u.id AS user_id, s.full_name, 'student' AS role, s.status
        FROM students s JOIN users u ON u.id = s.user_id
        WHERE s.status IN ('studying', 'completed') ORDER BY s.full_name
      `).all()
    }
    if (roles.includes('teacher')) {
      return this.database.db.prepare(`
        SELECT u.id AS user_id, s.full_name, 'student' AS role, s.status
        FROM teachers t
        JOIN student_teachers st ON st.teacher_id = t.id
        JOIN students s ON s.id = st.student_id
        JOIN users u ON u.id = s.user_id
        WHERE t.user_id = ? AND s.status IN ('studying', 'completed')
        ORDER BY s.full_name
      `).all(userId)
    }
    if (roles.includes('student')) {
      return this.database.db.prepare(`
        SELECT u.id AS user_id, t.full_name, 'teacher' AS role, NULL AS status
        FROM students s
        JOIN student_teachers st ON st.student_id = s.id
        JOIN teachers t ON t.id = st.teacher_id
        JOIN users u ON u.id = t.user_id
        WHERE s.user_id = ? ORDER BY t.full_name
      `).all(userId)
    }
    return []
  }

  messages(userId: number, peerUserId: number) {
    this.requireEnabled()
    const studentId = this.requireConversationStudent(userId, peerUserId)
    return this.database.db.prepare(`
      SELECT id, student_id, sender_user_id, text_content, content_type, file_id, created_at,
             sender_user_id = ? AS is_own
      FROM chat_messages WHERE student_id = ? ORDER BY created_at ASC, id ASC
    `).all(userId, studentId)
  }

  send(senderUserId: number, recipientUserId: number, text: string) {
    this.requireEnabled()
    const value = text.trim()
    if (!value) throw new BadRequestException('Сообщение не может быть пустым.')
    const studentId = this.requireConversationStudent(senderUserId, recipientUserId)
    return this.database.transaction(() => {
      const result = this.database.db.prepare("INSERT INTO chat_messages (student_id, sender_user_id, text_content, content_type) VALUES (?, ?, ?, 'text')").run(studentId, senderUserId, value.slice(0, 4000))
      this.notifications.create(recipientUserId, 'chat_message', 'Новое сообщение в учебном чате.', { student_id: studentId })
      return this.database.db.prepare(`
        SELECT id, student_id, sender_user_id, text_content, content_type, file_id, created_at,
               1 AS is_own
        FROM chat_messages WHERE id = ?
      `).get(Number(result.lastInsertRowid))
    })
  }

  private roles(userId: number) {
    const assigned = this.database.db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(userId) as RoleRow[]
    if (assigned.length) return assigned.map((row) => row.role)
    const legacy = this.database.db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as RoleRow | undefined
    return legacy ? [legacy.role] : []
  }

  private requireEnabled() {
    if ((process.env.CHAT_ENABLED || 'true').toLowerCase() === 'false') throw new ServiceUnavailableException('Чат временно отключён.')
  }

  private requireConversationStudent(userId: number, peerUserId: number) {
    if (!Number.isInteger(peerUserId) || userId === peerUserId) throw new ForbiddenException('Нет доступа к этому диалогу.')
    const roles = this.roles(userId)
    let student: StudentId | undefined
    if (roles.includes('admin')) {
      student = this.database.db.prepare('SELECT id FROM students WHERE user_id = ?').get(peerUserId) as StudentId | undefined
    } else if (roles.includes('teacher')) {
      student = this.database.db.prepare(`
        SELECT s.id FROM teachers t
        JOIN student_teachers st ON st.teacher_id = t.id
        JOIN students s ON s.id = st.student_id
        WHERE t.user_id = ? AND s.user_id = ?
      `).get(userId, peerUserId) as StudentId | undefined
    } else if (roles.includes('student')) {
      student = this.database.db.prepare(`
        SELECT s.id FROM students s
        JOIN student_teachers st ON st.student_id = s.id
        JOIN teachers t ON t.id = st.teacher_id
        WHERE s.user_id = ? AND t.user_id = ?
      `).get(userId, peerUserId) as StudentId | undefined
    }
    if (!student) throw new ForbiddenException('Нет доступа к этому диалогу.')
    return student.id
  }
}
