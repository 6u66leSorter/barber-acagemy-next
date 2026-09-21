# Режимы запуска MADCAP MAX Mini App

Все команды выполняются из корня репозитория:

```bash
cd /Users/aleinikov/WebstormProjects/barber-academy-next
```

## 1. Локальное демо — рекомендуемый режим разработки

Требуется запущенный Docker Desktop.

```bash
npm run demo:docker
```

Открыть: http://localhost:8080

В этом режиме:

- MAX-подпись отключена только внутри local Compose;
- включён переключатель ролей;
- автоматически создаются обезличенные demo-данные;
- доступны роли ученика, преподавателя и администратора;
- гостевое портфолио открывается через «Портфолио».

Остановка с сохранением данных:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

Сброс только локальной demo-базы:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down -v
npm run demo:docker
```

## 2. Раздельная разработка frontend/backend без Docker

Установка зависимостей:

```bash
npm ci
```

Терминал 1 — API с локальной авторизацией:

```bash
MAX_WEBAPP_AUTH=off DEV_MAX_USER_ID=1000000001 npm run dev -w backend
```

Терминал 2 — React/Vite:

```bash
VITE_DEMO_MODE=true npm run dev -w frontend
```

Открыть: http://localhost:5173

Если нужны demo-записи в локальной SQLite:

```bash
npm run db:seed-demo
```

API работает на `8787`, Vite — на `5173`; Vite проксирует `/api` в API.

## 3. Локальная проверка настоящей MAX-аутентификации

Используется только для проверки подписанного запуска MAX. В терминале API не отключайте авторизацию:

```bash
MAX_WEBAPP_AUTH=strict MAX_BOT_TOKEN='ваш_токен_только_локально' npm run dev -w backend
```

Frontend запускается без demo-режима:

```bash
npm run dev -w frontend
```

Для открытия на телефоне нужен публичный HTTPS-туннель к порту `5173`, например Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:5173
```

URL `https://...trycloudflare.com` нужно временно указать как URL Mini App в карточке MAX-бота. MAX должен открывать приложение именно по этому HTTPS-адресу. Для стабильной проверки используйте собственный домен и серверный reverse proxy.

## 4. Production Docker на сервере

Создайте `.env` только на сервере:

```bash
cp .env.example .env
```

Заполните:

```dotenv
MAX_BOT_TOKEN=рабочий_токен_MAX
MAX_WEBAPP_AUTH=strict
MAX_INIT_DATA_MAX_AGE_SEC=3600
CHAT_ENABLED=true
APP_NOTIFICATIONS_RETENTION_DAYS=90
```

Запуск:

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8080/api/health
```

Production web-контейнер нужно опубликовать через HTTPS reverse proxy на домене, например `https://max-quiz.ru/`. Подробная схема с Caddy находится в [MAX_DEPLOYMENT.md](MAX_DEPLOYMENT.md).

В MAX указывается только публичный HTTPS URL. Локальный переключатель ролей в strict production отсутствует.

## 5. Проверка качества перед сдачей

```bash
npm run lint
npm run build
```

Проверить локальный API:

```bash
curl http://localhost:8080/api/health
```

Остановить production Compose без удаления SQLite:

```bash
docker compose down
```

Не использовать `docker compose down -v` на production: команда удалит volume с базой.
