# Server (Laravel API)

The REST API for the Eneba marketplace: Laravel 13 on PHP 8.4, PostgreSQL 17, Sanctum Bearer tokens. Every route lives under `/api/v1`.

Setup, environment variables, architecture, and tradeoffs are in the [root README](../README.md).

```bash
docker compose up -d   # from the repo root: local Postgres (eneba + eneba_test)
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan serve      # http://localhost:8000
php artisan test && composer format:check && composer analyse
```

Conventions for contributors and agents: [AGENTS.md](AGENTS.md).
