# Server (Laravel API)

Laravel 13 API on PHP 8.4. Project wide context lives in the root [AGENTS.md](../AGENTS.md); the stack and API contracts are in [spec 0001](../docs/specs/0001-stack-architecture/index.md).

Laravel Boost is deferred and not installed. Do not install it or run `boost:install` without approval.

## Commands

```bash
composer format:check   # Pint --test (laravel preset, pint.json)
composer format         # Pint write
composer analyse        # PHPStan level 6 with Larastan (phpstan.neon), no baseline
php artisan test        # Pest, needs docker compose up -d
```

## Key files

| File | Owns |
|---|---|
| `bootstrap/app.php` | Routing (`routes/api.php` under `apiPrefix: 'api/v1'`, `/up` health), proxy trust (only `X-Forwarded-Proto`), JSON errors for `api/*` or `Accept: application/json` |
| `routes/api.php` | `/api/v1` routes; `GET /products` uses the `catalog` throttle |
| `app/Actions/`, `app/Http/Controllers/`, `app/Http/Resources/` | Thin controller → action → API Resource (for example `ListProducts`, `ProductController`, `ProductResource`) |
| `app/Support/Money.php`, `app/Support/Discount.php` | Money as `{ amount, currency }` in EUR cents; integer discount percent |
| `config/cors.php` | Allows `FRONTEND_URL` exactly plus `CORS_PREVIEW_ORIGIN_PATTERN` (blank means no previews); no credentials |
| `Dockerfile` | `serversideup/php:8.4-fpm-nginx` on port 8080, `TRUSTED_PROXY=cloudflare`; migrations run on start, no seed (spec 0001 env vars) |
| `app/Providers/AppServiceProvider.php` | Blocks `db:wipe` / `migrate:fresh|refresh|reset` in production; `catalog` rate limiter (120 per minute per IP) |
| `phpunit.xml` | Pins tests to the `eneba_test` Postgres DB |

## Gotchas

- `apiPrefix` is `api/v1`, so routes in `routes/api.php` are written without it (`/products` serves `/api/v1/products`).
- The client IP comes from NGINX (`CF-Connecting-IP`), not Laravel. Never trust `X-Forwarded-For` in `trustProxies`; a forged value would open a fresh rate limit bucket (spec 0001).
- `phpunit.xml` blanks `DB_URL`, so a local `.env` DB_URL can never point tests at the dev DB. Run `docker compose up -d` first (it creates `eneba_test`).
- Feature tests use `RefreshDatabase` (`tests/Pest.php`).
- The destructive command guard is a static flag; tests that flip it reset it in `afterEach`.
