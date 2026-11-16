# 0016. Performance and reliability: measure the homepage first, keep only the fixes the numbers justify, tell buyers when the cart caps, and close every open review finding

**Date**: 2026-11-16
**Status**: In Progress

> **Amends** [spec 0008](../0008-cart/index.md) AC-3 and AC-6 (caps are no longer silent: add and merge report them in `meta.adjustments`) and [spec 0014](../0014-homepage-blocks/index.md) AC-3 and AC-9 (the four home endpoints may be served from the browser cache for up to 30 s, and the `/` route prefetches every block). Everything else in those specs still holds.

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
- **AC-1**: Every response under `/api/v1` (success and error alike, including 401, 404, 422, 429, 500) carries `Server-Timing: app;dur=<ms>, db;dur=<ms>;desc="<n> queries"`. `app` is the milliseconds from `LARAVEL_START` to the moment the response leaves the middleware; `db` is the sum of `QueryExecuted::$time` for that request; `<n>` is the number of queries. Durations have at most one decimal. No other value (no SQL, no hostnames, no versions) appears in the header.
- **AC-2**: `scripts/measure-home.sh <api-base-url> [runs]` (default 10 runs) measures the five homepage calls the client makes: `/home`, `/home/banners`, `/home/best-sellers`, `/home/deals`, and the grid's `/products` page 1 request (its exact query string taken from `client/src/api/products.ts`). Three modes: `--parallel` (default: all five at once, like the client after AC-6), `--waterfall` (`/home` first, then the other four at once, like the client today), and `--serial` (one after another, to show single call cost). Per run it prints each call's connect time, time to first byte, total time, and the `Server-Timing` `app` and `db` values; at the end it prints the median and the maximum per call and for the run's finish time (when the last call ended). It uses only `bash`, `curl`, and `awk`, takes the host only as an argument, runs one mode per call, and sleeps 2 s between runs so a 10 run session stays well under the `catalog` limit (120 per minute per IP). It exits non zero if any call is not 200, and on a 429 it prints "Rate limited: wait a minute, then run again."
- **AC-3**: The spec's `verify.md` records a baseline taken on production before any fix: date, commit, 10 warm `--waterfall` runs, 10 warm `--parallel` runs, 10 warm `--serial` runs, and 3 cold runs (after more than 15 min idle). It also records the runtime facts found: `PHP_OPCACHE_ENABLE` as set in Render (or unset, meaning the image default), the PHP FPM process settings in effect, whether the Render deploy log shows Laravel's config and route caches being built, and the instance CPU and RAM shown in the Render dashboard.

*Latency fixes (each one is applied alone, measured, then kept or reverted)*
- **AC-4**: A fix is **kept** only when, over 10 warm runs in the matching mode, the median run finish time drops by at least 10% against the step before it; otherwise it is reverted and recorded in `verify.md` as "no measurable effect". Every attempt, kept or reverted, has its numbers in `verify.md`.
- **AC-5**: The server runtime candidates are tried in this order, each as its own step under AC-4: (a) `PHP_OPCACHE_ENABLE=1` in the Render container env; (b) the rate limiter on the `file` store through `config/cache.php` `'limiter' => env('CACHE_LIMITER_STORE')` (null falls back to the default store, so local and tests are unchanged) with `CACHE_LIMITER_STORE=file` in Render; (c) PHP FPM worker settings, only if AC-3 found fewer workers than the 5 parallel calls. The app cache stays `CACHE_STORE=database`.
- **AC-6**: The `/` route gets a loader that starts, without awaiting, `queryClient.prefetchQuery` for the layout and for every block the client knows (`banners`, `best_sellers`, `deals`, and `products` page 1), using the exact query option factories the blocks use, so the keys match. The loader returns at once, so the hidden `<h1>`, the skeleton, and the waking notice render as before. A block the layout leaves out costs one unused request (accepted). A prefetch that fails leaves the block's query in its error state, and the block's own `useQuery` then fetches again on mount with the existing retry rules (spec 0005 AC-8). Measured with `--waterfall` (before) against `--parallel` (after).
- **AC-7**: `GET /home`, `/home/banners`, `/home/best-sellers`, and `/home/deals` answer 200 with `Cache-Control: public, max-age=30`. Any other status (429, 5xx) gets no such header. No other route changes; `/products` and every `NoStore` route are untouched. Evidence: the header in a `curl -I`, and a browser reload within 30 s showing those four calls served from the browser cache.
- **AC-8**: Cold starts stay as they are (no keep alive ping, spec 0001). `verify.md` ends with a final production run (same modes as AC-3) after all kept fixes, and a short "Infrastructure limits" note: the cold start time measured, and for warm loads, how much of each call's total is server work (`app`) versus waiting before PHP picks it up (time to first byte minus `app`). That note is the source for the feature 18 README.

*Cart caps (the "10 units charged for 6" case)*
- **AC-9**: Before any cart code changes, a `/debug` run reproduces the observation on a local database and records the root cause in `verify.md`. The expected cause is AC-3 of spec 0008: a second add of 10 when 6 keys are left silently stores 6, and checkout correctly buys the 6 the cart shows. If `/debug` finds instead that checkout charges or allocates a quantity different from the cart it was shown, that is a checkout bug: it gets a minimal fix and its own Pest regression test, and any behavior change goes back to `/architect`.
- **AC-10**: `POST /api/v1/cart/items` returns `{ data: Cart, meta: { adjustments: Adjustment[] } }`, where `Adjustment` is `{ offer_id: int, requested: int, added: int }`. `requested` is the request's `quantity` (default 1); `added` is the stored quantity after the write minus the stored quantity before it (0 for a new line). The list holds one entry when `added < requested`, and is `[]` otherwise. Every error (including "You already have the maximum for this offer.") and the error order stay exactly as in spec 0008 AC-3.
- **AC-11**: `POST /api/v1/cart/merge` returns the same `meta.adjustments`: one entry per guest line, in request order, whose `added` is below its guest `quantity`. That includes lines dropped entirely (`added: 0`): unknown, inactive, or out of stock offers, and lines past the 50 line limit. Lines added in full are not listed. Every other `Cart` endpoint (`GET /cart`, `PATCH`, `DELETE`, `POST /cart/preview`) keeps its response exactly as today, with no `meta`.
- **AC-12**: On the client, a signed in add whose response has one adjustment shows the toast "Only {added} available, so we added {added}." in place of the usual add success toast (same toast variant). A merge after sign in with one or more adjustments shows one toast: "Some items in your cart were changed to match available stock." Guest adds are unchanged (they cap locally per spec 0008 AC-8). The cart page's existing reduced note stays.
- **AC-13**: Regression tests: Pest, an offer with 6 available keys and a cart line of 0, add 10, returns `added: 6, requested: 10`, the cart line is 6, and `PlaceOrder` on that cart charges 6 times the unit price and allocates exactly 6 keys. Pest, an offer at 4 keys with a stored line of 2, add 5, returns `added: 2`. Pest, merge with one capped line, one out of stock line, and one full line returns exactly the first two as adjustments. Vitest plus Testing Library: the add toast text for an adjusted and a normal response, and the merge toast.

*Review findings*
- **AC-14**: Every finding in the 11 files under `docs/reviews/` has a final state in the triage table in [rationale.md](rationale.md#review-findings-triage): already resolved, fixed in this feature, or won't fix with a one line reason. Each review file gets an appended `## Resolution (feature 17, <date>)` section listing its findings by title with that state; the original findings text stays unchanged.
- **AC-15**: Every finding marked **Fix** in the triage table is done as that row describes, with a test where the row says so. Rows marked **Check** are checked in a real browser and recorded in `verify.md`; they become Fix (and are fixed) only if the check confirms the problem, else Won't fix with what was seen.
- **AC-16**: CI is green on the final commit (server: Pint, PHPStan, Pest; checkout concurrency; client: Prettier, oxlint, typecheck, Vitest, build), and the full purchase journey still works on production after the deploy.

## Decision

**Chosen option**: Option 1: Measure first, fix in place, one change at a time.

You measure the homepage with a script and a `Server-Timing` header, then try a short ordered list of fixes (OPcache, limiter off the database, FPM workers if needed, route loader prefetch, a 30 s browser cache on the home endpoints), keeping each only if it cuts the median by at least 10%; cart caps become visible through `meta.adjustments`; review findings are triaged by kind (fix bugs, accessibility, reliability, security; decline style).

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: No schema change. No migration.

**API surface**:
| Endpoint | Method | Change | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| every `/api/v1/*` | any | adds a response header | `Server-Timing` (AC-1) | unchanged | unchanged |
| `/api/v1/home`, `/home/banners`, `/home/best-sellers`, `/home/deals` | GET | adds a header on 200 only | `Cache-Control: public, max-age=30` (AC-7) | public | 429 unchanged, no cache header |
| `/api/v1/cart/items` | POST | adds `meta` | `{ data: Cart, meta: { adjustments } }` (AC-10) | bearer | spec 0008 AC-3 errors, same order |
| `/api/v1/cart/merge` | POST | adds `meta` | `{ data: Cart, meta: { adjustments } }` (AC-11) | bearer | spec 0008 AC-6, unchanged |

Server shape (project rule: thin controllers, Form Requests, actions, Resources):
- `App\Support\RequestTimings`: a small holder (`queryCount`, `queryMs`, `record(float $ms)`), bound with `$this->app->scoped(...)` in `AppServiceProvider`, which also registers one `DB::listen` callback that calls `record($event->time)`. Scoped means a fresh holder per request.
- `App\Http\Middleware\ServerTiming`: registered by `prependToGroup('api', …)` in `bootstrap/app.php`, and also put first in the priority list with `prependToPriorityList(AuthenticatesRequests::class, ServerTiming::class)` placed after the `NoStore` call (so it lands ahead of `NoStore`). Without that, Laravel sorts `throttle` and `auth` ahead of it and their 401 and 429 would skip the header (the same gotcha `NoStore` has in `server/AGENTS.md`). On the way out it reads `RequestTimings` and `LARAVEL_START` and sets the header.
- `App\Http\Middleware\PublicCache` (takes `max_age` as a route middleware parameter): sets `Cache-Control: public, max-age=<n>` only when the status is 200. Applied to the `home.` route group with `30`. Laravel's built in `cache.headers` is not used, because it also stamps the 429 that the inner `throttle` returns.
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
| `PublicCache` | max age | route middleware parameter `30` (AC-7) |
| Add `meta.adjustments` | `requested` | request `quantity`, default 1 (spec 0008 AC-3) |
| Add `meta.adjustments` | `added` | `RETURNING quantity` minus the stored quantity read under `CartLock` (0 if no row) |
| Merge `meta.adjustments` | `requested` | the guest line's `quantity` from the request body |
| Merge `meta.adjustments` | `added` | `RETURNING quantity` minus the prior stored quantity; 0 for a dropped line |
| Add toast | `{added}` | `meta.adjustments[0].added` |
| Limiter store | store name | `CACHE_LIMITER_STORE` env, null means the default store |

**Key invariants**:
- No performance change ships without a before and after row in `verify.md` (AC-4).
- `Cache-Control: public` is never set on a non 200 response, on an authenticated route, or on any route that has `NoStore`.
- `meta.adjustments` never changes the `Cart` shape; every `Cart` field and rule in spec 0008 AC-2 holds.
- `added` is never above `requested`, never negative, and the stored quantity is still at most `min(stock, 10)`.
- Checkout charges exactly the effective quantities of the cart it validated against (spec 0009 unchanged).

**Security model**: No new routes and no auth changes. `Server-Timing` exposes only durations and a query count, never SQL, data, or hosts. `public, max-age=30` is limited to four anonymous catalog responses that hold no user data; the bearer token is never sent to them, and Cloudflare in front of Render does not cache JSON by default. The cart `meta` is in the owner's own response only. The triage adds three security fixes: a constant time login check for unknown emails, max lengths on login fields, and an escaped preview origin pattern (today a `#` in that env value makes `preg_match` fail, which turns the preview write guard off). No regulated data.

**Configuration required**:
- `CACHE_LIMITER_STORE`: cache store for the rate limiter; unset falls back to `CACHE_STORE`. Add to `server/.env.example` (empty). Render: `file`, only if AC-5 (b) is kept.
- `PHP_OPCACHE_ENABLE=1`: Render container env, only if AC-5 (a) is kept.
- PHP FPM worker env vars of the `serversideup/php` image: only if AC-5 (c) runs and is kept; read the exact names from that image's docs for the installed tag before setting them.

**Critical test scenarios**:
- `ServerTiming` (Pest): a 200, a 404, and a 429 under `/api/v1` each carry a header matching `^app;dur=\d+(\.\d)?, db;dur=\d+(\.\d)?;desc="\d+ queries"$`; a route with 3 queries reports `3 queries`; two requests in a row each report their own count, verifies **AC-1**
- `PublicCache` (Pest): each of the four home GETs has `Cache-Control: public, max-age=30`; the 121st call in a minute (429) has no `public`; `/products` and `/orders` unchanged, verifies **AC-7**
- Cart adjustments (Pest): the three AC-13 cases plus "add within stock returns `adjustments: []`" and "at max still 422 with no meta", verifies **AC-10**, **AC-11**, **AC-13**
- Checkout pin (Pest): the AC-13 end to end case, 6 keys allocated and 6 times the price charged, verifies **AC-9**, **AC-13**
- Home prefetch (Vitest): rendering the `/` route with a mocked `apiFetch` starts all five requests before the layout resolves; a failed prefetch still shows that block's `ErrorState` with "Try again", verifies **AC-6**
- Toasts (Vitest plus Testing Library): adjusted add, normal add, and merge with adjustments, verifies **AC-12**
- Script (manual): `measure-home.sh` against local `php artisan serve` prints all three modes and exits non zero when the server is stopped, verifies **AC-2**

## Build plan

Journey approach: the evidence comes first, then the browse journey (homepage), then the buy journey (cart and checkout), then the account journey, each finished with its tests before the next.

1. **Evidence.** Add `ServerTiming` with its Pest test, write `scripts/measure-home.sh`, deploy, and record the production baseline and runtime facts in `verify.md`, satisfies **AC-1**, **AC-2**, **AC-3**
2. **Server runtime.** Try AC-5 (a), (b), (c) in order, one deploy each, measuring and keeping or reverting per AC-4; add `CACHE_LIMITER_STORE` to `config/cache.php` and `.env.example` only if (b) is kept, satisfies **AC-4**, **AC-5**
3. **Homepage client and cache.** Route loader prefetch with its Vitest test, measured; `PublicCache` on the home group with its Pest test, checked in a browser reload; then the browse journey triage rows (ScrollRail, skeleton shortcuts row, featured banner check, SortSelect check), satisfies **AC-4**, **AC-6**, **AC-7**, **AC-15**
4. **Cart caps and the buy journey.** `/debug` the observation and record the cause; `CartAdjustment`, `RETURNING` upsert, `meta` on add and merge, client toasts, all AC-13 tests; then the buy journey triage rows (int cast, CartPage test, stepper announcement check, confirmation heading, product page tests, `otherOffersSummary` move, design.md rows), satisfies **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**, **AC-15**
5. **Account journey and close out.** The auth triage rows with their tests; append the Resolution section to all 11 review files; final production measurement and the Infrastructure limits note; CI green and a production purchase run, satisfies **AC-8**, **AC-14**, **AC-15**, **AC-16**

## Consequences

**Positive**:
- Every performance claim in the submission has numbers behind it, and nothing that did not help stays in the code.
- `Server-Timing` keeps paying off: any slow call can be split into server work and queueing from a plain `curl`.
- A buyer is never surprised by a lower quantity at checkout.
- The review history ends with no unacknowledged finding.

**Negative / tradeoffs**:
- Best sellers and Deals can show data up to 30 s old on a reload (spec 0014 AC-3 said "moves on the next fetch"). TanStack's 60 s `staleTime` already allowed staleness within one visit, so the new cost is only across reloads.
- The homepage prefetch spends one request on any block the layout has hidden.
- `Server-Timing` adds one `DB::listen` callback to every request (tiny, but not zero).
- A limiter on the `file` store resets on every deploy and would be wrong with more than one instance; revisit if the API ever scales out.
- Warm load on Render free will likely stay slower than a paid host; the spec accepts and documents that instead of paying or rebuilding.
- About 20 small fixes land late in the project, each a small regression risk; the existing test suites and the final production purchase run are the guard.

**Neutral**:
- Measurements need several deploys (one per runtime candidate), each about a few minutes on Render.
- `verify.md` becomes the source of the README's performance section (feature 18).

## Follow-up

- [x] After confirmation: add the "Amended by spec 0016" note to specs 0008 and 0014 (done 2026-11-16).
- [ ] `/sync` after the build: record `Server-Timing`, `PublicCache`, `meta.adjustments`, and `scripts/measure-home.sh` in `server/AGENTS.md`, `client/AGENTS.md`, and the root Commands block.
- [ ] Feature 18: README performance section from the `verify.md` Infrastructure limits note.
