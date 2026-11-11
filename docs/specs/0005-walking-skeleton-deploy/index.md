# 0005. Walking skeleton: the product list endpoint, a home page grid, and the first public deploy

**Date**: 2026-11-11
**Status**: In Progress

## Summary

You build the first real path through the whole stack: Postgres rows, a Laravel endpoint `GET /api/v1/products`, and a product grid on the React home page, all deployed on Neon, Render, and Vercel. The endpoint is the store list in its simplest form (page 1 of 24, sorted by name, cheapest offer price), so features 13 and 15 grow it instead of throwing it away. The client gets its one `apiFetch` wrapper, TanStack Query, and the "waking up the server" message now, because the very first public visit hits a sleeping Render instance. When this ships, a reviewer opening the public URL sees real seeded games with real prices.

## Requirements

**User stories**:
- As a visitor, I want to open the public site and see real games with prices so that I know the store works.
- As a reviewer, I want the deployed frontend, backend, and database wired with no hardcoded hosts or secrets so that I can judge the deployment.
- As the developer, I want the first endpoint and client data layer to be the real ones so that later features extend them instead of replacing them.

**Acceptance criteria** (the contract):
- **AC-1**: `GET /api/v1/products` returns 200 with Laravel's paginated shape `{ data, links, meta }`, 24 items per page (`meta.per_page = 24`), page chosen by the `page` query param (Laravel's paginator default handling: missing or invalid → page 1, past the end → empty `data`). Only products with `is_active = true` appear. Order: products with a price first, then products with a null price; inside each group by `name` ascending, then `id` ascending.
- **AC-2**: Each item has exactly these keys: `slug`, `name`, `type`, `cover_image_url`, `platform` `{ slug, name }`, `region` `{ slug, name }`, `price` (`{ amount, currency }` or null), `list_price` (`{ amount, currency }` or null), `discount_percent` (integer or null). Keys are snake_case. Amounts are integer cents; currency is `"EUR"`.
- **AC-3**: `price.amount` is the lowest `offers.price_cents` among the product's offers with `is_active = true` and at least one available key (`order_item_id` null). Inactive offers and offers with zero available keys never set the price. A product with no such offer has `price: null`.
- **AC-4**: `list_price` is `products.list_price_cents` as Money, or null when that column is null. `discount_percent` is `floor((list − price) × 100 / list)` in integer math; it is null when `list_price` or `price` is null, when list is not higher than price, or when the result is 0.
- **AC-5**: The list endpoint is limited to 120 requests per minute per client IP (named `catalog` limiter on the `database` cache store). The 121st request in a minute returns 429 with a `Retry-After` header.
- **AC-6**: CORS on `api/*`: a request with `Origin` equal to `FRONTEND_URL` gets `Access-Control-Allow-Origin` set to that origin. An origin matching `CORS_PREVIEW_ORIGIN_PATTERN` is also allowed. Any other origin (for example `https://evil-eneba.vercel.app`) gets no `Access-Control-Allow-Origin` header. An empty pattern allows no previews. `supports_credentials` is false.
- **AC-7**: The home page `/` keeps its single `<h1>` and adds a section headed by an `<h2>` "Browse games", showing page 1 of the list as `ProductCard`s inside `ProductGrid` (name, cover, platform, region, price, list price, discount badge, link to `/products/<slug>`). While loading it shows 12 `ProductCardSkeleton`s. On error it shows `ErrorState`; "Try again" refetches. With zero products it shows `EmptyState` titled "No games yet".
- **AC-8**: Cold start handling: if the request is still pending after 3 s, an info `Alert` with `role="status"` reads "Waking up the server. The first visit after a quiet spell can take up to a minute." It disappears when the request settles. `apiFetch` aborts after 90 s (the error state then shows). Queries retry once, 3 s later, on network errors and 5xx; never on a timeout or a 4xx (including 429). Mutations never retry. The notice also shows when "Try again" refetches after an error.
- **AC-9**: The client reads the API origin only through `env.apiUrl` (`src/lib/env.ts`). `apiFetch` always sends `Accept: application/json` (plus `Content-Type: application/json` when it sends a body), calls `${env.apiUrl}/api/v1/...`, and on a non 2xx response throws `ApiError { status, message, errors? }` parsed from Laravel's JSON error body (falling back to a generic message when the body is not JSON).
- **AC-10**: `server/Dockerfile` builds on `serversideup/php:8.4-fpm-nginx`, runs `composer install --no-dev --optimize-autoloader`, and serves the app on port 8080. With the container env vars from spec 0001, migrations run on start (`AUTORUN_ENABLED=true`, default mode, no seed) and `GET /up` returns 200 through Render's health check.
- **AC-11**: The public Vercel production URL shows seeded products fetched from the public Render API backed by Neon. No host, connection string, or key is committed: every value comes from env vars listed in spec 0001 *Configuration required*, and both `.env.example` files list every key this feature reads.
- **AC-12**: `bootstrap/app.php` trusts proxies as spec 0001 states. On Render, `$request->ip()` returns your real public IP (checked once with a temporary log line, then the line is removed).
- **AC-13**: All existing checks still pass (`npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`; `composer format:check && composer analyse && php artisan test`), now including this feature's tests, and CI is green on `main`.

## Decision

**Chosen option**: Option 1: The real store list endpoint, in its smallest form, rendered on the home page and deployed with the full spec 0001 setup.

You build `GET /api/v1/products` (thin controller → `ListProducts` action → `ProductResource`), a `Product::withCheapestPrice()` scope, a `Discount` helper, CORS, proxy trust, a `catalog` rate limiter, a Dockerfile, and on the client `apiFetch`, TanStack Query, and a home page grid with every state, then deploy all three hosts.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`) · `deploy-to-vercel` (`vercel-labs/agent-skills`, `.claude/skills/deploy-to-vercel/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no schema change. Reads existing tables from spec 0002:

| Table | Columns read | Used for |
|---|---|---|
| `products` | `id`, `slug`, `name`, `type`, `cover_image_url`, `list_price_cents`, `is_active`, `platform_id`, `region_id` | item fields, active filter, order |
| `platforms`, `regions` | `id`, `slug`, `name` | nested `platform`, `region` (eager loaded with column lists, two extra queries per page, no N+1) |
| `offers` | `product_id`, `price_cents`, `is_active` | cheapest price subquery |
| `product_keys` | `offer_id`, `order_item_id` | "has stock" check (uses the existing partial index on `offer_id WHERE order_item_id IS NULL`) |

`Product::withCheapestPrice()` (a local query scope, a reusable query fragment on the model) adds one column, `cheapest_price_cents`, as a correlated subquery:

```php
// shape, not final code
$query->select('products.*')->addSelect([
    'cheapest_price_cents' => Offer::query()
        ->selectRaw('MIN(offers.price_cents)')
        ->whereColumn('offers.product_id', 'products.id')
        ->where('offers.is_active', true)
        ->whereHas('availableKeys'),
]);
```

Postgres does not allow a select alias inside an expression in `ORDER BY` (`cheapest_price_cents IS NULL` would fail with "column does not exist"). So `ListProducts` wraps the scoped query as a derived table (a subquery used like a table) named `products`, where the alias becomes a real column:

```php
// shape, not final code
Product::query()
    ->fromSub(Product::query()->active()->withCheapestPrice(), 'products')
    ->with(['platform:id,slug,name', 'region:id,slug,name'])
    ->orderByRaw('cheapest_price_cents IS NULL')
    ->orderBy('name')
    ->orderBy('id')
    ->paginate(24);
```

`paginate()` counts over the same derived table, and eager loading still works because the outer rows carry `platform_id` and `region_id`. The resource casts `cheapest_price_cents` to `int|null`. Feature 13 adds filters and other sort orders inside this action, behind a Form Request. This feature takes no input except `page`, so it adds no Form Request; every other query param (including `per_page`) is ignored.

Server helpers: `App\Support\Discount::percent(?int $listCents, ?int $priceCents): ?int` and `App\Support\Money::eur(?int $cents): ?array` (returns `['amount' => $cents, 'currency' => 'EUR']`, or null for null). The action is `App\Actions\Catalog\ListProducts`, and the resource is `App\Http\Resources\ProductResource`.

**State transitions**: none.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/products` | GET | `page`: int (opt, default 1) | `data[]` of `ProductResource`, `links`, `meta` (`current_page`, `last_page`, `per_page`, `total`) | public | 429 over the `catalog` limit (`Retry-After`); 500 renders Laravel's JSON error |
| `/up` | GET | none | 200 | public | 500 when the app cannot boot (Render health check fails) |

Routes: register `routes/api.php` in `withRouting(api: ..., apiPrefix: 'api/v1')` by hand (no `php artisan install:api`, which would install Sanctum; Sanctum comes with feature 7). The route name is `products.index`, with middleware `throttle:catalog`.

`ProductResource` example item:

```json
{
  "slug": "the-witcher-3-wild-hunt-steam-global",
  "name": "The Witcher 3: Wild Hunt",
  "type": "game",
  "cover_image_url": "https://...",
  "platform": { "slug": "steam", "name": "Steam" },
  "region": { "slug": "global", "name": "Global" },
  "price": { "amount": 1299, "currency": "EUR" },
  "list_price": { "amount": 3999, "currency": "EUR" },
  "discount_percent": 67
}
```

Client files:

| File | Owns |
|---|---|
| `src/api/client.ts` | `apiFetch<T>(path, init?)`, `ApiError`, `Paginated<T>` type (`{ data, links, meta }`) |
| `src/api/products.ts` | `Product` type (mirrors `ProductResource`), `listProducts(page, signal)`, `productsQuery(page)` query options |
| `src/lib/queryClient.ts` | the one `QueryClient` and its defaults (retry rule, `staleTime: 60_000`, `refetchOnWindowFocus: false`) |
| `src/lib/useSlowPending.ts` | `useSlowPending(isPending, delayMs = 3000)`: true once pending for 3 s, reusable by later features |
| `src/components/product/toProductCardProps.ts` | maps a `Product` (snake_case) to `ProductCard` props (camelCase); the one mapping later grids reuse |
| `src/components/product/ProductListSection.tsx` | the "Browse games" section with loading, slow, error, empty, and success states |
| `src/main.tsx` | wraps `RouterProvider` in `QueryClientProvider` |

`apiFetch` combines the caller's `signal` (TanStack Query cancels on unmount) with `AbortSignal.timeout(90_000)` through `AbortSignal.any`. `ApiError` carries `kind: "http" | "network" | "timeout"`: `http` has the real status, while `network` (fetch rejected) and `timeout` (a `TimeoutError` from the timeout signal) use `status: 0`. An `AbortError` from TanStack's own cancel is rethrown as is, never wrapped. TanStack treats it as a cancellation, so it is neither retried nor shown as an error.

The query retry predicate retries at most once, and only for `kind === "network"` or `http` with status 500 or above. It never retries `timeout` (that request already waited 90 s) or any 4xx. `retryDelay` is 3000 ms, so a retry during a cold start doesn't fire straight back into a sleeping instance. The query key is `["products", "list", { page }]`, so feature 13 can add filter keys to the same object. `Product.type` is carried in the TS type as `"game" | "dlc" | "gift_card" | "subscription"` but is unused by the card. `cover_image_url` is typed `string` (the column is not null); `ProductCard` still accepts null. Data loads with `useQuery` inside the section, not a React Router loader, because spec 0001 makes TanStack Query the server data layer and a loader would block the whole page during a cold start.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| List | which products | `products.is_active = true` (`active()` scope) |
| List | order | derived: `cheapest_price_cents IS NULL`, then `products.name`, then `products.id` |
| List | page size 24 | decided here (constant in `ListProducts`) |
| List | page number | input `page` query param (Laravel paginator) |
| Item | `slug`, `name`, `type`, `cover_image_url` | `products` columns of the same names |
| Item | `platform`, `region` | `platforms.slug/name`, `regions.slug/name` via FKs |
| Item | `price.amount` | derived: `MIN(offers.price_cents)` over active offers with an available key (spec 0002 value sourcing, built here as `withCheapestPrice()`) |
| Item | `price.currency`, `list_price.currency` | constant `"EUR"`, guaranteed by the `offers.currency = 'EUR'` check (spec 0002) and EUR only rule (AGENTS.md); one `Money` helper in the resource builds `{ amount, currency }` |
| Item | `list_price.amount` | `products.list_price_cents` |
| Item | `discount_percent` | derived: `App\Support\Discount::percent(list, price)`, floor rounding decided here (feature 15 may confirm or change it in that one class) |
| Card | price text, strikethrough, badge | existing `Price` component (spec 0003) from `price`, `list_price`, `discount_percent` |
| Card | "Out of stock" | derived: `price === null` (spec 0003) |
| Card | link | `/products/<slug>` (spec 0003); it renders the 404 page until feature 8 |
| Section | "Waking up the server" notice | derived: `useSlowPending(query.isFetching && !query.data)` after 3 s (not `isPending`, which stays false while "Try again" refetches after an error) |
| Section | loading card count 12 | decided here (fills two rows at desktop width, below the fold on mobile) |
| Section | empty copy "No games yet" / "Check back soon." | decided here |
| `apiFetch` | base URL | `env.apiUrl` from `VITE_API_URL` (spec 0001) |
| `apiFetch` | timeout 90 s, retry once, no mutation retry | spec 0001 *Cold starts* |
| CORS | allowed origins | `FRONTEND_URL`, `CORS_PREVIEW_ORIGIN_PATTERN` env vars (spec 0001) |
| Rate limit | 120 per minute, keyed by IP | decided here; IP is `$request->ip()` after proxy trust (spec 0001) |

**Key invariants**:
- The price on a card is always something a buyer can actually purchase right now (active offer with stock). It is computed at read time, never stored (spec 0002).
- The discount is computed only on the server, in one class. The client never does price math beyond `formatPrice`.
- No host or secret appears in git. The client knows only `VITE_API_URL`.
- Production migrations never drop data: autorun mode stays `default`, seeding stays off on start, and the destructive command guard from spec 0001 stays on.

**Security model**: the catalog is public and read only, so no auth. The `catalog` limiter caps scraping at 120 per minute per IP. A spoofed `X-Forwarded-For` can only buy more reads, which is harmless here. Feature 7 keys the sensitive limits by email or user, as spec 0001 says. CORS allows only the exact production origin and this project's preview pattern, never a wildcard. No write endpoints exist yet, so the `BlockPreviewWrites` middleware lands with feature 7, the first write. No PII is involved.

**Configuration required** (all already named in spec 0001; nothing new):
- Render (app): `APP_KEY`, `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, `DB_CONNECTION=pgsql`, `DB_URL` (Neon direct, `sslmode=require`), `FRONTEND_URL`, `CORS_PREVIEW_ORIGIN_PATTERN`, `CACHE_STORE=database`, `SESSION_DRIVER=array`, `QUEUE_CONNECTION=sync`, `MAIL_MAILER=log`, `LOG_CHANNEL=stderr`
- Render (container): `PORT=8080`, `AUTORUN_ENABLED=true`, `AUTORUN_LARAVEL_MIGRATION_TIMEOUT=60`, `AUTORUN_LARAVEL_MIGRATION_SEED=false`, `HEALTHCHECK_PATH=/up`; Render health check path `/up`
- Vercel (Production and Preview): `VITE_API_URL`
- `CORS_PREVIEW_ORIGIN_PATTERN` holds the bare anchored regex in the shape spec 0001 fixes (`^https://<project>-(git-[a-z0-9-]+|[a-z0-9]{9})-<scope-slug>\.vercel\.app$`, scope slug always included, no delimiters). `config/cors.php` wraps it in `#...#` because the CORS package matches patterns with `preg_match`. **A blank or unset value must become an empty `allowed_origins_patterns` array.** Wrapping an empty string gives `##`, which matches every origin. Confirm the wrapping against the installed package source at build time. `allowed_methods` and `allowed_headers` keep Laravel's `['*']` defaults (the origin list is what restricts access), and `paths` is `['api/*']` only.
- Prerequisite accounts (you create these in their dashboards; no MCP for Neon or Render): a Neon project (Postgres 17, region AWS `eu-central-1` Frankfurt), a Render web service (Docker, root dir `server/`, region Frankfurt, free plan, auto deploy from `main`), and a Vercel project (root dir `client/`, connected to the GitHub repo).

**Critical test scenarios**:
- Happy path (Pest): factories make 3 active products with offers and keys; `GET /api/v1/products` returns them in the right order with the exact item keys, nested platform and region, and `meta.per_page = 24`, verifies **AC-1**, **AC-2**
- Price rule (Pest): one product with a cheap inactive offer, a cheaper active offer with zero available keys, and a pricier active offer with keys → `price.amount` equals the pricier active offer; a product whose only offer is sold out → `price: null`, listed after priced products, verifies **AC-1**, **AC-3**
- Inactive product (Pest): `is_active = false` never appears, verifies **AC-1**
- Discount (Pest unit): `(3999, 1299) → 67`, `(1000, 999) → null` (rounds to 0), `(1000, 1000) → null`, `(null, 500) → null`, `(1000, null) → null`, verifies **AC-4**
- Rate limit (Pest): 120 requests pass, the 121st returns 429 with `Retry-After`, verifies **AC-5**
- CORS (Pest): `Origin: FRONTEND_URL` gets the allow header; a preview origin matching the pattern gets it; `https://evil-eneba.vercel.app` gets none; with the pattern blank, a preview origin and an arbitrary origin both get none, verifies **AC-6**
- Invalid page (Pest): `?page=abc` and `?page=0` return page 1; `?page=999` returns empty `data` with correct `meta`, verifies **AC-1**
- `apiFetch` (Vitest, stubbed `fetch`): sends `Accept: application/json` to `${apiUrl}/api/v1/products`; a 422 body becomes `ApiError` with `errors`; a non JSON 502 becomes `ApiError` with the generic message, verifies **AC-9**
- Retry rule (Vitest): the `retry` function returns true on the first failure for `network` and for a 503, false on the second failure, and false for `timeout`, 404, and 429; a 90 s timeout becomes `ApiError` with `kind: "timeout"`, verifies **AC-8**
- `useSlowPending` (manual, `/check verify`, since React Testing Library is not installed yet): with DevTools throttling or a stopped API, the notice appears after about 3 s and disappears once the request settles, verifies **AC-8**
- Mapping (Vitest): `toProductCardProps` maps every field, keeping nulls, verifies **AC-7**
- Deployed (manual, `/check verify`): the public URL shows the grid; DevTools shows the request to the Render origin; a cold Render shows the waking notice; `grep` finds no Render, Neon, or Vercel host in tracked files, verifies **AC-8**, **AC-10**, **AC-11**, **AC-12**

## Build plan

Journey approach: the skeleton is one path (database → API → page → public URL). It is built locally end to end first, then deployed, then checked in production, so every layer is proven before the next journey starts.

1. Add `Product::withCheapestPrice()` and `App\Support\Discount::percent()`, with Pest tests for the price rule and discount cases, satisfies **AC-3**, **AC-4**
2. Register `routes/api.php` with `apiPrefix: 'api/v1'`; add the `catalog` limiter in `AppServiceProvider`; add `ListProducts`, `ProductController@index`, `ProductResource`; Pest feature tests for shape, order, active filter, pagination, and 429, satisfies **AC-1**, **AC-2**, **AC-5**
3. Publish `config/cors.php` (`php artisan config:publish cors`) and wire `FRONTEND_URL` and the wrapped preview pattern; add `trustProxies` to `bootstrap/app.php`; Pest CORS tests, satisfies **AC-6**, **AC-12**
4. Install `@tanstack/react-query` (current stable v5 at build time; check its docs for the installed version). Add `src/api/client.ts`, `src/api/products.ts`, `src/lib/queryClient.ts`, `src/lib/useSlowPending.ts`, and the provider in `main.tsx`; Vitest tests for `apiFetch` and the retry rule, satisfies **AC-8**, **AC-9**
5. Add `toProductCardProps` and `ProductListSection` with loading, slow, error, empty, and success states; render it on `HomePage` under the `<h1>`; check it locally against `php artisan serve` and the seeded DB, then check the error state with the API stopped and the slow notice with DevTools throttling; Vitest test for the mapping, satisfies **AC-7**, **AC-8**
6. Add `server/Dockerfile` (copy `composer.json` and `composer.lock` first, then `composer install --no-dev --optimize-autoloader --no-scripts`, then `COPY --chown=www-data:www-data` the source, then `composer dump-autoload --optimize` so `package:discover` runs without dev providers; the image runs as `www-data`) and `server/.dockerignore` (exclude `vendor`, `.env`, `node_modules`, `storage/logs/*`). Confirm the `serversideup/php:8.4-fpm-nginx` tag and its web root (`/var/www/html/public`) in the image docs. Build and run the image locally against the compose Postgres, and confirm `/up` and `/api/v1/products` answer on `:8080`, satisfies **AC-10**
7. Run every check, update both `.env.example` files if any key is missing, push to `main`, and confirm CI is green, satisfies **AC-11**, **AC-13**
8. You (dashboards): create the Neon project and copy the direct connection string; create the Render service with every env var above (`APP_KEY` from `php artisan key:generate --show`); watch the first deploy log for the migrations and the `/up` health check, satisfies **AC-10**
9. You (your machine): seed production with ` APP_ENV=production DB_URL=<neon direct url> php artisan db:seed --force` (leading space keeps it out of shell history, spec 0004), then run spec 0004's cover URL check once against production, satisfies **AC-11**
10. Create the Vercel project (root `client/`) and set `VITE_API_URL` to the Render origin for both Production and Preview **before the first build**, because `env.ts` throws at import when it is missing and Vite bakes it in at build time (changing it later needs a redeploy); set `FRONTEND_URL` on Render to the Vercel production origin; once the project name and scope slug are known, set `CORS_PREVIEW_ORIGIN_PATTERN`; redeploy both, satisfies **AC-6**, **AC-11**
11. Production checks: the public URL shows the grid; a preview URL loads the grid too; add a temporary `Log::info($request->ip())`, compare it with your real IP, then remove it and redeploy (if it shows a Render internal address, set `TRUSTED_PROXY` per spec 0001), satisfies **AC-11**, **AC-12**

## Consequences

**Positive**:
- Features 13 and 15 extend a real endpoint, resource, scope, and client data layer; nothing from the skeleton is thrown away.
- Every deployment risk spec 0001 listed (port detection, cold Neon migrations, CORS, proxy trust) is exercised before feature work depends on it.
- Reviewers see real data on the public URL from day one, and the cold start is explained on screen instead of looking broken.

**Negative / tradeoffs**:
- The home page grid is temporary. Feature 15 replaces it with the homepage blocks, so its section component may be deleted then.
- Card links go to `/products/<slug>`, which shows the 404 page until feature 8 ships.
- Only page 1 (24 of the 81 seeded products) is reachable in the UI until feature 13 adds page controls. The API already serves every page.
- The cheapest price is a correlated subquery per row (24 per page). That's fine for about 81 products and a few hundred offers, but it would need a materialized value at real marketplace scale (spec 0002 accepts this).
- The floor rounding for discounts is decided here ahead of feature 15. If feature 15 picks another rule, the change is one class plus its tests.
- No React Testing Library yet, so the section's visual states are checked by hand in `/check verify`, not by component tests.
- Render free plan cold starts (about 1 min) remain; the notice only explains them.

**Neutral**:
- Adds one client dependency (`@tanstack/react-query`), already approved in spec 0001.
- Three dashboards to configure by hand, once.
- The proxy spoofing 429 check from spec 0001 needs a login endpoint, so it moves to feature 7. This feature does only the `$request->ip()` half.

## Follow-up

- [ ] Feature 7 (authentication): add `BlockPreviewWrites` with the first write endpoint, and run spec 0001's spoofed `X-Forwarded-For` login 429 check there.
- [ ] Feature 13 (store catalog): reuse `ListProducts`, `withCheapestPrice()`, and `ProductResource`; add the Form Request, filters, sort options, and page controls. Confirm or change page size 24.
- [ ] Feature 15 (homepage blocks): confirm or change floor rounding in `Discount::percent()`, and replace the temporary `ProductListSection` on the home page.
- [ ] Feature 8 (product page): decide whether the detail view extends `ProductResource` or adds a `ProductDetailResource`.
- [ ] After deploy: record the real Render and Vercel origins, and the final `CORS_PREVIEW_ORIGIN_PATTERN`, in `server/AGENTS.md` and `client/AGENTS.md` via `/sync` (origins are not secrets, but keep them out of code).
- [ ] Spec 0001 follow-ups closed by this feature once verified: Render port detection, migration on a cold Neon, preview pattern. Tick them in spec 0001 when `/check verify` passes.
- [ ] Consider installing React Testing Library (planned in spec 0001) by feature 10 at the latest, when the Beta checkout needs component tests.
