import { ForbiddenException } from '@nestjs/common'
import Database from 'better-sqlite3'
import { ChatService } from '../src/chat/chat.service'
import { DatabaseService } from '../src/database/database.service'
import { NotificationsService } from '../src/notifications/notifications.service'

describe('ChatService access control', () => {
  let sqlite: Database.Database
  let service: ChatService

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, max_user_id INTEGER UNIQUE NOT NULL, username TEXT, role TEXT NOT NULL);
      CREATE TABLE user_roles (user_id INTEGER NOT NULL, role TEXT NOT NULL);
      CREATE TABLE students (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL, full_name TEXT NOT NULL, phone TEXT NOT NULL, status TEXT NOT NULL);
      CREATE TABLE teachers (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL, full_name TEXT NOT NULL);
      CREATE TABLE student_teachers (student_id INTEGER NOT NULL, teacher_id INTEGER NOT NULL, UNIQUE(student_id, teacher_id));
      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        sender_user_id INTEGER NOT NULL,
        text_content TEXT,
        content_type TEXT NOT NULL,
        file_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(sender_user_id) REFERENCES users(id)
      );
      CREATE TABLE app_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        payload TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      INSERT INTO users VALUES (1, 1000000001, 'admin_name', 'admin');
      INSERT INTO users VALUES (2, 1000000002, 'teacher_name', 'teacher');
      INSERT INTO users VALUES (3, 1000000003, 'student_one', 'student');
      INSERT INTO users VALUES (4, 1000000004, 'student_two', 'student');
      INSERT INTO users VALUES (5, 1000000005, 'other_teacher', 'teacher');
      INSERT INTO user_roles VALUES (1, 'admin'), (2, 'teacher'), (3, 'student'), (4, 'student'), (5, 'teacher');
      INSERT INTO teachers VALUES (10, 2, 'Преподаватель'), (11, 5, 'Другой преподаватель');
      INSERT INTO students VALUES (20, 3, 'Первый ученик', '+70000000001', 'studying');
      INSERT INTO students VALUES (21, 4, 'Второй ученик', '+70000000002', 'studying');
      INSERT INTO student_teachers VALUES (20, 10), (21, 11);
      INSERT INTO chat_messages (student_id, sender_user_id, text_content, content_type) VALUES (20, 3, 'Личная переписка первого ученика', 'text');
      INSERT INTO chat_messages (student_id, sender_user_id, text_content, content_type) VALUES (21, 4, 'Личная переписка второго ученика', 'text');
    `)

    const database = {
      db: sqlite,
      transaction: <T>(work: () => T) => sqlite.transaction(work)(),
    } as unknown as DatabaseService
    const notifications = new NotificationsService(database)
    service = new ChatService(database, notifications)
  })

  afterEach(() => sqlite.close())

  it('returns only assigned students to a teacher without personal MAX data', () => {
    const peers = service.peers(2) as Array<Record<string, unknown>>

    expect(peers).toEqual([{ user_id: 3, full_name: 'Первый ученик', role: 'student', status: 'studying' }])
    expect(peers[0]).not.toHaveProperty('max_user_id')
    expect(peers[0]).not.toHaveProperty('username')
    expect(peers[0]).not.toHaveProperty('phone')
  })

  it('returns only assigned teachers to a student', () => {
    expect(service.peers(3)).toEqual([{ user_id: 2, full_name: 'Преподаватель', role: 'teacher', status: null }])
  })

  it('allows a student and assigned teacher to read their conversation', () => {
    expect(service.messages(3, 2)).toHaveLength(1)
    expect(service.messages(2, 3)).toHaveLength(1)
  })

  it('prevents a student from reading another student conversation', () => {
    expect(() => service.messages(3, 5)).toThrow(ForbiddenException)
    expect(() => service.messages(3, 4)).toThrow(ForbiddenException)
  })

  it('prevents an unassigned teacher from reading or messaging a student', () => {
    expect(() => service.messages(2, 4)).toThrow(ForbiddenException)
    expect(() => service.send(2, 4, 'Чужое сообщение')).toThrow(ForbiddenException)
  })

  it('uses internal user ids and creates a notification for the real recipient', () => {
    const message = service.send(3, 2, '  Новая работа готова  ') as Record<string, unknown>
    const notification = sqlite.prepare('SELECT user_id, kind FROM app_notifications').get() as { user_id: number; kind: string }

    expect(message).toMatchObject({ student_id: 20, sender_user_id: 3, text_content: 'Новая работа готова', is_own: 1 })
    expect(notification).toEqual({ user_id: 2, kind: 'chat_message' })
  })

  it('rejects a MAX id passed where an internal user id is required', () => {
    expect(() => service.send(3, 1000000002, 'Неверный идентификатор')).toThrow(ForbiddenException)
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM app_notifications').get()).toEqual({ count: 0 })
  })

  it('allows an admin to access student threads but not arbitrary users', () => {
    expect(service.messages(1, 3)).toHaveLength(1)
    expect(() => service.messages(1, 2)).toThrow(ForbiddenException)
  })
})
