# Аудит продукта и критерии готовности

Источник сравнения: архив `Дневник_Академии_для_программиста_2026_09_15.zip` и требования MAX-only версии. Матрица закрыта 21.09.2026 на отдельной временной БД и повторно проверена в Docker. Реальный запуск внутри мобильного MAX, публичный TLS и карточка бота остаются ручной приёмкой окружения, а не функцией репозитория.

| Функция | Роль | Поведение в архиве | Текущее ожидание | Отличие/риск | Критичность | План и критерий приёмки | Статус и подтверждение |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Публичный список | Гость | Витрина учеников | Поиск и карточки без авторизации | Приватность полей | high | Только активные ученики, без phone/MAX ID/username | **done** — smoke: guest privacy; ручной DOM: 3 карточки и поиск |
| Публичная карточка | Гость | Профиль и одобренные работы | Метро, описание, преподаватели, рейтинг, медиа | Полнота и пустые состояния | medium | Карточка показывает только approved и закрывается тремя способами | **done** — ручной DOM/скриншот, Escape проверен |
| Публичные файлы | Гость | Просмотр опубликованных работ | Файлы без MAX auth | Выдача pending/чужого файла | critical | Pending — 404; approved активного ученика — 200 | **done** — API smoke с реальным PNG |
| Onboarding | Без роли | Регистрация/заявка | Выбор ученик или преподаватель | Повторная отправка и модерация | high | Валидная форма, понятная ошибка, закрытые вкладки недоступны | **done** — frontend review + smoke регистрации |
| Регистрация ученика | Без роли | Создание профиля | Профиль moderation | Конфликт и обновление сессии | high | Повторная регистрация отклоняется, сессия обновляется | **done** — API smoke |
| Заявка преподавателя | Без роли | Заявка администратору | Pending application | Повтор и решение | high | Заявка появляется у администратора, решение аудируется | **done** — API smoke |
| Профиль и аватар | Ученик | Редактирование данных и фото | About, avatar, moderation edit | Владелец файла и UX | high | Чужой file_id запрещён, фото отображается после загрузки | **done** — file unit tests + UI review |
| Создание ДЗ | Ученик | Текст/файл/урок | Реальные файлы и предотвращение дубля | Форматы и double submit | critical | JPEG/PNG/WebP/MP4/MOV/PDF и text; дубль pending запрещён | **done** — signature unit tests, smoke PNG, disabled submit |
| Вложения ДЗ | Ученик | Несколько материалов | Дополнительные файлы | Доступ и порядок | high | Только владелец добавляет, teacher — по назначению | **done** — role/file tests и endpoint review |
| Редактирование ДЗ | Ученик | Правка незавершённой работы | Только pending/revision | Закрытые статусы | high | Approved/rejected нельзя менять | **done** — homework unit tests |
| Доработка | Ученик | Повторная отправка | Текст и файл revision | Статусный переход | high | Только revision → pending, преподаватель уведомлён | **done** — homework unit tests + smoke workflow |
| Комментарии | Ученик/преподаватель | История рядом с работой | Общая карточка работы | Доступ и расположение формы | high | Только участники/админ, форма рядом с выбранной работой | **done** — smoke + ручной DOM карточки |
| Уведомления | Все роли | События и прочтение | Список/read/retention | Срок и получатель | high | Internal user_id, mark-read и очистка по env | **done** — notifications unit tests + smoke |
| Milestones | Ученик | Отзыв после 5/10/15 уроков | Уведомление один раз | Повторные приглашения | medium | Ровно одно приглашение на каждый порог | **done** — notifications/homework unit tests |
| Приватная обратная связь | Ученик/админ | Сообщение академии | Форма и очередь администратора | Публичная выдача | medium | Сообщение доступно только администратору | **done** — API smoke + guest privacy check |
| Список учеников | Преподаватель | Только назначенные | Все назначенные, включая без pending | Утечка персональных полей | critical | Нет phone/MAX ID/username; неназначенный отсутствует | **done** — smoke + ручной DOM: 3 назначенных ученика |
| Дашборд | Преподаватель | Сводка и очередь | Счётчики, последняя работа | Согласованность | medium | Значения совпадают с очередью и назначениями | **done** — smoke + ручной UI |
| Проверка работы | Преподаватель | Оценка 1–5 и отзыв | Approve/revision | Назначение и диапазон | critical | Чужая работа — 403, rating вне 1..5 — 400 | **done** — homework unit tests + smoke |
| Чат | Ученик/преподаватель | Диалог по назначению | Internal users.id | Ранее была IDOR/утечка | critical | Чужой тред — 403, peers ролевые, без персональных полей | **done** — chat unit tests + двусторонний smoke |
| CHAT_ENABLED | Все роли | Настройка | Отключение чата | Фактическое применение | medium | false возвращает 503 для list/read/send | **done** — chat unit tests |
| Admin dashboard | Админ | Сводка академии | Счётчики и последние работы | Полнота | medium | Данные соответствуют БД | **done** — API smoke + UI review |
| Карточка ученика | Админ | Полные данные и история | Просмотр/редактирование | API/UI | high | Изменения сохраняются, audit создаётся | **done** — admin unit tests + smoke |
| Пользователи и роли | Админ | Создание и изменение | Student/teacher actions | Защита и конфликт | critical | Не-admin — 403; повторы обрабатываются предсказуемо | **done** — admin unit tests + smoke 403 |
| Назначения | Админ | Назначить/снять преподавателя | Assignment UI/API | Уведомления и audit | high | Связь, peers, уведомление и audit обновляются | **done** — admin unit tests + smoke |
| Модерация | Админ | Заявки и правки профиля | Approve/reject | Обе ветви | high | Статус, профиль, роли, audit и уведомления согласованы | **done** — API smoke |
| Файловая безопасность | Все роли | Локальные uploads | UUID, magic signature, owner binding | Traversal/MIME/size/orphans | critical | Невалидный файл отклонён; чужой ID запрещён; rollback чистит файл | **done** — files unit tests + smoke |
| MAX strict auth | Все роли | Проверка init data | HMAC, age, duplicate params | Граница доверия | critical | Алгоритм MAX; demo-header не работает в production | **done** — MAX unit tests + strict smoke; мобильная подпись в deployment-checklist |
| Demo seed | Эксперт | Набор примеров | Все роли и статусы | Полнота/идемпотентность | high | Два запуска не дублируют данные; изменения эксперта сохраняются | **done** — smoke дважды запускает seed |
| Персистентность | Все роли | SQLite и uploads | Docker volume | Restart | high | Обычный down/up сохраняет; reset документирован только для demo | **done** — smoke restart + Compose volume review |
| Адаптивность | Все роли | Мобильный интерфейс | 320/375/430/768 px | Nav/modal и horizontal scroll | high | CSS breakpoint review, safe-area, fixed nav padding, без технического overflow | **done** — ручной UI/DOM и CSS review; мобильный MAX остаётся deployment acceptance |
| Темы | Все роли | Светлая тема архива | Light/dark + persistence | Контраст и MAX chrome | medium | Обе темы читаемы, выбор сохраняется | **done** — ручной UI + localStorage/code review |
| Состояния интерфейса | Все роли | Базовые формы | Loading/empty/error/success | Double submit | high | Кнопки блокируются, ошибки и empty-state объясняют действие | **done** — component review + ручной DOM |
| Docker | Проверяющий | Ручной запуск | Одна команда | Docker Hub зависит от сети | high | Compose valid, build и runtime health успешны | **done** — build 2 мин; api healthy; seed exit 0; web `/api/health` 200 |
| Документация | Проверяющий | Частичные инструкции | README + demo/production runbooks | Расхождение с кодом | high | Команды, env и сценарии сверены с реализацией | **done** — README, runbooks, testing guide и эта матрица обновлены |

## Осознанно вне области переноса

- Telegram, VK и web-login.
- Связка аккаунтов между разными мессенджерами.
- Push-деплой и изменение удалённого репозитория без отдельного разрешения.

## Обязательный финальный прогон

```bash
npm ci
npm test
npm run lint
npm run build
docker compose -f docker-compose.yml -f docker-compose.local.yml config --quiet
```

Фактический результат 21.09.2026: 6 Jest suites / 24 tests прошли, API smoke завершился `PASS`, lint и production build прошли, Compose валиден, образы собраны, `api` получил статус `healthy`, seed завершился с кодом 0, а `http://localhost:8080/api/health` вернул 200. Визуально проверены светлая тема, навигация всех ролей, гостевая витрина, карточка портфолио, изображения и закрытие модального окна по Escape на отдельной временной БД.
