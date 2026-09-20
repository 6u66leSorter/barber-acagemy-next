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
  const findStudent = database.prepare('SELECT id FROM students WHERE user_id = ?')
  const findTeacher = database.prepare('SELECT id FROM teachers WHERE user_id = ?')
  const findHomework = database.prepare('SELECT id FROM homeworks WHERE student_id = ? AND haircut_name = ?')

  const seed = database.transaction(() => {
    addUser.run(1000000001, 'demo_student', 'Демо', 'Ученик', 'student')
    addUser.run(1000000002, 'demo_teacher', 'Демо', 'Преподаватель', 'teacher')
    addUser.run(1000000003, 'demo_admin', 'Демо', 'Администратор', 'admin')
    addUser.run(1000000011, 'demo_student_two', 'Анна', 'Модель', 'student')
    addUser.run(1000000012, 'demo_student_three', 'Илья', 'Барбер', 'student')

    const studentUserIds = [1000000001, 1000000011, 1000000012].map((id) => findUser.get(id).id)
    const teacherUserId = findUser.get(1000000002).id
    const adminUserId = findUser.get(1000000003).id
    studentUserIds.forEach((id) => addRole.run(id, 'student'))
    addRole.run(teacherUserId, 'teacher')
    addRole.run(adminUserId, 'admin')

    const studentProfiles = [
      [studentUserIds[0], 'Демо Ученик', '+7 900 000-00-01', 10, 'Тестовая станция', 'Отрабатываю базовые мужские стрижки и форму бороды.'],
      [studentUserIds[1], 'Анна Модель', '+7 900 000-00-11', 15, 'Центральная', 'Собираю портфолио по женским и универсальным формам.'],
      [studentUserIds[2], 'Илья Барбер', '+7 900 000-00-12', 20, 'Академическая', 'Фокус — fade, текстура и аккуратная работа с бородой.'],
    ]
    const addStudent = database.prepare("INSERT OR IGNORE INTO students (user_id, full_name, phone, lessons_count, status, metro, about_me) VALUES (?, ?, ?, ?, 'studying', ?, ?)")
    studentProfiles.forEach((profile) => addStudent.run(...profile))
    database.prepare("INSERT OR IGNORE INTO teachers (user_id, full_name, about_me) VALUES (?, 'Демо Преподаватель', 'Проверяю технику, форму и качество оформления работ.')").run(teacherUserId)

    const teacherId = findTeacher.get(teacherUserId).id
    const studentIds = studentUserIds.map((id) => findStudent.get(id).id)
    studentIds.forEach((studentId) => database.prepare('INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES (?, ?)').run(studentId, teacherId))

    const works = [
      [studentIds[0], 1, 'Демо-стрижка crop', 'demo-homework-crop.png', 'Текстурированный crop: проверка направления волос и чистоты окантовки.', 'approved', 5, 'Сильная форма и хороший контроль текстуры.'],
      [studentIds[0], 2, 'Демо-стрижка fade', 'demo-homework-fade.png', 'Плавный переход по бокам, нужно ещё доработать соединение с верхом.', 'pending', null, null],
      [studentIds[0], 3, 'Демо-борода', 'demo-homework-beard.png', 'Моделирование бороды с мягким переходом к вискам.', 'approved', 4, 'Хорошая симметрия, обратите внимание на линию щеки.'],
      [studentIds[1], 1, 'Мягкий переход', 'demo-student-barber.png', 'Работа с формой и объёмом. Фото после финальной укладки.', 'approved', 5, 'Отлично показана форма в финальном результате.'],
      [studentIds[1], 2, 'Контур и текстура', 'demo-homework-crop.png', 'Тестовая работа Анны для портфолио.', 'approved', 4, 'Аккуратный контур, добавьте больше текстуры.'],
      [studentIds[2], 1, 'Skin fade', 'demo-homework-fade.png', 'Текущая работа Ильи: переход требует проверки преподавателя.', 'pending', null, null],
      [studentIds[2], 2, 'Форма бороды', 'demo-homework-beard.png', 'Форма бороды и соединение с усами.', 'approved', 5, 'Точная форма и чистая работа с деталями.'],
    ]
    const addHomework = database.prepare("INSERT INTO homeworks (student_id, lesson_number, is_bonus, content_type, file_id, text_content, status, haircut_name) VALUES (?, ?, 0, 'photo', ?, ?, ?, ?)")
    const addReview = database.prepare("INSERT INTO homework_reviews (homework_id, teacher_id, rating, comment, status) VALUES (?, ?, ?, ?, 'approved')")
    const addComment = database.prepare('INSERT INTO homework_comments (homework_id, author_user_id, text_content) VALUES (?, ?, ?)')
    works.forEach(([studentId, lesson, haircut, fileId, textContent, status, rating, review]) => {
      const existing = findHomework.get(studentId, haircut)
      const homeworkId = existing?.id || Number(addHomework.run(studentId, lesson, fileId, textContent, status, haircut).lastInsertRowid)
      if (rating && !database.prepare('SELECT id FROM homework_reviews WHERE homework_id = ?').get(homeworkId)) addReview.run(homeworkId, teacherId, rating, review)
      if (status === 'approved' && !database.prepare('SELECT id FROM homework_comments WHERE homework_id = ?').get(homeworkId)) addComment.run(homeworkId, teacherUserId, review)
    })

    const addNotification = database.prepare("INSERT INTO app_notifications (user_id, kind, body) SELECT ?, 'demo', ? WHERE NOT EXISTS (SELECT 1 FROM app_notifications WHERE user_id = ? AND body = ?)")
    studentUserIds.forEach((id) => addNotification.run(id, 'Проверяйте новые комментарии к вашим работам.', id, 'Проверяйте новые комментарии к вашим работам.'))
  })

  seed()
  console.log(`Демо-данные подготовлены: ${databasePath}`)
} finally {
  database.close()
}
