# Verify: Stack & architecture · spec 0001 · updated 2026-11-11
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [x] `docker compose up -d --wait` → Postgres 17 healthy; `docker compose exec -T postgres psql -U eneba -lqt` lists `eneba` and `eneba_test` → AC-2
- [x] `cd client && npm ci && npm run typecheck` → exits 0, no errors → AC-1
- [x] `cd client && npm run build` → exits 0, writes `dist/` → AC-1
- [x] `cd client && npm run dev` → serves `http://localhost:5173/` with 200 → AC-1
- [x] `cd server && composer install && php artisan migrate` → migrations run against the compose Postgres (`eneba`) → AC-2
- [x] `cd server && php artisan serve` → `curl -i http://localhost:8000/up` returns 200 → AC-2
- [x] `cd server && php artisan test` → all Pest tests pass, including the one asserting the connection is `pgsql` / `eneba_test` → AC-2
- [x] `cd server && php artisan test --filter=DestructiveCommandGuard` → both tests pass: `db:wipe` is refused with "prohibited from running in this environment" when the app runs as production, and allowed in local. The test targets a throwaway in memory SQLite connection, so it never touches Postgres → AC-3 (prod safety guard from the stack table)

## Config review
- [x] `grep -rn "localhost\|VITE_API_URL" client/src` → the only API URL source is `import.meta.env.VITE_API_URL` in `client/src/lib/env.ts`; no hardcoded host → AC-3
- [x] Remove `VITE_API_URL` from `client/.env` and load the app → it fails loudly with "VITE_API_URL is not set" → AC-3 (headless option: `VITE_API_URL= npx vite build --outDir <tmp>`, then import the built `index-*.js` in Node with a stub `document`; it throws that message before React renders)
- [x] `client/.env.example` lists `VITE_API_URL` → AC-3
- [x] `server/.env.example` lists every key in the spec's *Configuration required*: `APP_KEY`, `APP_ENV`, `APP_DEBUG`, `APP_URL`, `DB_CONNECTION`, `DB_URL`, `FRONTEND_URL`, `CORS_PREVIEW_ORIGIN_PATTERN`, `CACHE_STORE`, `SESSION_DRIVER`, `QUEUE_CONNECTION`, `MAIL_MAILER`, `LOG_CHANNEL`, plus the container keys `PORT`, `AUTORUN_*`, `HEALTHCHECK_PATH`; no real secrets → AC-3
- [x] `git check-ignore client/.env server/.env` → both ignored → AC-3

## Acceptance-criteria coverage
- AC-1: client typecheck, build, dev server steps
- AC-2: compose Postgres, migrate, `/up`, Pest on `eneba_test`
- AC-3: env reader, `.env.example` contents, ignored `.env` files, prod guard
