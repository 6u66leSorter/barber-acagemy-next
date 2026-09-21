import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  list(userId: number) {
    this.purgeExpired()
    return this.database.db.prepare('SELECT * FROM app_notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100').all(userId)
  }

  markRead(userId: number, notificationId?: number) {
    if (notificationId) this.database.db.prepare('UPDATE app_notifications SET read_at = COALESCE(read_at, datetime(\'now\')) WHERE id = ? AND user_id = ?').run(notificationId, userId)
    else this.database.db.prepare('UPDATE app_notifications SET read_at = COALESCE(read_at, datetime(\'now\')) WHERE user_id = ?').run(userId)
  }

  create(userId: number, kind: string, body: string, payload?: Record<string, unknown>) {
    this.database.db.prepare('INSERT INTO app_notifications (user_id, kind, body, payload) VALUES (?, ?, ?, ?)').run(userId, kind, body.slice(0, 1000), payload ? JSON.stringify(payload) : null)
  }

  private purgeExpired() {
    const configured = Number(process.env.APP_NOTIFICATIONS_RETENTION_DAYS || 90)
    const days = Number.isInteger(configured) && configured > 0 ? Math.min(configured, 3650) : 90
    this.database.db.prepare("DELETE FROM app_notifications WHERE created_at < datetime('now', ?)").run(`-${days} days`)
  }
}
