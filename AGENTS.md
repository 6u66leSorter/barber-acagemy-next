# AGENTS.md

## Project overview

MADCAP Barber Academy is a MAX Mini App for students, teachers,
administrators, and guests. A Fastify API uses a local SQLite database. MAX is
the only supported messenger platform. A browser-only development mode and a
public guest portfolio are retained for local testing and public viewing.

## Source of truth

- `index.html` and `src/main.js`: main frontend entry points.
- `src/newFrontApp.js`: main UI, client-side state, navigation, and API calls.
- `src/index.css`: active styles; it imports `files_new/styles.css`.
- `bot/maxWebAppAuth.js`: MAX Mini App init-data validation.
- `bot/apiServer.js`: Fastify HTTP API.
- `bot/database.js`: SQLite schema initialization and migrations.
- `bot/dbService.js`: database queries and domain operations.
- `PROJECT_CONTEXT.md`: product and architecture overview for this version.
- `docs/DECISIONS.md` and `docs/WORK_LOG.md`: implementation decisions and
  feature history; verify claims against the code before relying on them.
- `docs/db/schema.dbml`: database documentation; verify it against runtime
  migrations before treating it as complete.
- `testing/atac/`: manual Postman/ATAC integration scenarios.

## Runtime and package management

- Use npm for the root application.
- Use `npm ci` for reproducible root dependency installation.
- Do not update dependency versions or replace `package-lock.json` without an
  explicit reason and approval.
- The locked toolchain requires Node.js 20.19+ or 22.12+; prefer one agreed,
  fixed Node version for development and deployment.

## Common commands

Root frontend:

- `npm run dev`: start the Vite development server.
- In Vite development mode, `?preview=demo` opens the role selector and
  `?guest=1` opens the public portfolio.
- `npm run dev:local`: start Vite with a sanitized browser-only local user ID
  and connect it to the API on port 8787. This mode is unavailable in a
  production build.
- `npm run dev:max`: expose Vite on the local network and proxy `/api` to port
  8787; normally pair this with an HTTPS tunnel to port 5173.
- `npm run preview:max`: serve the production build on port 4173 and proxy
  `/api` to port 8787. Prefer this over tunneling the Vite development server.
- `npm run build`: create the production frontend in `dist/`.
- `npm run preview`: serve the production build locally.
- `npm run lint`: lint the root JavaScript project.

Backend:

- `npm run api`: start the Fastify API on port 8787 by default.
- `npm run api:local`: start the API with MAX WebApp authentication
  disabled. Use only with a disposable local database.
- `npm run api:max`: start the API with strict signed MAX init-data validation.
- `npm run max:check-token`: validate the local MAX token against the official
  MAX `GET /me` endpoint without printing the token.
- `npm run db:*`: inspect or modify the local SQLite database; review the exact
  script before running it.
- `npm run db:backup`: copy the current SQLite database into `data/backups/`.

There is no automated unit-test or type-check script. `testing/atac/` contains
manual API scenarios that modify the local database.

## Important side effects

- Importing `bot/database.js`, including through the API, CLI, or setup
  scripts, creates `data/barber.db` and automatically runs migrations.
- API tests can create users, role assignments, homework, reviews,
  notifications, and audit entries.
- Database setup and delete commands modify local data.
- Build commands write generated output to `dist/`.
- Deployment commands change external infrastructure and must not be run
  without explicit approval.

Back up a valuable database before starting code that can run migrations.

## Environment variables

Never commit real values. Use `.env` locally and keep only placeholders in
`.env.example`.

Secrets:

- `MAX_BOT_TOKEN`: MAX bot token used only by the API to validate init data.

Configuration:

- `API_PORT` or `PORT`: API port; default is 8787.
- `VITE_API_BASE_URL`: frontend API origin; empty means same origin.
- `VITE_LOCAL_USER_ID`: positive local test-user ID. It is honored only by the
  Vite development server, never by a production build.
- `MAX_INIT_DATA_MAX_AGE_SEC`: maximum accepted age of MAX init data; default
  is 3600 seconds.
- `MAX_WEBAPP_AUTH`: `strict` by default; `off` is allowed only locally.
- `MAX_HOMEWORK_UPLOAD_MB`: upload-size limit.
- `CHAT_ENABLED`: enables or disables chat.
- `APP_NOTIFICATIONS_RETENTION_DAYS`: notification retention period.
- `API_PREFIX_STRIP_REWRITE`: compatibility switch for an nginx proxy setup.

## Security rules

- Never print, commit, or paste secret values into logs, documentation, tests,
  source files, or frontend environment variables.
- Never commit `data/`, database files, uploads, backups, real environment
  files, IDE state, dependency directories, or generated builds. A sanitized
  `.env.example` containing names and placeholders only is allowed.
- Treat MAX IDs, names, usernames, phone numbers, messages,
  homework, and uploaded media as personal data.
- The MAX IDs in
  `testing/atac/barber-academy.environment.postman.json` are sanitized,
  sequential placeholders. Replace them only in a local, ignored environment
  when tests need real accounts; do not commit personal IDs.
- Use `MAX_WEBAPP_AUTH=off` only for isolated local smoke tests. Production
  must use `MAX_WEBAPP_AUTH=strict` and a restricted CORS policy.
- Validate role checks whenever changing API endpoints.
- Keep file-path containment and upload validation intact when changing file
  handling.

## Code conventions

- Preserve ES module syntax in the root application and backend.
- Follow the existing semicolon-free style in root source files.
- Keep user-facing messages in Russian unless the surrounding interface uses
  another language.
- Reuse existing helpers for API responses, validation, authorization, and DB
  access instead of duplicating them.
- Use parameterized SQLite statements; never build SQL from user input.
- Keep MAX Bridge behavior and signed init-data validation working.
- Avoid broad refactors of `src/newFrontApp.js` or `bot/apiServer.js` while
  making an unrelated fix.

## Verification expectations

For ordinary root-code changes, run after dependencies are installed:

1. `npm run lint`
2. `npm run build`

For backend changes, obtain approval before starting the API because database
creation and migrations are automatic. Use a disposable local database for
manual API scenarios.

## Deployment

Automatic GitHub Actions deployment is currently disabled in
`.github/workflows/deploy.yml`. There is no active server. Do not re-enable the
workflow, run `deploy.sh`, configure SSH secrets, create a
remote repository, or push changes without explicit approval.

Before re-enabling deployment, review the server path, nginx behavior, PM2
configuration, database backup procedure, repository branch, SSH host, and all
production secrets.
