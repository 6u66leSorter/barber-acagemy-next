import Database from 'better-sqlite3'
import { resolve } from 'node:path'

const databasePath = resolve(process.cwd(), process.env.DATABASE_PATH || './data/barber.db')
const database = new Database(databasePath)

try {
  const requiredTable = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()
  if (!requiredTable) throw new Error('База ещё не инициализирована. Сначала запустите API.')

  const addUser = database.prepare("INSERT OR IGNORE INTO users (max_user_id, username, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)")
  const addRole = database.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)')
  const findUser = database.prepare('SELECT id FROM users WHERE max_user_id = ?')

  const seed = database.transaction(() => {
    addUser.run(1000000001, 'demo_student', 'Демо', 'Ученик', 'student')
    addUser.run(1000000002, 'demo_teacher', 'Демо', 'Преподаватель', 'teacher')
    addUser.run(1000000003, 'demo_admin', 'Демо', 'Администратор', 'admin')

    const studentUserId = findUser.get(1000000001).id
    const teacherUserId = findUser.get(1000000002).id
    const adminUserId = findUser.get(1000000003).id
    addRole.run(studentUserId, 'student')
    addRole.run(teacherUserId, 'teacher')
    addRole.run(adminUserId, 'admin')

    database.prepare("INSERT OR IGNORE INTO students (user_id, full_name, phone, lessons_count, status, metro, about_me) VALUES (?, 'Демо Ученик', '+7 900 000-00-01', 10, 'studying', 'Тестовая станция', 'Обезличенный учебный профиль для проверки.')").run(studentUserId)
    database.prepare("INSERT OR IGNORE INTO teachers (user_id, full_name, about_me) VALUES (?, 'Демо Преподаватель', 'Обезличенный преподаватель для проверки.')").run(teacherUserId)

    const studentId = database.prepare('SELECT id FROM students WHERE user_id = ?').get(studentUserId).id
    const teacherId = database.prepare('SELECT id FROM teachers WHERE user_id = ?').get(teacherUserId).id
    database.prepare('INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES (?, ?)').run(studentId, teacherId)
    database.prepare("INSERT OR IGNORE INTO homeworks (student_id, lesson_number, is_bonus, content_type, text_content, haircut_name, status) VALUES (?, 1, 0, 'text', 'Тестовая работа без персональных данных.', 'Демо-стрижка', 'pending')").run(studentId)
    database.prepare("INSERT OR IGNORE INTO app_notifications (user_id, kind, body) VALUES (?, 'demo', 'Тестовое уведомление для проверки интерфейса.')").run(studentUserId)
  })

  seed()
  console.log(`Демо-данные подготовлены: ${databasePath}`)
} finally {
  database.close()
}
