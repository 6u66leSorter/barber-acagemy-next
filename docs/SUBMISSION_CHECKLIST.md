# Чек-лист перед сдачей

## В репозитории

- [x] README описывает назначение, архитектуру, запуск, переменные, порты, данные, сценарии и ограничения.
- [x] `package-lock.json` фиксирует зависимости.
- [x] Есть `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml`, `docker-compose.local.yml` и `.dockerignore`.
- [x] Есть шаблоны `.env.example` и `backend/.env.example` без секретов.
- [x] Есть обезличенный скрипт `backend/scripts/seed-demo.mjs`.

## Перед отправкой организаторам

- [ ] Запустить Docker Desktop и пройти команду из README с нуля.
- [x] Открыть `http://localhost:8080`, выполнить demo-seed и проверить три API-роли.
- [ ] Развернуть production API и frontend по HTTPS.
- [ ] Указать production URL в карточке MAX-бота и открыть Mini App с телефона.
- [ ] Задать в production `MAX_WEBAPP_AUTH=strict`, `MAX_BOT_TOKEN` и ограниченный `CORS_ORIGINS`.
- [x] Убедиться, что в Git отсутствуют `.env`, SQLite-база, uploads и рабочие секреты.
- [ ] Зафиксировать финальный commit hash или создать аннотированный тег.
- [ ] После дедлайна не изменять зафиксированную ветку/тег.

## Что не является подтверждением готовности

Локальный Docker-проход не заменяет открытие Mini App из MAX. Проверку MAX можно считать завершённой только после реального HTTPS-размещения и запуска из мессенджера.
