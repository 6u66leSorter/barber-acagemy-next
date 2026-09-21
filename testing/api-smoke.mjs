import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'

const execFileAsync = promisify(execFile)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const requireFromBackend = createRequire(path.join(repositoryRoot, 'backend/package.json'))
const Database = requireFromBackend('better-sqlite3')
const studentMaxId = 1000000001
const teacherMaxId = 1000000002
const adminMaxId = 1000000003
const secondStudentMaxId = 1000000011
const registrationMaxId = 1000000099
const applicantMaxId = 1000000100
const contactToken = 'smoke-contact-token'

function signedContact(phone, userId) {
  const normalized = phone.replace(/\D/g, '').replace(/^8(?=\d{10}$)/, '7')
  const authDate = String(Math.floor(Date.now() / 1000))
  const check = `authDate=${authDate}\nphone=${normalized}\nuserId=${userId}`
  return { phone, auth_date: authDate, hash: crypto.createHmac('sha256', contactToken).update(check).digest('hex') }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

async function waitForHealth(baseUrl, child) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API stopped with exit code ${child.exitCode}`)
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // API has not opened the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('API health check timed out')
}

async function api(baseUrl, route, { maxId, method = 'GET', body, expected = 200 } = {}) {
  const headers = {}
  if (maxId) headers['x-max-user-id'] = String(maxId)
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json'
  const response = await fetch(`${baseUrl}/api${route}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.arrayBuffer()
  assert.equal(response.status, expected, `${method} ${route}: ${response.status} ${JSON.stringify(payload)}`)
  return payload
}

function assertNoPrivateIdentifiers(value, context) {
  const serialized = JSON.stringify(value)
  for (const field of ['phone', 'max_user_id', 'username']) {
    assert.equal(serialized.includes(`\"${field}\"`), false, `${context} exposes ${field}`)
  }
}

function seedSnapshot(databasePath) {
  const database = new Database(databasePath, { readonly: true })
  const tables = [
    'users',
    'user_roles',
    'students',
    'teachers',
    'student_teachers',
    'homeworks',
    'homework_reviews',
    'homework_comments',
    'app_notifications',
    'chat_messages',
    'teacher_applications',
    'student_profile_edits',
    'private_feedback',
    'feedback_milestones',
    'audit_log',
    'phone_role_invitations',
  ]
  try {
    return Object.fromEntries(tables.map((table) => [table, database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]))
  } finally {
    database.close()
  }
}

async function main() {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'barber-academy-smoke-'))
  const databasePath = path.join(temporaryDirectory, 'barber.db')
  const uploadDir = path.join(temporaryDirectory, 'uploads')
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const environment = {
    ...process.env,
    NODE_ENV: 'development',
    MAX_WEBAPP_AUTH: 'off',
    DATABASE_PATH: databasePath,
    UPLOAD_DIR: uploadDir,
    PORT: String(port),
    API_HOST: '127.0.0.1',
    CHAT_ENABLED: 'true',
    MAX_BOT_TOKEN: contactToken,
  }
  const child = spawn(process.execPath, ['backend/dist/main.js'], {
    cwd: repositoryRoot,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverOutput = ''
  child.stdout.on('data', (chunk) => { serverOutput += chunk })
  child.stderr.on('data', (chunk) => { serverOutput += chunk })

  try {
    await waitForHealth(baseUrl, child)
    await execFileAsync(process.execPath, ['backend/scripts/seed-demo.mjs'], { cwd: repositoryRoot, env: environment })
    const firstSeed = seedSnapshot(databasePath)
    await execFileAsync(process.execPath, ['backend/scripts/seed-demo.mjs'], { cwd: repositoryRoot, env: environment })
    const secondSeed = seedSnapshot(databasePath)
    assert.deepEqual(secondSeed, firstSeed, 'demo seed must be idempotent')
    assert.ok(firstSeed.users >= 5 && firstSeed.students >= 3 && firstSeed.teachers >= 1 && firstSeed.homeworks >= 7)

    const guest = await api(baseUrl, '/guest/portfolio-students')
    assert.equal(guest.data.students.length, 3, 'demo seed must expose three portfolio students')
    assertNoPrivateIdentifiers(guest, 'guest portfolio')

    const studentSession = await api(baseUrl, `/session?max_user_id=${studentMaxId}`, { maxId: studentMaxId })
    const teacherSession = await api(baseUrl, `/session?max_user_id=${teacherMaxId}`, { maxId: teacherMaxId })
    const adminSession = await api(baseUrl, `/session?max_user_id=${adminMaxId}`, { maxId: adminMaxId })
    assert.equal(studentSession.data.role, 'student')
    assert.equal(teacherSession.data.role, 'teacher')
    assert.equal(adminSession.data.role, 'admin')

    const teacherDashboard = await api(baseUrl, `/teacher/dashboard?max_user_id=${teacherMaxId}`, { maxId: teacherMaxId })
    assert.equal(teacherDashboard.data.students.length, 3, 'teacher must see every assigned demo student')
    assertNoPrivateIdentifiers(teacherDashboard, 'teacher dashboard')
    await api(baseUrl, `/admin/students?max_user_id=${studentMaxId}`, { maxId: studentMaxId, expected: 403 })

    const studentPeers = await api(baseUrl, `/chats/students?max_user_id=${studentMaxId}`, { maxId: studentMaxId })
    const teacherPeers = await api(baseUrl, `/chats/students?max_user_id=${teacherMaxId}`, { maxId: teacherMaxId })
    assert.equal(studentPeers.data.students.length, 1)
    assert.equal(teacherPeers.data.students.length, 3)
    assertNoPrivateIdentifiers(studentPeers, 'student chat peers')
    assertNoPrivateIdentifiers(teacherPeers, 'teacher chat peers')
    const teacherUserId = studentPeers.data.students[0].user_id
    const studentUserId = teacherPeers.data.students.find((item) => item.full_name === 'Демо Ученик').user_id
    const otherStudentUserId = teacherPeers.data.students.find((item) => item.full_name === 'Анна Модель').user_id
    assert.notEqual(teacherUserId, teacherMaxId, 'chat peer must use internal users.id, not MAX id')

    await api(baseUrl, '/chats/messages', {
      maxId: studentMaxId,
      method: 'POST',
      expected: 201,
      body: { max_user_id: studentMaxId, recipient_user_id: teacherUserId, text: 'Smoke: сообщение преподавателю' },
    })
    await api(baseUrl, '/chats/messages', {
      maxId: teacherMaxId,
      method: 'POST',
      expected: 201,
      body: { max_user_id: teacherMaxId, recipient_user_id: studentUserId, text: 'Smoke: ответ ученику' },
    })
    const conversation = await api(baseUrl, `/chats/messages?max_user_id=${studentMaxId}&peer_user_id=${teacherUserId}`, { maxId: studentMaxId })
    const conversationTexts = conversation.data.messages.map((message) => message.text_content)
    assert.ok(conversationTexts.includes('Smoke: сообщение преподавателю'))
    assert.ok(conversationTexts.includes('Smoke: ответ ученику'))
    await api(baseUrl, `/chats/messages?max_user_id=${studentMaxId}&peer_user_id=${otherStudentUserId}`, { maxId: studentMaxId, expected: 403 })

    const form = new FormData()
    const samplePath = path.join(repositoryRoot, 'frontend/public/demo-homework-crop.png')
    form.append('file', new Blob([await readFile(samplePath)], { type: 'image/png' }), 'smoke.png')
    const uploaded = await api(baseUrl, `/files/homework?max_user_id=${studentMaxId}`, { maxId: studentMaxId, method: 'POST', expected: 201, body: form })
    assert.ok(uploaded.data.file_id)
    const created = await api(baseUrl, '/homeworks', {
      maxId: studentMaxId,
      method: 'POST',
      expected: 201,
      body: { max_user_id: studentMaxId, lesson_number: 21, content_type: 'photo', file_id: uploaded.data.file_id, haircut_name: 'Smoke work', text_content: 'Проверка полного цикла файла' },
    })
    const homeworkId = created.data.homework.id
    await api(baseUrl, `/guest/homeworks/${homeworkId}/file`, { expected: 404 })
    await api(baseUrl, '/teacher/review', {
      maxId: teacherMaxId,
      method: 'POST',
      expected: 201,
      body: { max_user_id: teacherMaxId, homework_id: homeworkId, status: 'approved', rating: 5, comment: 'Smoke review' },
    })
    const publicFile = await api(baseUrl, `/guest/homeworks/${homeworkId}/file`)
    assert.ok(publicFile.byteLength > 0)

    const unknownSession = await api(baseUrl, `/session?max_user_id=${registrationMaxId}`, { maxId: registrationMaxId })
    assert.equal(unknownSession.data.hasUser, false)
    await api(baseUrl, '/students', {
      maxId: registrationMaxId,
      method: 'POST',
      expected: 410,
      body: { max_user_id: registrationMaxId, full_name: 'Smoke Student', phone: '+7 900 999-99-99', lessons_count: 10, metro: 'Тестовая' },
    })
    await api(baseUrl, '/access/verify-phone', {
      maxId: registrationMaxId,
      method: 'POST',
      expected: 201,
      body: { max_user_id: registrationMaxId, ...signedContact('+7 900 999-99-99', registrationMaxId) },
    })
    const guestOnlySession = await api(baseUrl, `/session?max_user_id=${registrationMaxId}`, { maxId: registrationMaxId })
    assert.equal(guestOnlySession.data.isGuest, true)
    assert.equal(guestOnlySession.data.role, null)
    await api(baseUrl, '/admin/phone-access', {
      maxId: adminMaxId,
      method: 'POST',
      expected: 201,
      body: { max_user_id: adminMaxId, phone: '+7 900 999-99-99', role: 'student', full_name: 'Smoke Student', lessons_count: 10, metro: 'Тестовая' },
    })
    const registeredSession = await api(baseUrl, `/session?max_user_id=${registrationMaxId}`, { maxId: registrationMaxId })
    assert.equal(registeredSession.data.student.status, 'studying')

    await api(baseUrl, '/student/profile-edit', {
      maxId: studentMaxId,
      method: 'POST',
      expected: 201,
      body: { max_user_id: studentMaxId, full_name: 'Демо Ученик Smoke', phone: '+7 900 000-00-01', metro: 'Тестовая станция' },
    })
    await api(baseUrl, '/student/feedback', {
      maxId: studentMaxId,
      method: 'POST',
      expected: 201,
      body: { max_user_id: studentMaxId, subject: 'academy', message: 'Smoke feedback' },
    })
    const profileEdits = await api(baseUrl, `/admin/profile-edits?max_user_id=${adminMaxId}`, { maxId: adminMaxId })
    const feedback = await api(baseUrl, `/admin/feedback?max_user_id=${adminMaxId}`, { maxId: adminMaxId })
    assert.ok(profileEdits.data.edits.some((item) => item.new_full_name === 'Демо Ученик Smoke'))
    assert.ok(feedback.data.feedback.some((item) => item.message === 'Smoke feedback'))

    await api(baseUrl, '/teacher-application', {
      maxId: applicantMaxId,
      method: 'POST',
      expected: 410,
      body: { max_user_id: applicantMaxId, full_name: 'Smoke Teacher', phone: '+7 900 111-22-33' },
    })
    await api(baseUrl, '/admin/phone-access', {
      maxId: adminMaxId,
      method: 'POST',
      expected: 201,
      body: { max_user_id: adminMaxId, phone: '+7 900 111-22-33', role: 'teacher', full_name: 'Smoke Teacher' },
    })
    await api(baseUrl, '/access/verify-phone', { maxId: applicantMaxId, method: 'POST', expected: 201, body: { max_user_id: applicantMaxId, ...signedContact('+7 900 111-22-33', applicantMaxId) } })
    const teacherByPhone = await api(baseUrl, `/session?max_user_id=${applicantMaxId}`, { maxId: applicantMaxId })
    assert.equal(teacherByPhone.data.role, 'teacher')

    const audit = await api(baseUrl, `/admin/audit?max_user_id=${adminMaxId}`, { maxId: adminMaxId })
    assert.ok(audit.data.entries.length > 0)

    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))

    const strictPort = await freePort()
    const strictBaseUrl = `http://127.0.0.1:${strictPort}`
    const strictChild = spawn(process.execPath, ['backend/dist/main.js'], {
      cwd: repositoryRoot,
      env: {
        ...environment,
        NODE_ENV: 'production',
        MAX_WEBAPP_AUTH: 'strict',
        MAX_BOT_TOKEN: 'smoke-invalid-token',
        PORT: String(strictPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      await waitForHealth(strictBaseUrl, strictChild)
      const persistedGuest = await api(strictBaseUrl, '/guest/portfolio-students')
      assert.equal(persistedGuest.data.students.length, 4, 'data created through phone access must survive API restart')
      await api(strictBaseUrl, `/session?max_user_id=${studentMaxId}`, { maxId: studentMaxId, expected: 401 })
    } finally {
      if (strictChild.exitCode === null && strictChild.signalCode === null) {
        strictChild.kill('SIGTERM')
        await new Promise((resolve) => strictChild.once('exit', resolve))
      }
    }

    console.log('API smoke: PASS')
    console.log(`Temporary database: ${databasePath}`)
  } catch (error) {
    console.error(serverOutput)
    throw error
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await new Promise((resolve) => child.once('exit', resolve)).catch(() => undefined)
    }
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

await main()
