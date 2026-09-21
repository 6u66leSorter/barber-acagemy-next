import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import Database from 'better-sqlite3'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  max_user_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'guest' CHECK(role IN ('student','teacher','admin','guest')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','teacher','admin','guest')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, role), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  lessons_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'moderation' CHECK(status IN ('moderation','studying','completed','rejected')),
  student_track TEXT NOT NULL DEFAULT 'student',
  metro TEXT,
  avatar_file_id TEXT,
  about_me TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  about_me TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS student_teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, teacher_id),
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS homeworks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  lesson_number INTEGER,
  is_bonus INTEGER NOT NULL DEFAULT 0 CHECK(is_bonus IN (0,1)),
  haircut_name TEXT,
  content_type TEXT NOT NULL CHECK(content_type IN ('photo','video','text','document')),
  file_id TEXT,
  text_content TEXT,
  revision_student_text TEXT,
  revision_student_file_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revision')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS homework_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL,
  file_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('photo','video','text','document')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS homework_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  status TEXT NOT NULL CHECK(status IN ('approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
  FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS homework_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL,
  author_user_id INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
  FOREIGN KEY(author_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS teacher_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_user_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(applicant_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS student_profile_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  new_full_name TEXT NOT NULL,
  new_phone TEXT NOT NULL,
  new_metro TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  admin_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by_max_user_id INTEGER,
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS app_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  payload TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(actor_user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  sender_user_id INTEGER NOT NULL,
  text_content TEXT,
  content_type TEXT NOT NULL CHECK(content_type IN ('text','photo','video','document','system')),
  file_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS private_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  request_key TEXT NOT NULL,
  subject TEXT NOT NULL CHECK(subject IN ('teacher','academy','other')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, request_key),
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS feedback_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  milestone INTEGER NOT NULL CHECK(milestone IN (5,10,15)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, milestone),
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS stored_files (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('homework','revision','avatar')),
  storage_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_users_max_user_id ON users(max_user_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_student_teachers_student ON student_teachers(student_id);
CREATE INDEX IF NOT EXISTS idx_student_teachers_teacher ON student_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_student ON homeworks(student_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_status ON homeworks(status);
CREATE INDEX IF NOT EXISTS idx_homework_files_homework ON homework_files(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_comments_homework ON homework_comments(homework_id, id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user ON app_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_unread ON app_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_teacher_applications_status ON teacher_applications(status);
CREATE INDEX IF NOT EXISTS idx_profile_edits_status ON student_profile_edits(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_student ON chat_messages(student_id, id);
CREATE INDEX IF NOT EXISTS idx_stored_files_owner ON stored_files(owner_user_id, purpose);
`

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  private connection!: Database.Database

  onModuleInit() {
    const configuredPath = process.env.DATABASE_PATH || './data/barber.db'
    const path = resolve(process.cwd(), configuredPath)
    mkdirSync(dirname(path), { recursive: true })
    this.connection = new Database(path)
    this.connection.pragma('journal_mode = WAL')
    this.connection.pragma('busy_timeout = 8000')
    this.connection.pragma('foreign_keys = ON')
    this.assertCompatibleDatabase()
    this.connection.exec(schema)
    this.connection.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) SELECT id, role FROM users WHERE role IS NOT NULL').run()
    this.logger.log(`SQLite database ready: ${path}`)
  }

  onModuleDestroy() {
    this.connection?.close()
  }

  get db(): any {
    return this.connection
  }

  transaction<T>(work: () => T) {
    return this.connection.transaction(work)()
  }

  private assertCompatibleDatabase() {
    const users = this.connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()
    if (!users) return
    const columns = this.connection.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
    const names = new Set(columns.map((column) => column.name))
    if (names.has('telegram_id') && !names.has('max_user_id')) {
      throw new Error('Legacy database detected: migrate users.telegram_id to users.max_user_id before starting Nest API.')
    }
  }
}
