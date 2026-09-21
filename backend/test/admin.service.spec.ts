import Database from 'better-sqlite3'
import { AdminService } from '../src/admin/admin.service'
import { DatabaseService } from '../src/database/database.service'
import { NotificationsService } from '../src/notifications/notifications.service'
import { UsersService } from '../src/users/users.service'

describe('AdminService teacher lifecycle', () => {
  let sqlite: Database.Database
  let service: AdminService

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, max_user_id INTEGER UNIQUE, username TEXT, first_name TEXT, last_name TEXT, role TEXT);
      CREATE TABLE user_roles (user_id INTEGER, role TEXT, UNIQUE(user_id, role));
      CREATE TABLE teachers (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE, full_name TEXT, about_me TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
      CREATE TABLE students (id INTEGER PRIMARY KEY, user_id INTEGER, full_name TEXT, status TEXT);
      CREATE TABLE student_teachers (student_id INTEGER, teacher_id INTEGER, FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE);
      CREATE TABLE homeworks (id INTEGER PRIMARY KEY, student_id INTEGER);
      CREATE TABLE homework_reviews (id INTEGER PRIMARY KEY, homework_id INTEGER, teacher_id INTEGER, rating INTEGER, FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE);
      CREATE TABLE app_notifications (id INTEGER PRIMARY KEY, user_id INTEGER, kind TEXT, body TEXT, payload TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE audit_log (id INTEGER PRIMARY KEY, actor_user_id INTEGER, action TEXT, meta TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO users VALUES (1, 1001, 'admin', NULL, NULL, 'admin'), (2, 1002, 'teacher', 'Test', 'Teacher', 'teacher'), (3, 1003, 'student', NULL, NULL, 'student');
      INSERT INTO user_roles VALUES (1, 'admin'), (2, 'teacher'), (3, 'student');
      INSERT INTO teachers (id, user_id, full_name) VALUES (10, 2, 'Преподаватель');
      INSERT INTO students VALUES (20, 3, 'Ученик', 'studying');
      INSERT INTO student_teachers VALUES (20, 10);
      INSERT INTO homeworks VALUES (30, 20);
      INSERT INTO homework_reviews VALUES (40, 30, 10, 5);
    `)
    const database = { db: sqlite, transaction: <T>(work: () => T) => sqlite.transaction(work)() } as unknown as DatabaseService
    const users = new UsersService(database)
    service = new AdminService(database, users, new NotificationsService(database))
  })

  afterEach(() => sqlite.close())

  it('removes access and assignments without deleting historical reviews', () => {
    service.manageTeacher(1002, 'remove', undefined, 1)

    expect(sqlite.prepare("SELECT 1 FROM user_roles WHERE user_id = 2 AND role = 'teacher'").get()).toBeUndefined()
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM student_teachers').get()).toEqual({ count: 0 })
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM teachers').get()).toEqual({ count: 1 })
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM homework_reviews').get()).toEqual({ count: 1 })
    expect(service.teachers()).toEqual([])
  })
})
