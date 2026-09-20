import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const maxCaPath = join(scriptDir, '..', 'certs', 'russian_trusted_root_ca.pem')

const token = String(process.env.MAX_BOT_TOKEN || '').trim()

if (!token) {
  console.error('MAX_BOT_TOKEN не задан в .env')
  process.exit(1)
}

/** Передаём секрет curl через stdin, чтобы он не попадал в аргументы процесса. */
const safeToken = token.replace(/["\r\n]/g, '')
const curlConfig = [
  'silent',
  'show-error',
  `header = "Authorization: ${safeToken}"`,
  'write-out = "\\n__HTTP_STATUS__:%{http_code}"',
].join('\n')

const result = spawnSync(
  'curl',
  ['--cacert', maxCaPath, '--config', '-', 'https://platform-api2.max.ru/me'],
  {
    input: curlConfig,
    encoding: 'utf8',
  },
)

if (result.status !== 0) {
  console.error('Не удалось подключиться к MAX API.')
  const lastErrorLine = String(result.stderr || '').trim().split('\n').at(-1)
  if (lastErrorLine) console.error(lastErrorLine)
  process.exit(2)
}

const marker = '\n__HTTP_STATUS__:'
const markerPosition = result.stdout.lastIndexOf(marker)
const rawBody = markerPosition >= 0 ? result.stdout.slice(0, markerPosition) : result.stdout
const status = markerPosition >= 0 ? Number(result.stdout.slice(markerPosition + marker.length)) : 0

let body = null
try {
  body = JSON.parse(rawBody)
} catch {
  // Не печатаем неожиданный ответ целиком: в нём могут оказаться лишние данные.
}

if (status === 200 && body?.is_bot === true) {
  console.log('Токен MAX действителен.')
  console.log(`Бот: ${body.first_name || body.name || 'без имени'}`)
  console.log(`Ник: ${body.username || 'не задан'}`)
  process.exit(0)
}

if (status === 401) {
  console.error('Токен MAX недействителен или отозван (HTTP 401).')
  process.exit(1)
}

console.error(`MAX API вернул неожиданный ответ (HTTP ${status || 'unknown'}).`)
process.exit(2)
