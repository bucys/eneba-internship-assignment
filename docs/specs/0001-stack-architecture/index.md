# 0001. Stack and architecture: React SPA, Laravel REST API, Postgres on free hosting

**Date**: 2026-11-11
**Status**: Accepted

## Summary

You build two separate apps in one repository: a React single page app (the website that runs in the browser) in `client/`, and a Laravel PHP API (the server that holds the rules and the data) in `server/`. They talk over REST with JSON, and signed in users send a token with each request. Data lives in a Postgres database on Neon. The API runs on Render and the website on Vercel, all on free plans. These are boring, well documented tools you can explain line by line, and they fit a 3 to 4 day build.

## Requirements

**User stories**:
- As the developer, I want both apps scaffolded on the chosen stack so that every later feature builds on real structure.
- As a reviewer, I want the stack choices written down with reasons so that I can judge the architecture.

**Acceptance criteria** (these come from the scope's "Done when" line for feature 1; the stack itself is recorded below, not restated as a criterion):
- **AC-1**: `client/` starts locally with `npm run dev` (port 5173), and `npm run build` plus `npm run typecheck` (`tsc -b`) pass with no errors.
- **AC-2**: `server/` (scaffolded with Pest) starts locally with `php artisan serve` (port 8000) against the Docker Compose Postgres, `php artisan migrate` succeeds, `GET /up` returns 200, and `php artisan test` passes against the separate `eneba_test` database.
- **AC-3**: The client reads the API base URL only from `VITE_API_URL`, and the server reads every secret and host from environment variables. Both apps commit a `.env.example` that lists every key in *Configuration required*, with local defaults and no real secrets.

## Decision

**Chosen option**: Option 1: Vite React SPA + Laravel REST API + Neon Postgres, hosted on Vercel and Render.

You build a monolith API (one Laravel app, layered as thin controllers, Form Requests, service/action classes, and API Resources) behind a separate static React SPA. The two connect through versioned REST endpoints and authenticate with Sanctum Bearer tokens.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `deploy-to-vercel` (`vercel-labs/agent-skills`, `.claude/skills/deploy-to-vercel/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `vite` (`antfu/skills`, `.claude/skills/vite/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`)

## Rationale

Reasoning, options, and sources: see [rationale.md](rationale.md).

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Architecture pattern | Monolith API + separate static SPA | One team, small scale. Each homepage block gets its own endpoint and data source inside one backend, as the scope decided. |
| Backend language | PHP 8.4 (Laravel 13 supports 8.3 to 8.5) | Required by the assignment (PHP or Go). 8.4 is inside Laravel 13's supported range. |
| Backend framework | Laravel 13 | Current major with bug fixes to Q3 2027. Built in ORM (Eloquent), migrations, seeders, validation, and auth save days. |
| Backend code shape | Thin controllers → Form Requests (validation) → service/action classes (business logic such as checkout and key allocation) → API Resources (JSON shape) | Puts checkout logic in small classes you can test and explain. |
| API style | REST + JSON under `/api/v1` | Simple, cacheable, and Laravel native. Errors use Laravel's default JSON shape (`{message}`, plus `{errors}` on 422) with correct status codes. |
| Auth | Laravel Sanctum personal access tokens (Bearer) | Works across the two free domains with no cross site cookies. A proven library, not hand rolled. |
| Primary DB | PostgreSQL on Neon (free plan) | Relational data (offers, keys, orders). The free plan never expires. Postgres has built in fuzzy search options for the search feature. |
| DB connection | `DB_CONNECTION=pgsql` + Neon **direct** (not pooled) connection string with `sslmode=require` | There is one API instance, so pooling adds nothing, and the direct endpoint avoids PgBouncer quirks with prepared statements and migrations. It also keeps row locks (`lockForUpdate`) inside a transaction reliable for key allocation; the checkout spec owns the details. |
| Cache & session | `CACHE_STORE=database`, `SESSION_DRIVER=array` | The rate limiter needs a cache that persists between requests (the `array` store resets every request, which would silently disable throttling). The API keeps no session state. |
| Money | Integer cents + ISO currency code; EUR only | No float rounding bugs. The client formats with `Intl.NumberFormat`. |
| Frontend build | Vite + React + TypeScript (latest stable at scaffold time) | Plain SPA that deploys as static files and splits cleanly from the PHP API. |
| Routing | React Router, library (declarative/data) mode | The most widely known router. Protected routes for checkout and orders stay simple. |
| Server data | TanStack Query | Each query has its own loading and error state (one failing homepage block doesn't break the page), plus caching and retries. |
| Client state | TanStack Query for the user and the server cart; one small React context for the guest cart in `localStorage` | No extra state library. |
| API types | Hand written TS types (one file per resource, mirroring each API Resource) + one typed `apiFetch` wrapper | No codegen tooling, fully explainable. |
| Styling | Tailwind CSS with Eneba tokens in the theme | Fast, and the tokens map cleanly. The design system spec (feature 4) defines the tokens. |
| Background jobs | None (`QUEUE_CONNECTION=sync`) | Nothing in scope needs async work. Simulated payment and key allocation run in one DB transaction. |
| File storage | None | Product images are external URLs chosen by the seed spec (feature 5). |
| Email | None (`MAIL_MAILER=log`) | No emails in scope. Keys show on the order page. |
| Search engine | None external; Postgres built in | The search spec (feature 14) picks the exact technique. |
| API hosting | Render free web service, Docker, root dir `server/`, region matching the Neon region (EU) | A real free plan that deploys from GitHub. It sleeps after 15 min idle (about 1 min to wake). |
| Runtime image | `serversideup/php:8.4-fpm-nginx` (tag pattern taken from the docs' `8.5-fpm-nginx` example; confirm it exists) | Production tuned for Laravel, one container, built in Laravel automations. NGINX listens on 8080 over plain HTTP (`SSL_MODE=off`, the default), because Render terminates TLS. The Dockerfile runs `composer install --no-dev --optimize-autoloader`. |
| Migrations in prod | On container start through the image's automations: `AUTORUN_ENABLED=true` turns them on (it defaults to false). Migrations run in `default` mode with `--force`. `AUTORUN_LARAVEL_MIGRATION_MODE` must never be `fresh` or `refresh`, and `AUTORUN_LARAVEL_MIGRATION_SEED=false`. The image waits for the DB before migrating (timeout raised to 60 s for a Neon resume). | A single instance, so there's no race. The schema always matches the deploy and existing data is never dropped. |
| Prod data seeding | Non destructive only: `php artisan db:seed --force` with **idempotent seeders** (upsert by natural keys, add keys only to offers that have none, never touch orders, order items, or allocated keys), run once from your machine against the Neon `DB_URL` with `APP_ENV=production`. `DB::prohibitDestructiveCommands(app()->isProduction())` in `AppServiceProvider` blocks `migrate:fresh`, `migrate:refresh`, `migrate:reset`, and `db:wipe` in production. `migrate:fresh --seed` is for local only. | Render free has no shell. The guard turns a slip into an error instead of lost orders. The seed spec (feature 5) designs the seeders under this rule. |
| SPA hosting | Vercel Hobby, root dir `client/`, `vercel.json` rewrites all paths to `/index.html`. Production deploys from `main`; previews come from other branches and PRs. | Already connected, with preview URLs per push. |
| Deploy trigger | Render and Vercel both auto deploy production from `main` | One branch is the source of truth for the public URL. |
| Cold starts | Accepted. The client shows a "waking up the server" message when a request is still pending after 3 s, and the README explains it. `apiFetch` times out at 90 s. TanStack Query retries queries once and mutations never. | Free and honest. No keep alive pings. The timeout outlasts the ~1 min wake, and mutations are never sent twice. |
| Local dev | Docker Compose runs `postgres:17` only (match the Neon project's major version; change both together), with an init script that creates `eneba` and `eneba_test`. PHP 8.4 + Composer and Node LTS run natively. API on `:8000`, Vite on `:5173`, local `FRONTEND_URL=http://localhost:5173`. | Prod parity for the DB, fast reloads, and tests isolated from dev data. |
| Version pins | `client/.nvmrc` (Node LTS) + `engines` in `package.json`; `config.platform.php = 8.4` in `server/composer.json` | Same versions locally, in CI, and on the hosts. |
| Package manager | npm, `client/` standalone (no root `package.json`) | Zero extra tooling. |
| Testing | Pest (API, against Postgres, not SQLite) · Vitest + React Testing Library (client) | Laravel's and Vite's defaults. Postgres in tests catches Postgres only behavior. |
| CI | GitHub Actions on push and PR: server job (PHP 8.4, Postgres service, `composer install`, Pest) + client job (`npm ci`, type check, Vitest, build) | Cheap insurance for the Beta checkout. Built with feature 2 (see Follow-up). |
| Config & secrets | Values set in the Render and Vercel dashboards; committed `.env.example` in each app | No secrets in git. |
| Observability | Laravel logs to stderr (`LOG_CHANNEL=stderr`), read in Render's log viewer; Vercel build logs | Enough for a demo. Error tracking is deferred in the scope. |

### Repository layout

```
client/            Vite React TS app (deployed to Vercel)
server/            Laravel 13 API (Dockerfile planned for deployment, feature 6; deployed to Render)
docs/              specs, scope, reference, agent-logs
scripts/           repo tooling (agent log export)
.github/workflows/ CI
docker-compose.yml local Postgres only
```

### Cross app contracts

- **Base URL**: every API path is `${VITE_API_URL}/api/v1/...`. The health check is Laravel's built in `GET /up` (not versioned), which Render uses as its health check path.
- **Request headers**: `apiFetch` always sends `Accept: application/json`, so Laravel returns a JSON 401 or 422 instead of a redirect or an HTML page. JSON bodies also send `Content-Type: application/json`.
- **Response shape**: success responses keep the API Resource `data` wrapper (`{ "data": {...} }`). Paginated lists use Laravel's `{ data, links, meta }`. The TS types mirror this.
- **Auth header**: `Authorization: Bearer <token>`. Login and register return `{ token, user }`. Logout revokes the current token server side. The client keeps the token in memory and mirrors it to `localStorage` so it survives a reload, and clears both on logout or on any 401.
- **Token lifetime**: Sanctum `expiration` = 7 days (10080 minutes).
- **CORS**: `config/cors.php` allows the exact `FRONTEND_URL` origin (scheme included, no trailing slash) on `paths: ['api/*']`. Previews are allowed only through `CORS_PREVIEW_ORIGIN_PATTERN`, an anchored regex limited to this project and this Vercel scope slug, covering the two documented preview forms: `<project>-<9 char hash>-<scope-slug>.vercel.app` and `<project>-git-<branch>-<scope-slug>.vercel.app`. For example: `^https://eneba-(git-[a-z0-9-]+|[a-z0-9]{9})-<scope-slug>\.vercel\.app$`. Leaving it empty turns previews off. Never use a wildcard like `*.vercel.app`, which would trust every Vercel user's site. `supports_credentials` stays false (no cookies).
- **Previews share prod**: preview deployments call the production API and Neon database, so their data is real. To prevent accidental writes, a small `BlockPreviewWrites` middleware returns 403 for any non `GET`/`HEAD`/`OPTIONS` request whose `Origin` matches the preview pattern. Previews can browse but can't register, change carts, or check out. CORS only governs browsers, which is the only client this guard needs to cover.
- **Proxy trust**: Render's load balancer terminates TLS and forwards plain HTTP to NGINX in the container. In `bootstrap/app.php`, `$middleware->trustProxies(at: '*', headers: X_FORWARDED_FOR | X_FORWARDED_HOST | X_FORWARDED_PORT | X_FORWARDED_PROTO)`. Render publishes no fixed proxy IPs, so `*` is the only workable value, and it trusts just the direct peer (`REMOTE_ADDR`). `$request->ip()` is then the rightmost address in `X-Forwarded-For` that the trusted peer did not add. Whether that resists a client sending its own fake `X-Forwarded-For` depends on Render appending to or replacing the header, which Render's docs don't state (see Follow-up). The image's `TRUSTED_PROXY` setting (default `cloudflare`) stays at its default until the deploy time check confirms the right value.
- **Rate limits (spoof resistant by design)**: named limiters on the `database` cache. Login: 5 per minute keyed by `email + ip` **and** 20 per minute keyed by `email` alone, so a faked IP can't buy unlimited guesses at one account. Register: 5 per minute per IP plus a global cap of 60 per minute. Checkout and cart writes: keyed by the user id, never by IP. Over the limit returns 429 with `Retry-After`.
- **Money in JSON**: `{ "amount": 1999, "currency": "EUR" }`, always integer cents.
- **Errors**: status code + Laravel default JSON. The client's `apiFetch` throws a typed `ApiError { status, message, errors? }`.

### Configuration required

Server, app (Render dashboard; local values in `server/.env.example`):
- `APP_KEY`: Laravel encryption key (generated once, kept secret)
- `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`: the public API URL
- `DB_CONNECTION=pgsql`, `DB_URL`: Neon direct connection string with `sslmode=require` (local: the compose Postgres)
- `FRONTEND_URL`: the production SPA origin, for CORS (local: `http://localhost:5173`)
- `CORS_PREVIEW_ORIGIN_PATTERN`: anchored regex for this project's Vercel previews (empty = previews off)
- `CACHE_STORE=database`, `SESSION_DRIVER=array`, `QUEUE_CONNECTION=sync`, `MAIL_MAILER=log`, `LOG_CHANNEL=stderr`

Server, container (Render dashboard, read by `serversideup/php`):
- `PORT=8080`: points Render at NGINX's port instead of Render's default 10000
- `AUTORUN_ENABLED=true`, `AUTORUN_LARAVEL_MIGRATION_TIMEOUT=60`, `AUTORUN_LARAVEL_MIGRATION_SEED=false` (mode stays `default`; optimize and cache steps stay on by default)
- `HEALTHCHECK_PATH=/up`: the container health check hits the app, not the image's own `/healthcheck`
- Render health check path: `/up`

Testing (`server/phpunit.xml`):
- `DB_DATABASE=eneba_test` against the local compose Postgres; CI uses a Postgres 17 service container with the same name

Client (Vercel, set for **both** Production and Preview; local in `client/.env.example`):
- `VITE_API_URL`: the public API origin, no trailing slash (local: `http://localhost:8000`)

## Consequences

**Positive**:
- One framework (Laravel) covers ORM, migrations, seeding, validation, auth, and tests. The code is mostly conventional and easy to explain.
- Clean client/server split matches the assignment's "frontend only displays what it receives" rule.
- All hosting is free, deploys from git, and keeps data for the whole review period.

**Negative / tradeoffs**:
- The first request after 15 min idle takes about 1 min (Render cold start, sometimes stacked with a Neon resume). This hurts reviewer first impressions. It's mitigated only by the wake up message and a README note.
- A Bearer token in `localStorage` can be read by any script that runs through XSS (cross site scripting, injected code in the page). Cookie auth would avoid that but needs a shared domain. Mitigation: never render untrusted HTML, 7 day expiry, revoke on logout.
- Hand written TS types can drift from the API Resources. You keep them in sync by hand.
- Free plan terms change often. Recheck Render and Neon limits before the deploy.
- Previews share production data. The write block keeps previews read only, so you can't test checkout on a preview. Test it locally instead.
- Trusting proxy headers is only as safe as Render's header handling. The rate limit design limits the damage, but per IP limits on their own are not proof against spoofing.
- No background queue. Any future slow work (emails, webhooks) needs a queue added later.

**Neutral**:
- Two hosts and two dashboards to configure, plus a GitHub repo (none exists yet).
- PHP 8.4 and Composer must be installed locally (Herd or Homebrew).

## Follow-up

- [ ] Create the GitHub repository and push (there's no remote or commit yet). Render, Vercel, and CI all deploy from it.
- [ ] **Deferred (not installed yet):** after scaffolding `server/`, install Laravel Boost as a dev dependency (`composer require laravel/boost --dev`), then connect its MCP server (`php artisan boost:mcp`) in your MCP settings. You chose this.
- [ ] Check at scaffold time: the current stable versions of React, Vite (the installed `vite` skill mentions Vite 8), Tailwind, TanStack Query, and React Router, and that the `serversideup/php:8.4-fpm-nginx` tag exists (otherwise use `8.5-fpm-nginx` and pin PHP 8.5). `/audit` records the real versions in `AGENTS.md`.
- [ ] Check at scaffold time that `DB::prohibitDestructiveCommands()` exists in Laravel 13 (it isn't in the docs fetched for this spec). If it doesn't, guard the four destructive commands yourself.
- [ ] **Deployment risk, proxy spoofing (verify in feature 6):** after the first deploy, send 6 login attempts for one email, each with a different fake `X-Forwarded-For`. The 6th must return 429. Also log `$request->ip()` once, then remove the log, to confirm it shows your real IP rather than a Render internal address. If it shows the internal address, set the image's `TRUSTED_PROXY` accordingly or switch the per IP limits to the email or user keys only.
- [ ] **Deployment risk, Render port detection:** Render's default `PORT` is 10000, while the image listens on 8080. Setting `PORT=8080` should align them. Confirm the first deploy passes the `/up` health check.
- [ ] **Deployment risk, migration on a cold Neon:** if Neon takes longer than the 60 s autorun timeout to resume, the container stops and Render retries the deploy. Watch the first deploy log.
- [ ] **Deployment risk, preview pattern:** the Vercel project name and scope slug are only known once the Vercel project exists. Fill in `CORS_PREVIEW_ORIGIN_PATTERN` then. Long branch names may be truncated at 63 characters, which the regex must allow.
- [ ] Check that Neon supports the `pg_trgm` extension before the search spec (feature 14) relies on it.
- [ ] The GitHub Actions CI workflow belongs with feature 2 (Coding standards & tooling), next to lint, format, and type checks.
- [x] Update root `AGENTS.md` (`/audit` or `/sync`): confirm `server/` is Laravel 13, and add an `## Agent skills` section listing the 6 installed skills (`laravel-best-practices`, `tanstack-query`, `vite`, `vitest`, `tailwind-css-patterns`, `deploy-to-vercel`). All are project wide except `deploy-to-vercel`, which is deploy only. Record as declined: the Pest and GitHub Actions skills, `neon-serverless` (a JS driver, not used from PHP), `render-mcp`, and the Neon and Render MCP servers, so they aren't offered again.
- [ ] Consider adding `docs/.agent-cache/` to `.gitignore` (it holds research caches, not project docs).
