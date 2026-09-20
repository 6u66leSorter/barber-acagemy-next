import 'dotenv/config'

const token = process.env.MAX_BOT_TOKEN
if (!token) {
  console.error('MAX_BOT_TOKEN не задан в backend/.env')
  process.exit(1)
}

const response = await fetch('https://platform-api.max.ru/users/@me', { headers: { Authorization: token } })
if (!response.ok) {
  console.error(`MAX API вернул HTTP ${response.status}. Проверьте токен и сетевое подключение.`)
  process.exit(1)
}
const bot = await response.json()
console.log(`Токен действителен. Бот: ${bot.name || bot.username || bot.user_id || 'без имени'}`)
