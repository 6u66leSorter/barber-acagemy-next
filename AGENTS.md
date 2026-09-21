# AGENTS.md

## Project overview

MADCAP Barber Academy is a MAX-only Mini App for students, teachers,
administrators, and public guests.

- `frontend/`: React, TypeScript, and Vite.
- `backend/`: NestJS, TypeScript, and SQLite.
- `docker/`: Nginx frontend hosting and `/api` proxy.
- `testing/api-smoke.mjs`: isolated end-to-end API smoke test.

Files under root `src/`, `bot/`, and `files_new/` are historical migration
references. They are not part of the active build or Docker runtime. Do not
extend them with new product behavior.

## Source of truth

- `frontend/src/App.tsx`: routes and role guards.
- `frontend/src/pages/`: role workflows.
- `frontend/src/components/`: shared UI and layout.
- `frontend/src/platform/max.ts`: MAX bridge and demo identity selection.
- `backend/src/app.module.ts`: backend composition.
- `backend/src/auth/`: strict MAX init-data validation and current user.
- `backend/src/database/database.service.ts`: schema and runtime migrations.
- `backend/src/*/*.service.ts`: domain rules and parameterized SQL.
- `backend/src/files/`: upload validation and protected file delivery.
- `backend/scripts/seed-demo.mjs`: idempotent, non-destructive demo data.
- `docs/PRODUCT_AUDIT.md`: acceptance matrix and verification evidence.

## Package management and runtime

Use npm from the repository root. Do not replace `package-lock.json` or update
dependencies without an explicit reason. The supported runtime is Node.js 20.

Common commands:

- `npm ci`: reproducible dependency installation.
- `npm run dev`: run the active Nest and React development servers.
- `npm test`: run backend Jest suites.
- `npm run lint`: lint active frontend and backend workspaces.
- `npm run build`: build active frontend and backend workspaces.
- `npm run test:smoke`: run the isolated API smoke scenario.
- `npm run demo:docker`: build and start the full local demo.
- `npm run db:seed-demo`: seed the configured database without clearing it.
- `npm run max:check-token`: call MAX `GET /me` without printing the token.

## Data and side effects

- Starting the API creates or migrates the configured SQLite database.
- Demo seed is idempotent and must not erase existing data.
- Tests must use a disposable `DATABASE_PATH` and `UPLOAD_DIR`.
- A valuable database must be backed up together with uploads before migration.
- `docker compose down` preserves the named volume; `down -v` destroys it.
- Do not run `down -v` against production or an unidentified Compose project.

Never commit databases, WAL/SHM files, uploads, backups, `.env`, generated
builds, IDE state, or dependency directories.

## Environment

Secrets:

- `MAX_BOT_TOKEN`: server-only MAX bot token.

Configuration:

- `MAX_WEBAPP_AUTH`: `strict` in production, `off` only for local demo.
- `MAX_INIT_DATA_MAX_AGE_SEC`: accepted init-data age; default `3600`.
- `API_PORT` or `PORT`: API port; default `8787`.
- `DATABASE_PATH`: SQLite file path.
- `UPLOAD_DIR`: protected upload directory.
- `MAX_HOMEWORK_UPLOAD_MB`: upload limit capped at 50 MB.
- `CORS_ORIGINS`: comma-separated frontend origins.
- `CHAT_ENABLED`: chat feature flag.
- `APP_NOTIFICATIONS_RETENTION_DAYS`: notification retention.
- `VITE_API_URL`: frontend API base URL when not using same-origin `/api`.
- `VITE_DEMO_MODE`: build-time local role switch; never enable in production.

Keep placeholders only in `.env.example` and `backend/.env.example`.

## Security invariants

- MAX ID is an external authentication identifier only. Domain relations use
  internal `users.id` and student/teacher primary keys.
- Production requires signed, fresh MAX init data. `X-Max-User-Id` must not
  authenticate a production request.
- Guest endpoints expose only approved work of active students and never phone,
  MAX ID, username, private comments, feedback, notifications, or chat.
- Student/teacher chat is limited to current assignments. Foreign threads must
  return `403`.
- Teacher APIs must not expose student phone, MAX ID, or username unless a new
  documented scenario explicitly requires it.
- Admin endpoints require the `admin` role.
- SQL containing user input must be parameterized.
- Uploads require an allowed MIME type, matching magic signature, size limit,
  opaque storage name, owner binding, and path containment.
- Do not print, paste, or commit tokens or personal identifiers.

## Code conventions

- Preserve TypeScript and ES modules in active workspaces.
- Keep user-facing text in Russian.
- Controllers handle HTTP/DTO concerns; services enforce domain access and data
  rules. Reuse existing auth, role, response, notification, and file helpers.
- Frontend pages use the shared API client and reusable loading/error/empty
  components. Disable submissions while requests are active.
- Keep mobile MAX layout, safe-area padding, keyboard access, and both themes.
- If an API contract changes, update frontend, tests, and documentation in the
  same change.

## Verification

For active code changes run, at minimum:

1. `npm test`
2. `npm run lint`
3. `npm run build`
4. `npm run test:smoke` for backend/data/auth changes
5. `docker compose -f docker-compose.yml -f docker-compose.local.yml config --quiet`

For release readiness, also build and start Compose, verify `/api/health`, and
manually inspect the affected role in the browser on disposable data.

## Documentation and deployment

Keep these synchronized with code:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/FUNCTIONAL_PARITY.md`
- `docs/DEMO_SCENARIOS.md`
- `docs/PRODUCTION_USER_SCENARIOS.md`
- `docs/PRODUCT_AUDIT.md`
- `docs/MAX_DEPLOYMENT.md`
- `docs/RUN_MODES.md`

Do not push, deploy, rewrite Git history, enable automatic deployment, configure
external infrastructure, or mutate a production database without explicit
permission. Automatic deployment remains disabled.
