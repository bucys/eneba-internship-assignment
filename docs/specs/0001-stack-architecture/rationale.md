# 0001. Stack and architecture: decision record

Build spec: [index.md](index.md).

## Context

The Eneba internship assignment asks for a marketplace web app with a React frontend (TypeScript preferred), a PHP or Go backend exposing REST or GraphQL, any database, and a public deployment on a free plan (basis: `docs/reference/Eneba Internship Assignment.pdf`). Reviewers value a few features done well, and the developer must be able to explain every line of code (basis: project `AGENTS.md`).

The build budget is 3 to 4 days for one developer (basis: `docs/scope/scope.md`). The deepest features are a correct checkout with unique key delivery, store search with typo tolerance, and homepage blocks where each block has its own endpoint and data source. These need relational integrity (one key sold once), transactions, and a fuzzy search capability.

The deployment must stay live and keep its data for a review period of several weeks, with no money spent. Free plans differ a lot: some databases expire after 30 days, some pause after a week idle, and free API hosts sleep when idle. The frontend and API will sit on different free domains, which limits cookie based auth.

Without a recorded stack, every later spec (data model, auth, search, deploy) would make its own assumptions about the framework, the database, and the hosts.

## Options considered

### Option 1: Vite React SPA + Laravel REST + Neon Postgres, on Vercel + Render (chosen)

Static SPA on Vercel. A Laravel 13 API in Docker on Render's free web service. Postgres on Neon's free plan. Sanctum Bearer tokens.

**Pros**:
- Laravel ships the ORM, migrations, seeders, validation, auth, and testing tools, which saves days (basis: Laravel 13 release notes).
- Neon's free plan doesn't expire (basis: Neon free plan docs).
- REST maps one homepage block to one endpoint naturally.

**Cons**:
- Render's free plan sleeps after 15 min idle, with about a 1 min wake up (basis: Render free plan docs).
- The cross domain setup forces token auth instead of the safer httpOnly cookie auth.

### Option 2: Next.js frontend + Laravel API

Next.js App Router (the developer's usual default) for SSR and SEO, calling the same Laravel API.

**Pros**:
- Server rendering and SEO, plus the developer already knows it.
- A Next.js route handler can proxy the API, which would allow cookie auth on one origin.

**Cons**:
- Two server runtimes (Node and PHP) to explain and operate, and business logic may leak into Node.
- SEO is deferred in the scope, so the main benefit goes unused.

### Option 3: Laravel + Inertia + React (one app)

Laravel renders the React pages through Inertia. No separate API.

**Pros**:
- One deploy, one origin, session cookie auth, no CORS.

**Cons**:
- No real REST API, which weakens the "each block from its own backend service" requirement and the assignment's REST framing.
- Breaks the `client/` and `server/` split the project planned.

### Option 4: Go API (chi + sqlc) + Vite React SPA

Go backend, compiled into a small container.

**Pros**:
- Fast, tiny image, quick cold starts.

**Cons**:
- Auth, migrations, validation, and seeding are hand assembled from separate libraries, which costs days of a 3 to 4 day budget and is more code to defend.

## Rationale

The binding forces are the short budget, the "must explain your code" rule, and zero cost hosting that stays up for weeks. Laravel solves most backend plumbing with documented conventions, so time goes into checkout correctness and search, the features reviewers judge (basis: monolith first; boring technology). A separate SPA plus a REST API is the most literal match to the assignment's architecture (frontend only displays what it receives), which Option 3 weakens and Option 2 complicates with a second server runtime.

Postgres on Neon beats the alternatives on durability: Render Postgres is deleted after 30 days and Supabase pauses after about 7 days of low activity, and either would break the demo mid review. Postgres also keeps search inside the database (basis: use the database's built in search first).

Token auth is a direct consequence of free hosting: `*.vercel.app` and `*.onrender.com` share no top level domain, which Sanctum SPA cookie auth requires (basis: Laravel Sanctum docs). The XSS exposure is accepted and bounded (no untrusted HTML, 7 day expiry, revocation). A custom domain or a Vercel proxy would allow cookies, but they add cost or a debugging layer for little gain in a demo.

**Recommendations made while writing the spec** (pick, then runner up):
- Neon **direct** connection over pooled: a single instance gains nothing from pooling, and it avoids PgBouncer issues with prepared statements and migrations. Runner up: pooled endpoint for the app plus direct for migrations.
- Token expiry of 7 days: limits the damage from a stolen token without annoying a reviewer. Runner up: no expiry.
- CORS allowing the production origin plus a pattern for this project's Vercel preview URLs, so previews work. Runner up: production origin only.
- Throttle login/register at 5 per minute per IP and checkout at 10 per minute per user: basic abuse protection at no cost. Runner up: Laravel's default API limiter only.
- Laravel's built in `/up` route as the Render health check. Runner up: a custom `/api/v1/health` route that also checks the DB.
- PHP 8.4: inside Laravel 13's 8.3 to 8.5 range and widely packaged. Runner up: 8.5.
- Pest tests against Postgres instead of SQLite in memory, so Postgres only features (search) are tested for real. Runner up: SQLite for speed.

**Changes after the cross check (2026-11-11)**, applied with three adjustments you made:
- Prod data is never reset. Instead of `migrate:fresh`, use non destructive migrations, idempotent seeders, and Laravel's destructive command guard in production (basis: preserve orders and allocated keys; fail safe defaults). Runner up: a guarded reset command behind an env flag, rejected because one wrong flag wipes orders.
- Rate limits don't rely on the client IP alone. Render doesn't document how it handles `X-Forwarded-For`, so login is also limited by email, and checkout and cart writes by user id (basis: defense in depth; Laravel treats request IPs as untrusted input). Runner up: per IP limits only, rejected as spoofable.
- Preview CORS is an anchored regex for this project and scope only, and previews are read only through `BlockPreviewWrites` (basis: least privilege). Runner up: Vercel Deployment Protection on previews, which also helps but doesn't stop a logged in viewer from writing to prod data.
- `CACHE_STORE=database`, because the `array` store would silently disable throttling under PHP FPM.
- Image settings verified against the `serversideup/php` docs: `AUTORUN_ENABLED` defaults to false; NGINX listens on 8080; `SSL_MODE` defaults to off; migrations use `--force` and wait up to the timeout for the DB; `HEALTHCHECK_PATH` defaults to `/healthcheck`; `TRUSTED_PROXY` defaults to `cloudflare`.

## Landscape check (2026-11-11)

From a web check run during the design conversation (cached in `docs/.agent-cache/research/stack-landscape.md`):
- Laravel 13 released 2026-03-17, PHP 8.3 to 8.5, bug fixes to Q3 2027, security fixes to 2028-03-17. Laravel 12 bug fixes ended 2026-08-13.
- Sanctum (Laravel 13) still supports SPA cookie auth (same top level domain) and API tokens.
- Render free web service: spins down after 15 min idle, about 1 min wake up, 750 instance hours per month. Render free Postgres: expires after 30 days.
- Neon free: 1 GB per project (20 GB total), 100 CU hours per project per month, 5 min autosuspend, no expiry; writes fail past the cap (no overage billing).
- Supabase free: pauses after about 7 days of low activity.
- Railway: no real free plan (trial credit, then paid). Koyeb free web service: not confirmed.
- Not verified: current React, Vite, Tailwind, TanStack Query, and React Router versions; Fly.io free terms; Vercel and Netlify specifics; pg_trgm on Neon.

## References

**Project sources**:
- `docs/reference/Eneba Internship Assignment.pdf`: technical requirements and deliverables
- `AGENTS.md`: proposed `client/` + `server/` (Laravel) layout, explainability rule
- `docs/scope/scope.md`: build budget, Journey approach, scope decisions (simulated payment, per block endpoints)
- Installed skills: `laravel-best-practices`, `deploy-to-vercel`, `tanstack-query`, `vite`, `vitest`, `tailwind-css-patterns` (in `.claude/skills/`)

**Practices & standards**:
- Monolith first; boring technology
- Relational database as default; database built in search before a search engine
- Proven auth library over hand rolled auth
- Integer minor units (cents) for money
- Twelve factor config (secrets in environment variables)

**Links** (web verified during the landscape and tool discovery checks):
- Laravel release notes: https://laravel.com/docs/releases
- Laravel Sanctum: https://laravel.com/docs/sanctum
- Laravel Boost (MCP): https://laravel.com/docs/13.x/boost
- Render free plan: https://render.com/docs/free
- Neon free plan: https://neon.com/docs/introduction/free-tier
- Supabase free project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Railway plans: https://docs.railway.com/reference/pricing/plans
- Cloudflare Pages serving: https://developers.cloudflare.com/pages/configuration/serving-pages/
- serversideup/php environment variables: https://serversideup.net/open-source/docker-php/docs/reference/environment-variable-specification
- serversideup/php Laravel automations: https://serversideup.net/open-source/docker-php/docs/laravel/laravel-automations
- Render web services (port binding, TLS): https://render.com/docs/web-services
- Laravel 13 requests, trusted proxies: https://laravel.com/docs/13.x/requests
- Vercel generated URLs: https://vercel.com/docs/deployments/generated-urls
