import { BadRequestException } from '@nestjs/common'
import Database from 'better-sqlite3'
import { DatabaseService } from '../src/database/database.service'
import { FilesService } from '../src/files/files.service'
import { HomeworksService } from '../src/homeworks/homeworks.service'
import { NotificationsService } from '../src/notifications/notifications.service'
import { UsersService } from '../src/users/users.service'

describe('HomeworksService workflow', () => {
  let sqlite: Database.Database
  let service: HomeworksService

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, max_user_id INTEGER UNIQUE NOT NULL, username TEXT, first_name TEXT, last_name TEXT, role TEXT);
      CREATE TABLE user_roles (user_id INTEGER NOT NULL, role TEXT NOT NULL);
      CREATE TABLE students (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, full_name TEXT NOT NULL, status TEXT NOT NULL);
      CREATE TABLE teachers (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, full_name TEXT NOT NULL);
      CREATE TABLE student_teachers (student_id INTEGER NOT NULL, teacher_id INTEGER NOT NULL);
      CREATE TABLE homeworks (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, lesson_number INTEGER, is_bonus INTEGER DEFAULT 0, content_type TEXT, file_id TEXT, text_content TEXT, revision_student_text TEXT, revision_student_file_id TEXT, status TEXT, haircut_name TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE homework_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, homework_id INTEGER NOT NULL, teacher_id INTEGER NOT NULL, rating INTEGER, comment TEXT, status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE homework_files (id INTEGER PRIMARY KEY, homework_id INTEGER, file_id TEXT, content_type TEXT, sort_order INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE homework_comments (id INTEGER PRIMARY KEY, homework_id INTEGER, author_user_id INTEGER, text_content TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE feedback_milestones (student_id INTEGER, milestone INTEGER, UNIQUE(student_id, milestone));
      CREATE TABLE app_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, kind TEXT, body TEXT, payload TEXT, read_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO users VALUES (2, 1002, 'teacher_private', 'Teacher', NULL, 'teacher'), (3, 1003, 'student_private', 'Student', NULL, 'student');
      INSERT INTO user_roles VALUES (2, 'teacher'), (3, 'student');
      INSERT INTO teachers VALUES (10, 2, 'Преподаватель');
      INSERT INTO students VALUES (20, 3, 'Ученик', 'studying');
      INSERT INTO student_teachers VALUES (20, 10);
      INSERT INTO homeworks (student_id, lesson_number, content_type, status, haircut_name) VALUES
        (20, 1, 'text', 'approved', 'Работа 1'), (20, 2, 'text', 'approved', 'Работа 2'),
        (20, 3, 'text', 'approved', 'Работа 3'), (20, 4, 'text', 'approved', 'Работа 4'),
        (20, 5, 'text', 'pending', 'Работа 5');
    `)
    const database = { db: sqlite, transaction: <T>(work: () => T) => sqlite.transaction(work)() } as unknown as DatabaseService
    const users = new UsersService(database)
    service = new HomeworksService(database, users, new NotificationsService(database), { assertOwned: jest.fn() } as unknown as FilesService)
  })

  afterEach(() => sqlite.close())

  it('creates milestone notification exactly once and prevents a second review', () => {
    service.review({ homeworkId: 5, teacherId: 10, rating: 5, comment: 'Отлично', status: 'approved' })

    expect(sqlite.prepare('SELECT student_id, milestone FROM feedback_milestones').all()).toEqual([{ student_id: 20, milestone: 5 }])
    expect(sqlite.prepare("SELECT user_id, kind FROM app_notifications WHERE kind = 'feedback_milestone'").get()).toEqual({ user_id: 3, kind: 'feedback_milestone' })
    expect(() => service.review({ homeworkId: 5, teacherId: 10, rating: 4, status: 'approved' })).toThrow(BadRequestException)
  })

  it('does not expose MAX id or username in homework details and comments', () => {
    sqlite.prepare("INSERT INTO homework_comments VALUES (1, 5, 3, 'Комментарий', datetime('now'))").run()
    const details = service.details(5, 3)

    expect(details.homework).not.toHaveProperty('student_max_user_id')
    expect((details.comments as Array<Record<string, unknown>>)[0]).not.toHaveProperty('username')
    expect(details.comments[0]).toMatchObject({ author_name: 'Ученик', author_role: 'student' })
  })
})
