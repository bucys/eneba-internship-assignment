# 0016. Performance and reliability: measure the homepage first, keep only the fixes the numbers justify, tell buyers when the cart caps, and close every open review finding

**Date**: 2026-11-16
**Status**: In Progress (verified 2026-11-16 with `/check verify` at `72c0bcf`, see [verify.md, Step 6](verify.md#step-6-final-verification-recheck-2026-11-16); stays In Progress until `/test` passes; a full purchase on production is **NOT TESTED**)

> **Amends** [spec 0008](../0008-cart/index.md) AC-3 and AC-6 (caps are no longer silent: add and merge report them in `meta.adjustments`) and [spec 0014](../0014-homepage-blocks/index.md) AC-9 (the `/` route prefetches every block). Spec 0014 AC-3 is no longer amended: the 30 s browser cache (AC-7) was skipped on 2026-11-16, so the home endpoints keep their freshness rules. Everything else in those specs still holds.

> **Amended 2026-11-16**: AC-5 (b) moves the rate limiter to APCu, not the `file` store, because `FileStore::increment` loses hits under concurrent requests. AC-17 adds the limiter store guard and its evidence. Reasoning and probe results: [rationale.md](rationale.md#limiter-store-amendment-2026-11-16).

> **Amended 2026-11-16 (closeout, finish mode)**: AC-8 reuses the existing final warm run and the baseline cold runs instead of a new production run. AC-14 uses the states DONE, DEFER, and SKIP. AC-15 defers every remaining Fix and Check row (no more application code in this feature). AC-16 accepts the production smoke test of `4959afe` plus the local full purchase and the checkout concurrency evidence; **a full purchase on production was not tested**. Reasoning: [rationale.md, Closeout decision](rationale.md#closeout-decision-2026-11-16). Evidence: [verify.md, Step 5](verify.md#step-5-closeout-ac-8-ac-14-ac-15-ac-16).

> **Amended 2026-11-16 (final verification)**: AC-1 covers matched `/api/v1` routes only; the 404 for an unmatched path is excluded, because Laravel's `api` group middleware never runs for it. Evidence: [verify.md, Step 6](verify.md#step-6-final-verification-recheck-2026-11-16).

## Summary

The public homepage is slow on the free Render host: five API calls that each take about 0.9 s alone took 6 to 9 s each when they ran together. This spec makes you measure that first, with a repeatable script and a `Server-Timing` header (a response header that says how long the server itself worked), and then try a short list of fixes one at a time, keeping only those that move the numbers. It also turns the "10 units charged for 6" observation into a real fix (the cart now tells the buyer when it lowered a quantity), and it closes every open finding in `docs/reviews/`: fix the ones that are bugs, accessibility, reliability, or security, and mark the style ones won't fix with a reason. Whatever slowness remains is written down as a free tier limit, with the numbers to back it.

## Requirements

**User stories**:
- As a reviewer opening the public site, I want the homepage blocks to appear as fast as the free host allows, so that my first impression is a working store, not a wall of skeletons.
- As a buyer, I want to be told when the cart adds fewer units than I asked for, so that I am never charged for a quantity I did not expect.
- As the developer, I want before and after numbers for every performance change, so that I can explain each change in the interview and drop the ones that did nothing.
- As the developer, I want every review finding closed or consciously declined, so that the submission has no known, unacknowledged defects.

**Acceptance criteria**:

*Measurement*
- **AC-1**: Every response from a matched `/api/v1` route (success and error alike, including 401, 404, 422, 429, 500) carries `Server-Timing: app;dur=<ms>, db;dur=<ms>;desc="<n> queries"`. `app` is the milliseconds from `LARAVEL_START` to the moment the response leaves the middleware; `db` is the sum of `QueryExecuted::$time` for that request; `<n>` is the number of queries. Durations have at most one decimal. No other value (no SQL, no hostnames, no versions) appears in the header. *Amended 2026-11-16 (final verification)*: the 404 for a path that matches no route (for example `GET /api/v1/nope-route`) is excluded and carries no `Server-Timing`. `ServerTiming` is in the `api` middleware group, and Laravel runs a group's middleware only after the router has matched a route. When nothing matches, the router throws `NotFoundHttpException` first, and the exception handler renders the 404 with only the global middleware applied. Covering that case would need `ServerTiming` as global middleware, which is out of scope here. A 404 from a matched route (for example `GET /api/v1/products/no-such-game`) still carries the header.
- **AC-2**: `scripts/measure-home.sh <api-base-url> [runs]` (default 10 runs) measures the five homepage calls the client makes: `/home`, `/home/banners`, `/home/best-sellers`, `/home/deals`, and the grid's `/products` page 1 request (its exact query string taken from `client/src/api/products.ts`). Three modes: `--parallel` (default: all five at once, like the client after AC-6), `--waterfall` (`/home` first, then the other four at once, like the client today), and `--serial` (one after another, to show single call cost). Per run it prints each call's connect time, time to first byte, total time, and the `Server-Timing` `app` and `db` values; at the end it prints the median and the maximum per call and for the run's finish time (when the last call ended). It uses only `bash`, `curl`, and `awk`, takes the host only as an argument, runs one mode per call, and sleeps 2 s between runs so a 10 run session stays well under the `catalog` limit (120 per minute per IP). It exits non zero if any call is not 200, and on a 429 it prints "Rate limited: wait a minute, then run again."
- **AC-3**: The spec's `verify.md` records a baseline taken on production before any fix: date, commit, 10 warm `--waterfall` runs, 10 warm `--parallel` runs, 10 warm `--serial` runs, and 3 cold runs (after more than 15 min idle). It also records the runtime facts found: `PHP_OPCACHE_ENABLE` as set in Render (or unset, meaning the image default), the PHP FPM process settings in effect, whether the Render deploy log shows Laravel's config and route caches being built, and the instance CPU and RAM shown in the Render dashboard.

*Latency fixes (each one is applied alone, measured, then kept or reverted)*
- **AC-4**: A fix is **kept** only when, over 10 warm runs in the matching mode, the median run finish time drops by at least 10% against the step before it; otherwise it is reverted and recorded in `verify.md` as "no measurable effect". Every attempt, kept or reverted, has its numbers in `verify.md`.
- **AC-5**: The server runtime candidates are tried in this order, each as its own step under AC-4: (a) `PHP_OPCACHE_ENABLE=1` in the Render container env; (b) the rate limiter on APCu (a PHP extension that keeps values in shared memory owned by the PHP FPM master process, so every worker reads and writes the same counters): `server/Dockerfile` installs the extension (`install-php-extensions apcu` as `root`, then back to `www-data`), `config/cache.php` gains an `'apc' => ['driver' => 'apc']` store and `'limiter' => env('CACHE_LIMITER_STORE') ?: null` (null falls back to the default store, so local, Pest, and CI are unchanged; the `?: null` matters because `CacheManager::store('')` does not fall back and throws "Cache store [] is not defined"), and Render sets `CACHE_LIMITER_STORE=apc`. The `file` store is never used for the limiter, because `FileStore::increment` reads, adds, and writes without a lock and loses hits under concurrent login, register, and checkout requests. If (b) is reverted under AC-4, the limiter stays on `database` (whose increment is atomic) and the Dockerfile, config, and AC-17 guard changes are reverted with it; (c) PHP FPM worker settings, only if AC-3 found fewer workers than the 5 parallel calls. The app cache stays `CACHE_STORE=database`.
- **AC-6**: The `/` route gets a loader that starts, without awaiting, `queryClient.prefetchQuery` for the layout and for every block the client knows (`banners`, `best_sellers`, `deals`, and `products` page 1), using the exact query option factories the blocks use, so the keys match. The loader returns at once, so the hidden `<h1>`, the skeleton, and the waking notice render as before. A block the layout leaves out costs one unused request (accepted). A prefetch that fails leaves the block's query in its error state, and the block's own `useQuery` then fetches again on mount with the existing retry rules (spec 0005 AC-8). Measured with `--waterfall` (before) against `--parallel` (after).
- **AC-7** (skipped by decision, 2026-11-16): Not built. This is a closed decision, not open work. The four home GETs keep the framework default `Cache-Control: no-cache, private`, and no `PublicCache` middleware exists. Reasons and the production headers behind them: [rationale.md, Browser cache decision](rationale.md#browser-cache-decision-ac-7-skipped-2026-11-16) and [verify.md, Step 3: AC-7](verify.md#step-3-ac-7-browser-cache-skipped). The original wording, kept for the record: "`GET /home`, `/home/banners`, `/home/best-sellers`, and `/home/deals` answer 200 with `Cache-Control: public, max-age=30`. Any other status (429, 5xx) gets no such header. No other route changes; `/products` and every `NoStore` route are untouched. Evidence: the header in a `curl -I`, and a browser reload within 30 s showing those four calls served from the browser cache."
- **AC-8**: Cold starts stay as they are (no keep alive ping, spec 0001). `verify.md` ends with a final production run (same modes as AC-3) after all kept fixes, and a short "Infrastructure limits" note: the cold start time measured, and for warm loads, how much of each call's total is server work (`app`) versus waiting before PHP picks it up (time to first byte minus `app`). That note is the source for the feature 18 README. *Amended 2026-11-16 (closeout)*: no new final run was taken. The final warm numbers are the Step 3 AC-6 `--parallel` run at `6e83f76`, taken after every kept fix; the commits after it change only cart code, no home endpoint and no server runtime setting. No final `--waterfall` or `--serial` run exists. The cold start numbers are the baseline cold runs at `eabd7aa` (taken before OPcache and APCu); they are reused because the measured wait happens before PHP runs, and they were not measured again.

*Cart caps (the "10 units charged for 6" case)*
- **AC-9**: Before any cart code changes, a `/debug` run reproduces the observation on a local database and records the root cause in `verify.md`. The expected cause is AC-3 of spec 0008: a second add of 10 when 6 keys are left silently stores 6, and checkout correctly buys the 6 the cart shows. If `/debug` finds instead that checkout charges or allocates a quantity different from the cart it was shown, that is a checkout bug: it gets a minimal fix and its own Pest regression test, and any behavior change goes back to `/architect`.
- **AC-10**: `POST /api/v1/cart/items` returns `{ data: Cart, meta: { adjustments: Adjustment[] } }`, where `Adjustment` is `{ offer_id: int, requested: int, added: int }`. `requested` is the request's `quantity` (default 1); `added` is the stored quantity after the write minus the stored quantity before it (0 for a new line). The list holds one entry when `added < requested`, and is `[]` otherwise. Every error (including "You already have the maximum for this offer.") and the error order stay exactly as in spec 0008 AC-3.
- **AC-11**: `POST /api/v1/cart/merge` returns the same `meta.adjustments`: one entry per guest line, in request order, whose `added` is below its guest `quantity`. That includes lines dropped entirely (`added: 0`): unknown, inactive, or out of stock offers, and lines past the 50 line limit. Lines added in full are not listed. Every other `Cart` endpoint (`GET /cart`, `PATCH`, `DELETE`, `POST /cart/preview`) keeps its response exactly as today, with no `meta`.
- **AC-12**: On the client, a signed in add whose response has one adjustment shows the toast "Only {added} available, so we added {added}." in place of the usual add success toast (same toast variant). A merge after sign in with one or more adjustments shows one toast: "Some items in your cart were changed to match available stock." Guest adds are unchanged (they cap locally per spec 0008 AC-8). The cart page's existing reduced note stays.
- **AC-13**: Regression tests: Pest, an offer with 6 available keys and a cart line of 0, add 10, returns `added: 6, requested: 10`, the cart line is 6, and `PlaceOrder` on that cart charges 6 times the unit price and allocates exactly 6 keys. Pest, an offer at 4 keys with a stored line of 2, add 5, returns `added: 2`. Pest, merge with one capped line, one out of stock line, and one full line returns exactly the first two as adjustments. Vitest plus Testing Library: the add toast text for an adjusted and a normal response, and the merge toast.

*Review findings*
- **AC-14**: Every finding in the 11 files under `docs/reviews/` has a final state in the triage table in [rationale.md](rationale.md#review-findings-triage): already resolved, fixed in this feature, or won't fix with a one line reason. Each review file gets an appended `## Resolution (feature 17, <date>)` section listing its findings by title with that state; the original findings text stays unchanged. *Amended 2026-11-16 (closeout)*: the states written in each Resolution section are **DONE** (resolved before this feature, or fixed in it), **DEFER** (a Fix or Check row not done in this feature, carried as a follow up), and **SKIP** (won't fix), each with a brief reason.
- **AC-15**: Every finding marked **Fix** in the triage table is done as that row describes, with a test where the row says so. Rows marked **Check** are checked in a real browser and recorded in `verify.md`; they become Fix (and are fixed) only if the check confirms the problem, else Won't fix with what was seen. *Amended 2026-11-16 (closeout)*: the Fix and Check rows done in Steps 3 and 4 stay as recorded. Every other Fix or Check row is **deferred**, not done and not checked: the remaining buy journey rows and all auth rows. None is a correctness, security, or critical UX defect for the purchase flow. The list is in [rationale.md, Closeout decision](rationale.md#closeout-decision-2026-11-16).
*Limiter store (added 2026-11-16, applies only while AC-5 (b) is kept)*
- **AC-17**: (i) A web request (not console) fails at boot with a `RuntimeException` in two cases: `cache.limiter` is a non empty string with no matching `cache.stores.<name>` entry ("Rate limiter store [<name>] is not configured."), or that store's driver is `apc` and `function_exists('apcu_enabled') && apcu_enabled()` is false ("Rate limiter store uses APCu, but APCu is not enabled."). Null or `''` means the default store and passes. Without this, a loaded but disabled APCu makes `apcu_inc` return false, the limiter reads 0 hits, and every limit is silently off. A typo in the store name already fails every boot, console included, because `RateLimiter::for` in `boot()` resolves the limiter's cache store (`InvalidArgumentException` "Cache store [<name>] is not defined."); on a web request the guard runs first and gives the clearer message. Console runs are skipped because `apc.enable_cli` is `0` and the image runs `artisan` at build and start. On Render, the failed boot makes `/up` (the health check, spec 0001) return 500, so the deploy fails and the previous version stays live. (ii) The existing limiter tests stay unchanged and green on the `array` store: `AuthRateLimitTest` (all 7), the checkout limit in `CheckoutAccessTest`, and the 429 case in `ServerTimingTest`. (iii) New Pest tests in `tests/Unit/LimiterStoreGuardTest.php`, calling the guard directly: throws for an unconfigured store name; throws for an `apc` store with APCu off; passes for an `apc` store with APCu on, for a non `apc` store, for null, and for `''`. A feature test checks `cache.limiter` is null by default and the `apc` store is configured with driver `apc`. The call from `boot()` itself is not covered by Pest (`runningInConsole()` is always true there); AC-17 (iv) covers it on production. (iv) `verify.md` records on production, after the deploy: `/home` reports `desc="1 queries"` in `Server-Timing` (the limiter queries are gone); 6 failed logins in one minute for one unused email return 422 five times then 429 with `Retry-After`; the Render memory graph before and after, only where the plan shows one. Render Free shows no CPU or memory metrics, so on Free `verify.md` records that limitation, the 512 MB instance limit, the local APCu memory figures, and the residual out of memory risk instead (no estimate in place of a measurement).
- **AC-16**: CI is green on the final commit (server: Pint, PHPStan, Pest; checkout concurrency; client: Prettier, oxlint, typecheck, Vitest, build), and the full purchase journey still works on production after the deploy. *Amended 2026-11-16 (closeout)*: the production part is met by narrower evidence. It is the production smoke test of `4959afe` (cart, merge, toasts, the checkout page total, and the confirmation heading states, with no payment submitted), plus a full purchase on a local stack and the checkout concurrency script (5 rounds in CI on `4959afe`). **A full purchase on production (payment, key allocation, stock drop, and key reveal after this feature's deploys) was not tested.**

## Decision

**Chosen option**: Option 1: Measure first, fix in place, one change at a time.

You measure the homepage with a script and a `Server-Timing` header, then try a short ordered list of fixes (OPcache, limiter off the database, FPM workers if needed, route loader prefetch), keeping each only if it cuts the median by at least 10%; a 30 s browser cache on the home endpoints was weighed and skipped (AC-7); cart caps become visible through `meta.adjustments`; review findings are triaged by kind (fix bugs, accessibility, reliability, security; decline style).

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: No schema change. No migration.

**API surface**:
| Endpoint | Method | Change | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| every matched `/api/v1/*` route | any | adds a response header | `Server-Timing` (AC-1) | unchanged | unchanged |
| `/api/v1/cart/items` | POST | adds `meta` | `{ data: Cart, meta: { adjustments } }` (AC-10) | bearer | spec 0008 AC-3 errors, same order |
| `/api/v1/cart/merge` | POST | adds `meta` | `{ data: Cart, meta: { adjustments } }` (AC-11) | bearer | spec 0008 AC-6, unchanged |

Server shape (project rule: thin controllers, Form Requests, actions, Resources):
- `App\Support\RequestTimings`: a small holder (`queryCount`, `queryMs`, `record(float $ms)`), bound with `$this->app->scoped(...)` in `AppServiceProvider`, which also registers one `DB::listen` callback that calls `record($event->time)`. Scoped means a fresh holder per request.
- `App\Http\Middleware\ServerTiming`: registered by `prependToGroup('api', …)` in `bootstrap/app.php`, and also put first in the priority list with `prependToPriorityList(AuthenticatesRequests::class, ServerTiming::class)` placed after the `NoStore` call (so it lands ahead of `NoStore`). Without that, Laravel sorts `throttle` and `auth` ahead of it and their 401 and 429 would skip the header (the same gotcha `NoStore` has in `server/AGENTS.md`). On the way out it reads `RequestTimings` and `LARAVEL_START` and sets the header.
- No cache middleware on the `home.` route group: `PublicCache` is not built (AC-7 skipped). The home routes stay exactly as spec 0014 left them.
- Limiter store (AC-5 (b), AC-17): `server/Dockerfile` adds `USER root` · `RUN install-php-extensions apcu` · `USER www-data` before the `composer install` layer. `config/cache.php` gains the `apc` store and the `limiter` key. `App\Support\LimiterStoreGuard::assertUsable(?string $storeName, ?array $storeConfig, bool $apcuEnabled): void` holds the AC-17 rule as a plain function (so Pest can test it without APCu) and throws the global `RuntimeException`. As the first statement of `AppServiceProvider::boot`, only when `! $this->app->runningInConsole()`, the provider reads `config('cache.limiter')` and `config("cache.stores.$name")`, narrows them with `is_string()` and `is_array()` (PHPStan level 6: `config()` returns `mixed`), and passes `function_exists('apcu_enabled') && apcu_enabled()`. The general cache (`CACHE_STORE=database`) and sessions are not touched.
- `AddCartItem::handle` and `MergeGuestCart::handle` return a list of `CartAdjustment` value objects (`App\Support\CartAdjustment`, readonly `offerId`, `requested`, `added`). `UpsertCartLine` becomes a `selectOne` with `RETURNING quantity`, so `added` is computed from the value Postgres actually stored, under the existing `CartLock`. The controller passes the list to `CartResource` via `->additional(['meta' => ['adjustments' => …]])`.

Client shape:
- `client/src/router.tsx`: the index route gets `loader: homeLoader` from `client/src/pages/homeLoader.ts`, which calls `void queryClient.prefetchQuery(…)` for each query and returns `null`.
- `client/src/api/cart.ts`: `addCartItem` and `mergeCart` return `{ cart: Cart; adjustments: CartAdjustment[] }` (`CartAdjustment` is `{ offer_id, requested, added }`). `updateCartItem`, `removeCartItem`, `fetchCart`, and `previewCart` keep returning `Cart`. The `Cart` type is unchanged.
- `client/src/lib/cart.ts`: `runCartWrite` writes `result.cart` to the cache for the two new return shapes. `useCartActions().add` resolves to the adjustments list (`[]` for a guest add). `mergeGuestCart()` resolves to the merge's adjustments (`[]` when nothing was sent). The components that already show the add toast and run the merge after sign in pick the AC-12 text from those lists; no toast is fired inside `lib/`.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| `ServerTiming` | `app` duration | `microtime(true)` minus the `LARAVEL_START` constant set in `public/index.php` |
| `ServerTiming` | `db` duration, query count | sum and count of `Illuminate\Database\Events\QueryExecuted::$time` for the request |
| `measure-home.sh` | per call connect, first byte, total | `curl -w '%{time_connect} %{time_starttransfer} %{time_total}'` |
| `measure-home.sh` | `app`, `db` | the response's `Server-Timing` header (AC-1) |
| `measure-home.sh` | the five paths | AC-2 list; products query string from `client/src/api/products.ts` |
| `measure-home.sh` | host | first CLI argument, never hardcoded |
| AC-3 runtime facts | OPcache, FPM, caches, CPU and RAM | Render dashboard env vars, Render deploy log, Render instance page |
| AC-4 keep rule | "step before" median | the previous row in `verify.md` for the same mode |
| Add `meta.adjustments` | `requested` | request `quantity`, default 1 (spec 0008 AC-3) |
| Add `meta.adjustments` | `added` | `RETURNING quantity` minus the stored quantity read under `CartLock` (0 if no row) |
| Merge `meta.adjustments` | `requested` | the guest line's `quantity` from the request body |
| Merge `meta.adjustments` | `added` | `RETURNING quantity` minus the prior stored quantity; 0 for a dropped line |
| Add toast | `{added}` | `meta.adjustments[0].added` |
| Limiter store | store name | `CACHE_LIMITER_STORE` env (`apc` in Render), null means the default store |
| `LimiterStoreGuard` | store name, store config | `config('cache.limiter')` (null or `''` means default), then `config("cache.stores.<name>")` (null when missing) |
| `LimiterStoreGuard` | APCu on | `function_exists('apcu_enabled') && apcu_enabled()` |

**Key invariants**:
- No performance change ships without a before and after row in `verify.md` (AC-4).
- No route under `/api/v1` sends `Cache-Control: public`. The home GETs keep the framework default `no-cache, private`, and every `NoStore` route keeps `no-store`.
- `meta.adjustments` never changes the `Cart` shape; every `Cart` field and rule in spec 0008 AC-2 holds.
- `added` is never above `requested`, never negative, and the stored quantity is still at most `min(stock, 10)`.
- Checkout charges exactly the effective quantities of the cart it validated against (spec 0009 unchanged).
- The rate limiter never runs on the `file` store, and never runs on APCu while APCu is disabled (AC-17).

**Security model**: No new routes and no auth changes. `Server-Timing` exposes only durations and a query count, never SQL, data, or hosts. No response becomes cacheable by a shared cache (AC-7 skipped). Correction to the first draft, which said the bearer token is never sent to the home endpoints: it is. `apiFetch` (`client/src/api/client.ts`) attaches `Authorization: Bearer <token>` to every request whenever a token is stored, public catalog and home calls included. The home responses hold no user data, so nothing leaks today, but this is why `public` was unsafe: it is the directive that lets a shared cache store a response to a request that carried `Authorization`. Cloudflare in front of Render answers these paths with `cf-cache-status: DYNAMIC` (not cached), and Render, not this project, controls that layer. The cart `meta` is in the owner's own response only. The triage adds three security fixes: a constant time login check for unknown emails, max lengths on login fields, and an escaped preview origin pattern (today a `#` in that env value makes `preg_match` fail, which turns the preview write guard off). No regulated data.

**Configuration required**:
- `CACHE_LIMITER_STORE`: cache store for the rate limiter; unset falls back to `CACHE_STORE`. Add to `server/.env.example` as a commented out line (`# CACHE_LIMITER_STORE=apc`), never as an empty `CACHE_LIMITER_STORE=`. Leave it unset locally: `php artisan serve` is not console but has no APCu, so the guard would refuse to boot. Render: `apc`, only if AC-5 (b) is kept. Render builds the config cache at container start (spec 0001 AUTORUN), so it sees this value.
- APCu extension in `server/Dockerfile` (AC-5 (b)). Image defaults are kept: `apc.shm_size=32M`, `apc.enable_cli=0`, `apc.use_request_time=0` (expiry uses the real clock). No new Render env beyond `CACHE_LIMITER_STORE`.
- `PHP_OPCACHE_ENABLE=1`: Render container env, only if AC-5 (a) is kept.
- PHP FPM worker env vars of the `serversideup/php` image: only if AC-5 (c) runs and is kept; read the exact names from that image's docs for the installed tag before setting them.

**Critical test scenarios**:
- `ServerTiming` (Pest): a 200, a 404, and a 429 under `/api/v1` each carry a header matching `^app;dur=\d+(\.\d)?, db;dur=\d+(\.\d)?;desc="\d+ queries"$`; a route with 3 queries reports `3 queries`; two requests in a row each report their own count, verifies **AC-1**
- Cart adjustments (Pest): the three AC-13 cases plus "add within stock returns `adjustments: []`" and "at max still 422 with no meta", verifies **AC-10**, **AC-11**, **AC-13**
- Checkout pin (Pest): the AC-13 end to end case, 6 keys allocated and 6 times the price charged, verifies **AC-9**, **AC-13**
- Home prefetch (Vitest): rendering the `/` route with a mocked `apiFetch` starts all five requests before the layout resolves; a failed prefetch still shows that block's `ErrorState` with "Try again", verifies **AC-6**
- Toasts (Vitest plus Testing Library): adjusted add, normal add, and merge with adjustments, verifies **AC-12**
- Limiter store (Pest): existing limiter tests unchanged; `cache.limiter` null by default; `apc` store configured; guard throws for an unknown store and for `apc` with APCu off, passes for null, `''`, a non `apc` store, and `apc` with APCu on, verifies **AC-17** (i) to (iii)
- Limiter store (production, manual): `/home` shows `1 queries`; the 6th failed login in a minute is 429 with `Retry-After`, verifies **AC-17** (iv)
- Script (manual): `measure-home.sh` against local `php artisan serve` prints all three modes and exits non zero when the server is stopped, verifies **AC-2**

## Build plan

Journey approach: the evidence comes first, then the browse journey (homepage), then the buy journey (cart and checkout), then the account journey, each finished with its tests before the next.

1. [x] **Evidence.** Add `ServerTiming` with its Pest test, write `scripts/measure-home.sh`, deploy, and record the production baseline and runtime facts in `verify.md`, satisfies **AC-1**, **AC-2**, **AC-3**
2. [x] **Server runtime.** Try AC-5 (a), (b), (c) in order, one deploy each, measuring and keeping or reverting per AC-4; for (b), build the APCu image, `config/cache.php` entries, `CACHE_LIMITER_STORE` in `.env.example`, `LimiterStoreGuard` and its Pest tests in one commit, check CI green, set `CACHE_LIMITER_STORE=apc` in Render, deploy, then record the AC-4 numbers (bar: median ≤ 876.1 ms) and the AC-17 (iv) evidence; revert all of it if not kept, satisfies **AC-4**, **AC-5**, **AC-17**
3. [x] **Homepage client.** Done: route loader prefetch with its Vitest test, measured and kept (`verify.md` Step 3, AC-4 KEEP). Closed by decision: AC-7 `PublicCache` skipped on 2026-11-16, nothing to build. Browse journey triage rows done on 2026-11-16 (`verify.md` Step 3: browse journey triage rows): ScrollRail fixed with a regression test, skeleton shortcuts row fixed, featured banner check confirmed a tagline contrast failure from `xl` and the gradient was fixed, SortSelect checked in Firefox 159 and left as NO CHANGE, satisfies **AC-4**, **AC-6**, **AC-15** (AC-7 skipped)
4. [x] **Cart caps and the buy journey.** `/debug` the observation and record the cause; `CartAdjustment`, `RETURNING` upsert, `meta` on add and merge, client toasts, all AC-13 tests; then the buy journey triage rows (int cast, CartPage test, stepper announcement check, confirmation heading, product page tests, `otherOffersSummary` move, design.md rows), satisfies **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**, **AC-15**. Done in `4959afe`: AC-9 to AC-13, the `(int)` cast, and the confirmation heading. Deferred at closeout (not done): CartPage test, stepper announcement check, product page tests, `otherOffersSummary` move, design.md rows.
5. [x] **Account journey and close out.** The auth triage rows with their tests; append the Resolution section to all 11 review files; final production measurement and the Infrastructure limits note; CI green and a production purchase run, satisfies **AC-8**, **AC-14**, **AC-15**, **AC-16**. Closed as amended on 2026-11-16: all auth rows deferred (not done); Resolution sections appended; AC-8 reuses the existing final warm and cold numbers (no new run) and the Infrastructure limits note is written; CI green on `4959afe`; **no production purchase run**, AC-16 rests on the production smoke test plus local evidence.

## Consequences

**Positive**:
- Every performance claim in the submission has numbers behind it, and nothing that did not help stays in the code.
- `Server-Timing` keeps paying off: any slow call can be split into server work and queueing from a plain `curl`.
- A buyer is never surprised by a lower quantity at checkout.
- The review history ends with no unacknowledged finding.

**Negative / tradeoffs**:
- A full reload of `/` always refetches the five home calls (AC-7 skipped). Accepted: they finish in about 575 ms warm, and TanStack's 60 s `staleTime` already avoids repeat calls while you move around inside the app.
- The homepage prefetch spends one request on any block the layout has hidden.
- `Server-Timing` adds one `DB::listen` callback to every request (tiny, but not zero).
- If the 32 MB APCu segment ever fills, `apcu_inc` can fail and the limits fail open. Accepted: the limiter uses about 140 KB in the probe.
- A limiter on APCu resets on every deploy, restart, FPM reload, and free tier spin down (after 15 min idle), so a slow attacker who waits out an idle spell gets a fresh `register` hour. Accepted: the limits guard a demo store, and each reset still needs 15 min of no traffic.
- APCu counts per container. Render free runs one instance, so the counts are correct; with more than one instance each would count alone (limit times N), so move the limiter back to `database` or to Redis before scaling out. During a deploy, old and new containers briefly count apart.
- `ApcStore` has no atomic `add`, so the first concurrent hits of a fresh window can still lose a hit (1 of 300 in the probe, against 36 of 300 on `file`). Accepted: `ThrottleRequests` already checks before it counts, so a burst can pass the limit by up to its own size on every store.
- The image build gains one extension compile (cached until the base layer changes), and APCu reserves 32 MB of shared memory, of which only used pages count.
- Warm load on Render free will likely stay slower than a paid host; the spec accepts and documents that instead of paying or rebuilding.
- About 20 small fixes land late in the project, each a small regression risk; the existing test suites and the final production purchase run are the guard. *Closeout*: only a few of those fixes landed, and the production purchase run was not done, so the guard is the test suites, CI, and the production smoke test.

**Neutral**:
- Measurements need several deploys (one per runtime candidate), each about a few minutes on Render.
- `verify.md` becomes the source of the README's performance section (feature 18).

## Follow-up

- [x] After confirmation: add the "Amended by spec 0016" note to specs 0008 and 0014 (done 2026-11-16).
- [ ] `/sync` after the build: record `Server-Timing`, `meta.adjustments`, and `scripts/measure-home.sh` in `server/AGENTS.md`, `client/AGENTS.md`, and the root Commands block.
- [ ] Feature 18: README performance section from the `verify.md` Infrastructure limits note.
- [ ] Feature 18: decide whether to run one full purchase on production (AC-16 did not test it).
- [ ] Known CI flake: `StoreFiltersTest` "loads a filtered page in a fixed number of queries" fails about 6 in 1000 runs (two random product names, neither containing "a" for `q=a`). Not fixed; rerun the failed job.
- [ ] Temporary production account `smoke-f17-1794830008@example.test` ("Smoke Test") stays in production: no delete endpoint exists. Cart empty, no orders, tokens revoked. Remove it by hand or keep it as the demo account (feature 18).
- [ ] The deferred triage rows (AC-15 closeout list in rationale.md): pick up only if feature 18 has time.
- [ ] Spec 0015 AC-9 still describes the old featured banner gradient ("`surface-deep/95` to transparent at 60%"); `b8293a7` changed it to `from-surface-deep/95 via-surface-deep/70 via-45% to-transparent to-70%`. Spec 0015 rationale also says a stronger gradient was rejected. Route to `/architect` or flag in `/sync`.
