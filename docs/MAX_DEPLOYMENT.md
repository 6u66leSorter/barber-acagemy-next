# Запуск MAX Mini App на сервере

Инструкция рассчитана на Linux-сервер с Docker Compose и доменом, например `max-quiz.ru`.

## Что подготовить

- сервер с публичными портами `80` и `443`;
- DNS-запись `A` для домена на IP сервера;
- GitHub-доступ к репозиторию;
- токен MAX-бота;
- URL, который будет указан в настройках Mini App MAX.

`localhost`, адрес из локальной сети и обычный HTTP для MAX не подходят: Mini App должен открываться по публичному HTTPS.

## 1. Установить Docker на сервере

Установите Docker Engine и Compose Plugin по официальной инструкции для ОС сервера. Проверьте:

```bash
docker --version
docker compose version
```

## 2. Получить код

Выберите зафиксированный commit из ветки `refactor/nest-react`, а не плавающий код разработки:

```bash
git clone https://github.com/6u66leSorter/barber-acagemy-next.git
cd barber-academy-next
git checkout refactor/nest-react
```

Перед финальной сдачей лучше заменить checkout ветки на конкретный commit hash.

## 3. Создать production `.env`

```bash
cp .env.example .env
nano .env
```

Минимальные значения:

```dotenv
MAX_BOT_TOKEN=рабочий_токен_MAX_бота
MAX_WEBAPP_AUTH=strict
MAX_INIT_DATA_MAX_AGE_SEC=3600
API_PORT=8787
CHAT_ENABLED=true
APP_NOTIFICATIONS_RETENTION_DAYS=90
```

Токен не добавляйте в GitHub, README, frontend или Dockerfile.

## 4. Запустить контейнеры

```bash
docker compose up -d --build
docker compose ps
```

Проверка API изнутри сервера:

```bash
curl http://127.0.0.1:8080/api/health
```

Ожидаемый ответ:

```json
{"ok":true,"service":"barber-academy-api"}
```

Production Compose хранит SQLite в volume `barber_data`. Для обновления не используйте `down -v`: это удалит базу.

## 5. Подключить HTTPS

Текущий Compose отдаёт приложение на внутреннем HTTP-порту контейнера. Перед ним нужен reverse proxy (Caddy, nginx или панель хостинга), который:

- слушает `443`;
- получает сертификат для домена;
- проксирует весь трафик на web-контейнер;
- сохраняет путь `/api/*` без переписывания в другой внешний адрес.

Пример для Caddy при публикации web-контейнера только на localhost:

```yaml
# docker-compose.override.yml на сервере
services:
  web:
    ports:
      - "127.0.0.1:8080:80"
```

```text
# /etc/caddy/Caddyfile
max-quiz.ru {
    reverse_proxy 127.0.0.1:8080
}
```

После перезапуска Caddy проверьте:

```bash
curl -I https://max-quiz.ru
curl https://max-quiz.ru/api/health
```

## 6. Указать URL в MAX

В настройках MAX-бота откройте карточку бота и настройку Mini App/Web App. Укажите публичный URL:

```text
https://max-quiz.ru/
```

Сохраните настройки и откройте Mini App именно из MAX. В строгом режиме приложение принимает только подписанные MAX init data; прямое открытие в браузере не имитирует авторизацию MAX.

Backend проверяет подпись по [официальной схеме MAX](https://dev.max.ru/docs/webapps/validation): сортирует параметры, исключает `hash`, получает секрет через HMAC-SHA256 с ключом `WebAppData`, сравнивает подпись без утечки времени и контролирует возраст данных запуска.

## 7. Проверка ролей

- Гость: откройте публичное портфолио.
- Ученик: зарегистрируйте MAX-пользователя, создайте ДЗ, проверьте уведомление и статус.
- Преподаватель: назначьте его администратором/преподавателем в БД или через админский сценарий, откройте очередь, поставьте оценку и отзыв.
- Администратор: проверьте учеников, работы, заявки и журнал.

Локальный переключатель ролей (`VITE_DEMO_MODE=true`) в production отсутствует намеренно.

## Обновление и откат

Перед обновлением:

```bash
docker run --rm -v barber_data:/data -v "$PWD/backups:/backup" alpine \
  sh -c 'tar czf /backup/barber-data-$(date +%Y%m%d-%H%M%S).tgz -C /data .'
```

После проверки кода:

```bash
git fetch origin
git checkout <фиксированный-commit>
docker compose up -d --build
```

Для остановки без удаления данных:

```bash
docker compose down
```
