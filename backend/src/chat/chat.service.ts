import { BadRequestException, Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

@Injectable()
export class ChatService {
  constructor(private readonly database: DatabaseService) {}
  students() { return this.database.db.prepare(`SELECT s.id, s.full_name, s.status, u.max_user_id, u.username FROM students s JOIN users u ON u.id = s.user_id WHERE s.status IN ('studying','completed') ORDER BY s.full_name`).all() }
  messages(userId: number, peerUserId?: number) {
    if (peerUserId) {
      const student = this.database.db.prepare('SELECT id FROM students WHERE user_id IN (?, ?) LIMIT 1').get(userId, peerUserId) as { id: number } | undefined
      return student ? this.database.db.prepare('SELECT * FROM chat_messages WHERE student_id = ? ORDER BY created_at ASC').all(student.id) : []
    }
    return this.database.db.prepare('SELECT * FROM chat_messages WHERE sender_user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId)
  }
  send(senderUserId: number, recipientUserId: number, text: string) {
    const value = text.trim(); if (!value) throw new BadRequestException('Сообщение не может быть пустым.')
    const student = this.database.db.prepare('SELECT id FROM students WHERE user_id IN (?, ?) LIMIT 1').get(senderUserId, recipientUserId) as { id: number } | undefined
    if (!student) throw new BadRequestException('Для диалога не найден ученик.')
    const result = this.database.db.prepare("INSERT INTO chat_messages (student_id, sender_user_id, text_content, content_type) VALUES (?, ?, ?, 'text')").run(student.id, senderUserId, value.slice(0, 4000))
    return this.database.db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(Number(result.lastInsertRowid))
  }
}
