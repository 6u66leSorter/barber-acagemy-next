import { BadRequestException, Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

@Injectable()
export class ChatService {
  constructor(private readonly database: DatabaseService) {}
  students() { return this.database.db.prepare(`SELECT s.id, s.full_name, s.status, u.max_user_id, u.username FROM students s JOIN users u ON u.id = s.user_id WHERE s.status IN ('studying','completed') ORDER BY s.full_name`).all() }
  messages(userId: number, peerUserId?: number) {
    if (peerUserId) return this.database.db.prepare('SELECT * FROM chat_messages WHERE (sender_user_id = ? AND recipient_user_id = ?) OR (sender_user_id = ? AND recipient_user_id = ?) ORDER BY created_at ASC').all(userId, peerUserId, peerUserId, userId)
    return this.database.db.prepare('SELECT * FROM chat_messages WHERE sender_user_id = ? OR recipient_user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId, userId)
  }
  send(senderUserId: number, recipientUserId: number, text: string) {
    const value = text.trim(); if (!value) throw new BadRequestException('Сообщение не может быть пустым.')
    const result = this.database.db.prepare('INSERT INTO chat_messages (sender_user_id, recipient_user_id, text_content) VALUES (?, ?, ?)').run(senderUserId, recipientUserId, value.slice(0, 4000))
    return this.database.db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(Number(result.lastInsertRowid))
  }
}
