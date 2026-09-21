import Database from 'better-sqlite3'
import { DatabaseService } from '../src/database/database.service'
import { NotificationsService } from '../src/notifications/notifications.service'

describe('NotificationsService retention and ownership', () => {
  let sqlite: Database.Database
  let service: NotificationsService

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE app_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        payload TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO app_notifications (user_id, kind, body, created_at) VALUES
        (1, 'old', 'Старое', datetime('now', '-40 days')),
        (1, 'new', 'Новое', datetime('now')),
        (2, 'other', 'Чужое', datetime('now'));
    `)
    service = new NotificationsService({ db: sqlite } as DatabaseService)
    process.env.APP_NOTIFICATIONS_RETENTION_DAYS = '30'
  })

  afterEach(() => {
    delete process.env.APP_NOTIFICATIONS_RETENTION_DAYS
    sqlite.close()
  })

  it('purges expired records and never returns another user notifications', () => {
    const rows = service.list(1) as Array<{ kind: string }>
    expect(rows.map((row) => row.kind)).toEqual(['new'])
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM app_notifications WHERE kind = 'old'").get()).toEqual({ count: 0 })
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM app_notifications WHERE kind = 'other'").get()).toEqual({ count: 1 })
  })

  it('cannot mark another user notification as read', () => {
    const other = sqlite.prepare("SELECT id FROM app_notifications WHERE kind = 'other'").get() as { id: number }
    service.markRead(1, other.id)
    expect(sqlite.prepare('SELECT read_at FROM app_notifications WHERE id = ?').get(other.id)).toEqual({ read_at: null })
  })
})
