# 0016. Performance and reliability: rationale

## Context

The API runs as one Render free web service (a Docker container with NGINX and PHP FPM from the `serversideup/php:8.4-fpm-nginx` image) in Frankfurt, talking to Neon Postgres in Frankfurt over a direct TLS connection (spec 0001). The homepage review (2026-11-13) observed that each of the five homepage calls takes about 0.9 s alone but 6 to 9 s when the five run together. That pattern points at queueing (requests waiting for CPU or a PHP worker) rather than slow queries, but nothing in the system today can tell server work apart from waiting, so any fix would be a guess.

Several suspects stack up, none measured (basis: code and spec reading): the image ships OPcache (PHP's compiled code cache) off by default, so every request may compile Laravel from scratch; `CACHE_STORE=database` means the rate limiter on every call does a read and a write against Neon; each PHP request opens a fresh TLS connection to Neon; and the client asks for the layout first, then the four blocks, so the page always pays one extra round trip. Render documents the free instance's sleep and hours, but the CPU share was not confirmed during this design (see References), and it is the most likely ceiling.

Separately, a 10 unit checkout charged for 6. The cart caps an add at available stock silently, by design (spec 0008 AC-3, AC-6), and checkout buys what the cart shows. Whether that is the whole story is unconfirmed. The buyer was not told, which is the real defect either way.

Finally, 11 review files hold findings in mixed states: some fixed and noted, some fixed without a note, some accepted and left, some still open. The submission needs every one closed or consciously declined. The assignment is graded on correctness, Eneba styling, and the developer's ability to explain the code, so changes must be small and each must have a reason.

## Options considered

### Option 1: Measure first, fix in place, one change at a time

Add a `Server-Timing` header and a repeatable script, record a baseline, then try a short ordered list of cheap fixes (runtime env, limiter store, client prefetch, a short browser cache), keeping only what moves the numbers. The browser cache was later skipped before it was built (see *Browser cache decision* below).

**Pros**:
- Every change has evidence; nothing speculative stays.
- Mostly configuration and small middleware; no contract rewrites.
- The remaining slowness is explained with numbers instead of excuses.

**Cons**:
- Several deploys and measurement sessions.
- May end with the host still slow, honestly documented but not solved.

### Option 2: One combined homepage endpoint

Replace the layout plus four block calls with one `GET /home` that returns everything.

**Pros**:
- One request instead of five, so queueing on a weak host largely disappears.

**Cons**:
- Undoes spec 0014's one endpoint per block design and its failure isolation (one bad block would fail the whole page), which the assignment brief asked for.
- A large change justified by a guess, before anything is measured.

### Option 3: Move the API to a paid instance

Upgrade the Render plan (or another host) so the API has real CPU and does not sleep.

**Pros**:
- Likely removes both the queueing and the cold start without code.

**Cons**:
- Costs money every month; the project was scoped to free hosting (spec 0001).
- Hides the cause instead of showing you understand it, which matters for the interview.

### Option 4: Keep alive pings plus caching everything

A scheduled ping to stop sleep, and server side caching of every catalog response.

**Pros**:
- Hides cold starts during the review window.

**Cons**:
- Reverses spec 0001's no ping decision; GitHub cron timing is best effort.
- A server cache needs invalidation rules for prices, stock, and best sellers that no one has designed; premature without a measured query problem.

## Rationale

Option 1 is chosen because the only real data point (0.9 s alone, 6 to 9 s together) says the problem is waiting, not working, and the cheapest suspects are configuration. Measuring first is what lets you tell OPcache, the limiter, and the CPU ceiling apart, and it is the honest story to tell a reviewer: here is the baseline, here is what each change did, here is what the free tier costs. Option 2 would likely help the most, but it trades away the per block failure isolation the brief asked for, on a guess; if the measurements show queueing dominates even after the cheap fixes, it can be proposed then with numbers. Option 3 contradicts the free hosting decision, and Option 4 adds invalidation risk with no measured query problem.

The 10% keep rule exists because Render timings are noisy: a smaller gain cannot be told apart from noise in 10 runs, and a change you cannot show working is a change you have to explain without evidence. The `--waterfall` mode exists because the curl script would otherwise be blind to the one fix that is purely about request order.

For the cart, reporting caps through `meta.adjustments` keeps the `Cart` shape (and every test and type built on it) unchanged, while giving the client exactly the two numbers the toast needs (runner up: rejecting over cap adds with 422, which is strict but turns a buyer adding one more at the edge into an error). Computing `added` from `RETURNING` rather than from the cap in PHP keeps it exact even if two adds race (the per user `CartLock` already serialises them, so this is belt and braces). The first draft planned `PublicCache`, a tiny custom middleware (chosen over Laravel's built in `cache.headers`, which would also mark the inner `throttle`'s 429 as cacheable). It was skipped before it was built; the next section records why.

Smaller calls: `Server-Timing` is always on (durations only, nothing secret; runner up: an env flag, which adds a step every time you want to measure). The limiter moves to APCu and not the whole cache, because only the limiter runs on every request and the single instance makes per instance counts correct (runner up: keep the database store). The first draft picked the `file` store; the amendment below replaced it. The review triage follows one rule (fix bugs, accessibility, reliability, security; decline pure style and comment requests) so each won't fix has the same kind of reason. The two checkout minors (charge inside the transaction, orchestration in the controller) are declined: the gateway is simulated with no network call, so the lock time is microseconds, and rewriting the locked purchase path this late risks the most important flow for a style gain.

## Limiter store amendment (2026-11-16)

**Why not `file`.** In the installed Laravel (v13.42.0), `RateLimiter::increment` calls `add` (counter to 0), then the store's `increment`. `FileStore::add` takes a file lock, but `FileStore::increment` does not: it reads the payload, adds one, and writes it back, so two requests that read the same value both write the same next value and one hit is lost. Login (5 per minute), register (10 per hour), and checkout (10 per minute) are the limits where a lost hit matters most. `DatabaseStore::increment` is atomic (`lockForUpdate` in a transaction), so today's limiter is correct, only slow.

**Options**:
- **APCu (chosen).** `ApcStore::increment` is `apcu_inc`, one atomic operation in shared memory. No network, no disk, no new service. Same single instance limits as `file`.
- **Keep `database`** (runner up). Correct, but it is the 6 to 10 extra Neon round trips per call found in the baseline. This is also the fallback if (b) fails the AC-4 bar.
- **Redis or Memcached.** Atomic and shared across instances, but a new service the free plan does not include. Not worth it for one instance.
- **APCu plus a custom store with an atomic `add`** (`apcu_add`, through `Cache::extend`). Closes the window start gap below, but adds a class the framework does not ship, for a gap smaller than the check then count overshoot that `ThrottleRequests` has on every store. Declined.

**Evidence** (throwaway local container `serversideup/php:8.4-fpm-nginx`, PHP 8.4.27, plus `install-php-extensions apcu`, `PHP_OPCACHE_ENABLE=1`; image and container removed afterwards):

| Check | Result |
|---|---|
| APCu in the base image | Not installed. `install-php-extensions apcu` installs 5.1.28 and writes `docker-php-ext-apcu.ini` with no other change. |
| Laravel 13 driver | `CacheManager::createApcDriver` builds `ApcStore(new ApcWrapper)`. The app's `config/cache.php` has no `apc` store, so one must be added. `ApcStore` has no `add` method, so `Repository::add` falls back to `get` then `put` (not atomic). |
| Defaults | `apc.shm_size=32M` (mmap), `apc.enable_cli=0`, `apc.use_request_time=0`, `apc.ttl=0`, `apc.gc_ttl=3600`. |
| Shared across FPM workers | 400 raw `apcu_inc` calls, 40 at a time, served by 4 worker PIDs: final value 400, no duplicate values. The segment belongs to the FPM master, so `pm = ondemand` workers ending does not drop counters. |
| `apcu_inc` details | Keeps the key's TTL (store with 3 s TTL, increment, TTL still 3). On a missing key it creates the value 1. |
| Laravel `RateLimiter::hit`, steady state | 200 hits, 20 at a time, 3 rounds: APCu 200, 200, 200; `file` 196, 199, 195. |
| Laravel `RateLimiter::hit`, fresh window | 30 fresh keys, 10 concurrent first hits each: APCu lost 1 of 300; `file` lost 36 of 300. |
| Memory | About 140 KB of the 32 MB segment used after roughly 70 limiter keys. Whole container 89 MiB after about 1,100 requests with OPcache and APCu on (local, not Render). |

**Limits of the choice**:
- **Silent failure mode.** If APCu is loaded but disabled, `apcu_inc` returns false, `(int) false` is 0, and `tooManyAttempts` never fires: limits off with no error. If the extension is missing, `apcu_fetch` is undefined and every throttled route returns 500 (loud). AC-17 (i) turns the silent case into a failed boot, so Render's health check keeps the previous deploy live.
- **CLI sees no APCu** (`apc.enable_cli=0`). Pest and CI keep the limiter on the default `array` store, so the guard is tested as a plain function and the APCu path is proven on production (AC-17 (iv)), not in CI.
- **Empty env value.** `CacheManager::store()` falls back only on null (`enum_value($name) ?? default`), so `CACHE_LIMITER_STORE=` (an empty string) would make every throttled route throw. The config uses `?: null`, and `.env.example` ships the line commented out.
- **Full segment.** If APCu runs out of memory, `apcu_inc` can fail and the limits fail open. Accepted at about 140 KB used of 32 MB.
- **Resets.** Counters live in container memory: every deploy, restart, FPM reload, and free tier spin down clears them.
- **One instance only.** Per container counts are right for Render free's single instance and wrong for more.
- **Memory on 512 MB.** OPcache reserves up to 256 MB and APCu 32 MB; in both, only touched pages count against the instance. The limiter needs far under 1 MB, so the defaults stay; check the Render memory graph (AC-17 (iv)).

## Browser cache decision (AC-7 skipped, 2026-11-16)

**Decision**: skip AC-7. The four home GETs keep the framework default `Cache-Control: no-cache, private`. This is a deliberate closure, not unfinished work.

**Why it was in the plan.** The feature 15 review saw 6 to 9 s first loads and suggested "add a short `Cache-Control` to the home endpoints" as one cheap option. Since then OPcache, the APCu limiter, and the route loader prefetch have brought the warm homepage median to 574.7 ms (`verify.md` Step 3), so the problem it was meant to soften is gone.

**What was checked before deciding** (production headers and client code; details in `verify.md`, Step 3: AC-7):
- **Cloudflare does not cache these responses.** `/api/v1/home/deals` answers `cf-cache-status: DYNAMIC` with `cache-control: no-cache, private`. These paths have no file extension, so Cloudflare's default rules leave them alone, and Render owns that Cloudflare setup, so the project cannot opt in. A `public` header would win nothing at the proxy.
- **Signed in requests carry a bearer token.** `apiFetch` sends `Authorization: Bearer <token>` on every call when a token is stored, home calls included. The first draft's security model said the opposite; that is corrected in `index.md`. `public` is exactly the directive that permits a shared cache to store a response to such a request, so it added risk for no gain.
- **The CORS preflight still runs for signed in users.** The `Authorization` header makes every signed in call need a preflight, and production answers `access-control-max-age: 0`, so preflights are never reused. A browser cache hit would still cost one trip to Render for those users; the saving would mostly reach guests.
- **TanStack Query already covers most of it.** `staleTime` is 60 s for the home queries (`client/src/api/home.ts`) and `refetchOnWindowFocus` is off. Inside one visit, moving between pages already sends no repeat home call (checked in `verify.md` Step 3, AC-6). A 30 s HTTP cache would only help a full reload or a new tab within 30 s.
- **It adds a freshness trap.** Any later `invalidateQueries({ queryKey: ["home"] })` (for example after checkout changes best sellers) would quietly get the browser's cached copy for up to 30 s. Today checkout invalidates only `["products"]`, so nothing breaks now, but the rule would have to be remembered forever.
- **The keep rule cannot judge it.** AC-4 keeps a fix only on a 10% drop in the `measure-home.sh` median. That script uses `curl`, which has no HTTP cache, so AC-7 could never pass or fail the project's own bar; it would ship on a manual browser check alone.

**Options**:
- **Skip (chosen).** Nothing to build, test, or explain. Freshness stays as spec 0014 defined it. Cost: a full reload refetches five calls, about 575 ms warm.
- **`private, max-age=30` on 200 only** (runner up). Same browser behavior as the draft, without inviting shared caches. Still a new middleware, a spec 0014 freshness amendment, an exemption from AC-4, and the invalidation trap above, for a saving on reloads that mostly reaches guests.
- **`public, max-age=30` (the first draft).** Declined: no proxy benefit (Cloudflare does not cache these paths) and it permits shared caching of responses to token carrying requests.

**What would reopen it.** A measured problem that only full reloads show (for example real users bouncing on `/` within seconds), or a proxy this project controls and can configure. Revisit with `private` first.

## Review findings triage

Built from a read only check of each finding against the code at commit `0192de8` (2026-11-16). "Resolved" means the review's own resolution section or the current code already settles it. Rows marked **Check** need a real browser before deciding (AC-15).

### 2026-11-12-main.md (authentication)
| Finding | State | Action or reason |
|---|---|---|
| 🟠 Sign out waits for server | Resolved | fixed in review |
| 🟡 No CSP | Resolved | fixed in review |
| 🟡 Login timing reveals emails | **Fix** | when no user matches, run `Hash::check` against a fixed dummy hash so both paths cost the same; Pest test that an unknown email still calls the hasher |
| 🟡 Login fields no max length | **Fix** | `LoginRequest`: `email` `max:255`, `password` the same max as `RegisterRequest`; Pest 422 test |
| 🟡 401 during navigation | Resolved | fixed in review |
| 🟡 Header stuck loading | Resolved | fixed in review |
| 🟡 Auth logic lacks tests | **Fix** | Vitest for `redirectIfSignedIn` and `completeSignIn` |
| 🟡 Spec and code drift | Resolved | fixed in review |
| 🟡 Preview pattern `#` unescaped | **Fix** | escape `#` before wrapping (`str_replace('#', '\#', …)`); a failed `preg_match` must count as a match (fail closed); Pest test with a `#` in the pattern |
| ⚪ Double submit after redirect | **Fix** | disable submit while `navigation.state !== "idle"` |
| ⚪ Focus lost after sign out | **Fix** | move focus to the header's Sign in link after sign out (accessibility) |
| ⚪ Tab out does not close menu | **Fix** | close on `focusout` when focus leaves the menu root (accessibility) |
| ⚪ safeRedirect rejects encoded spaces | Won't fix | deliberate: the decoded check is what catches `/%0a/evil.com`; losing `?q=a%20b` on redirect is the accepted price |
| ⚪ Sign in link lacks redirectTo | **Fix** | pass the current path through `safeRedirect` so sign in from a product page returns there (purchase journey) |
| ⚪ PasswordField trailing space, mobile keyboard | **Fix** | use `cx`; add `autoCapitalize="off"` and `spellCheck={false}` |
| ⚪ Other tab sign in not revalidated | Won't fix | harmless; the next navigation reruns the loader |

### 2026-11-12-main-cart.md
| Finding | State | Action or reason |
|---|---|---|
| 🟡 Focus lost after Remove | Resolved | `focusAfterRemove` |
| 🟡 Side effect in query fn | Resolved | moved to an effect |
| 🟡 Mutation uses render time token | Resolved | reads the token at action time |
| 🟡 Cart hooks and UI untested | **Fix** (rest of it) | lib tests exist; add a `CartPage` component test covering the reduced note and the AC-12 toasts |
| 🟡 design.md not updated | Resolved | rows present |
| ⚪ OfferRow import order | Won't fix | style only |
| ⚪ Empty span spacer | Won't fix | style only, renders correctly |
| ⚪ `refetchOnWindowFocus` default | Won't fix | the explicit value documents intent |
| ⚪ Stepper `aria-live` may be chatty | **Check** | with VoiceOver: if a quantity change announces both the value and the toast, drop `aria-live` from the value |
| ⚪ `$stored` not cast | **Fix** | `(int)` cast in `AddCartItem` (touched by AC-10 anyway) |

### 2026-11-12-main-product-page.md
| Finding | State | Action or reason |
|---|---|---|
| 🟡 Refetch error replaces page | Resolved | error only without data |
| 🟡 Page states lack component tests | **Fix** | one `ProductPage` test file covering loading, 404, error, loaded, plus the three parts from the visual review |
| 🟡 Missing title outside loaded | Resolved | titles render |
| ⚪ `ProductNotFound` inline | Won't fix | style only |
| ⚪ OfferRow span unexplained | Won't fix | comment request |
| ⚪ `cover_image_url` typed string | Won't fix | the column is not null; harmless |
| ⚪ Seller tie break case sensitive | Won't fix | seeded seller names never tie on case |
| ⚪ design.md lacks CoverImage, OfferRow | **Fix** | add the rows (docs accuracy for the reviewer) |

### 2026-11-13-main-checkout.md
| Finding | State | Action or reason |
|---|---|---|
| 🟡 Concurrency only manual | Resolved | CI job |
| 🟡 Success path locks form | Resolved | `isOpeningOrder` |
| 🟡 Charge inside transaction | Won't fix | simulated gateway, no network call; lock time is tiny; rewrite risk outweighs gain |
| 🟡 Controller orchestration | Won't fix | style; the flow is tested and correct |
| 🟡 Checkout pages untested | Resolved | test files exist |
| ⚪ "Payment successful" on failed load | **Fix** | show that heading only once the order has loaded |
| ⚪ List key is index | Resolved | uses `item.id` |
| ⚪ Pest scaffold helpers | Won't fix | unused test helpers, no behavior |
| ⚪ afterCommit comment | Resolved | comment added |

### 2026-11-13-main-homepage-blocks.md
| Finding | State | Action or reason |
|---|---|---|
| 🟡 Five calls on first load | **Fix** | AC-1 to AC-8 |
| 🟡 ScrollRail rerenders every scroll | **Fix** | functional `setEnds` that returns the previous object when the three booleans are equal |
| 🟡 Band colours flip on empty block | Won't fix | only in the empty case, which seeded data never hits; final state correct |
| 🟡 Seeder relies on silent cap | **Fix** | AC-9 to AC-13 (the cart page note covers display, not the add) |
| ⚪ ListDeals division uncommented | Won't fix | comment request; the `whereColumn` guard is tested |
| ⚪ `aria-expanded` constant | Won't fix | comment request |
| ⚪ Reseed overwrites title | Won't fix | by design, spec 0014 AC-6 |

### 2026-11-13-main-key-delivery.md
| Finding | State | Action or reason |
|---|---|---|
| 🟡 Live region not repeated | Resolved | new node per announcement |
| 🟡 Missing code leaves slot stuck | Resolved | falls back to masked with error |
| ⚪ Unneeded `RateLimiter::clear` | Won't fix | test only, harmless |
| ⚪ Pending set keeps failed slots | Won't fix | masked through `failed`; harmless |

### 2026-11-13-main-order-history.md
All six findings resolved in the review (three fixed, three no action with reasons).

### 2026-11-13-main-search-typo-tolerance.md
All nine findings resolved in the review (seven fixed, two no action with reasons).

### 2026-11-13-main-store-catalog.md
All seven findings resolved in the review (four fixed, three no action with reasons).

### 2026-11-15-main-visual-fidelity-polish.md
| Finding | State | Action or reason |
|---|---|---|
| 🟡 `.claude/` in .gitignore | Resolved | removed |
| 🟡 `scroll-mt` stacking | Resolved | removed |
| 🟡 Skeleton lacks shortcuts row | **Fix** | add a shortcuts row placeholder of the real row's height (layout shift) |
| 🟡 BuyBox imports from pages | **Fix** | move `otherOffersSummary` to `client/src/lib/offers.ts` with its test |
| 🟡 Featured text may overlap art | **Check** | view at 1024, 1060, 1100px; if text covers the subject, cap the text column width |
| 🟡 Three product parts untested | **Fix** | in the `ProductPage` test file above |
| 🟡 Empty fourth grid row | Resolved | `lg:row-span-3` |
| ⚪ ProductInfoRows key | Won't fix | style only |
| ⚪ money compare note | Resolved | in spec 0015 |
| ⚪ CheckoutHeader height | Resolved | one row height rule |
| ⚪ SortSelect Space in Firefox | **Check** | in Firefox, Space on the closed select: if the list opens and closes again, ignore the keyup click |
| ⚪ Spec 0015 follow ups | Resolved | ticked |

### 2026-11-16-main-mobile-overflow-key-layout.md
| Finding | State | Action or reason |
|---|---|---|
| 🟡 Scrollable key not reachable | Resolved | `tabIndex` when it overflows |
| 🟡 Spec and design.md contradict | Resolved | updated |
| 🟡 Icon only copy button | Resolved | tooltip on hover and focus |
| ⚪ Dead `flex-1` | Resolved | removed |
| ⚪ `sm:size-8` placement | Won't fix | style only |

## References

**Project sources**:
- Spec 0001 (hosting, direct Neon connection, cold starts, no keep alive pings), spec 0005 (Render env, retry rules), spec 0008 (cart caps, AC-2, AC-3, AC-6, AC-8), spec 0014 (home endpoints, per block isolation)
- `docs/reviews/2026-11-13-main-homepage-blocks.md` (the 0.9 s versus 6 to 9 s observation)
- Installed Laravel v13.42.0 source: `Illuminate/Cache/FileStore.php` (`add`, `increment`), `ApcStore.php`, `ApcWrapper.php`, `DatabaseStore.php`, `Repository::add`, `RateLimiter::increment`, `Illuminate/Routing/Middleware/ThrottleRequests::handleRequest`
- `server/Dockerfile`, `server/config/cache.php`, `server/app/Actions/Cart/`, `server/app/Http/Middleware/BlockPreviewWrites.php`, `client/src/pages/HomePage.tsx`, `client/src/router.tsx`
- `serversideup/php` documentation (OPcache off by default, FPM worker env vars): cited by name; the exact defaults were not confirmed on the spec page during this design, so read them for the installed tag before setting anything

**Practices & standards**:
- Measure before you optimise; one variable per experiment
- Fail closed for security guards
- Constant time comparison against user enumeration

**Links** (web verified):
- Render free instances (sleep after 15 min idle, about 1 min wake, 750 free hours a month): https://render.com/docs/free
- Laravel 13 rate limiting (the limiter uses the default cache store unless `limiter` is set in `config/cache.php`): https://laravel.com/docs/13.x/rate-limiting
- MDN `Server-Timing` header syntax: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing
