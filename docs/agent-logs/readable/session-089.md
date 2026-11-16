# Session 089: Feature 17 APCu deployment prep

- Session ID: `e432001d-ce82-40bd-8596-befdaa92050a`
- Source: `e432001d-ce82-40bd-8596-befdaa92050a.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-16 09:50 UTC → 2026-11-16 10:27 UTC
- Prompts: 6
- Full technical transcript: [full/session-089.md](../full/session-089.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-16 09:50 UTC · [open in full transcript](../full/session-089.md#prompt-1) · record `077c14ef-936c-4056-aed2-f8a47fe1dfd7`</sub>

/develop Feature 17 — Performance & Reliability, build plan Step 2 (AC-5b and AC-17).

Implement the approved APCu rate limiter change from docs/specs/0016-performance-reliability/.

Requirements:
- Follow the amended spec exactly.
- Keep general cache and sessions unchanged.
- Ensure the boot guard fails closed for invalid or disabled APCu configuration without breaking valid CLI/build workflows.
- Add the specified Pest regression tests.
- Run relevant tests, lint and static analysis.
- Do not modify Render environment variables or deploy.
- Preserve the existing uncommitted performance evidence in verify.md.

Stop after local implementation and verification. Report changed files, test results, risks and the exact Render configuration needed for the production experiment.

Do not commit yet.

## CLAUDE · 1

*[13 tool calls: Skill, Bash ×6, Write ×3, Edit ×3]*

Code is in. Running Pint, PHPStan and the full Pest suite next.

*[1 tool call: Bash]*

All green. Now I'm checking the guard against a real web server, both with and without the env var.

*[1 tool call: Bash]*

The empty and `apc` cases behave as the spec says. The typo run never started (the port was still busy), so I'm running it again.

*[6 tool calls: Bash ×6]*

The image boots with the guard passing and `/home` shows `1 queries`. But the 6th failed login returned 422, not the 429 I expected. I'm looking into why before going further.

*[2 tool calls: Bash ×2]*

Three fresh rounds all pass (five 422s, then 429 with `Retry-After`). Last check: the image with APCu switched off should fail `/up`.

*[1 tool call: Bash]*

The APCu limiter change is built and checked locally. Nothing is committed, deployed, or changed in Render. All Pint, PHPStan and Pest checks pass, and the real production image behaves as the spec says.

**Changed files** (all in `server/`)
- [Dockerfile](server/Dockerfile): switches to `root`, runs `install-php-extensions apcu`, then back to `www-data`, before the composer layer.
- [config/cache.php](server/config/cache.php): adds an `apc` store and `'limiter' => env('CACHE_LIMITER_STORE') ?: null`. The default store is still `database`, and sessions are not touched.
- [.env.example](server/.env.example): adds a commented out line, `# CACHE_LIMITER_STORE=apc`.
- [app/Support/LimiterStoreGuard.php](server/app/Support/LimiterStoreGuard.php) (new): `assertUsable(?string, ?array, bool)`, with the two error messages from AC-17.
- [AppServiceProvider.php](server/app/Providers/AppServiceProvider.php): the first thing in `boot()` calls the guard, but only for web requests.
- [tests/Unit/LimiterStoreGuardTest.php](server/tests/Unit/LimiterStoreGuardTest.php) and [tests/Feature/LimiterStoreConfigTest.php](server/tests/Feature/LimiterStoreConfigTest.php) (new): the 6 guard cases and the 2 config checks.
- The three files in `docs/specs/0016-performance-reliability/` are untouched, so your evidence in `verify.md` is as you left it.

**Test results**
- `composer format:check` passed. `composer analyse` passed with 0 errors. `php artisan test` passed all 477 tests.
- The existing limiter tests (`AuthRateLimitTest`, `CheckoutAccessTest`, `ServerTimingTest`) still pass unchanged on the `array` store.
- With `php artisan serve` locally: no env var gives 200, `apc` gives 500 with the APCu message, and console commands like `optimize` and `migrate:status` still work with `apc` set.
- With the image built from this Dockerfile:
  - APCu is loaded, with `apc.enable_cli=0` and `shm_size=32M`.
  - With `CACHE_LIMITER_STORE=apc`, `/up` returns 200 and `/home` shows `desc="1 queries"`.
  - Six failed logins return 422 five times, then 429 with `Retry-After`, in 3 out of 3 fresh containers.
  - With APCu turned off by an ini file, `/up` returns 500 with the guard's message.

**Risks**
- **One probe run did not throttle.** In my first container run, all 6 logins returned 422. The four runs after it all worked. My best guess is that FPM restarted during start up, and APCu counters are lost on a restart. I have not confirmed that. When you run the AC-17 (iv) check on Render, wait until the deploy is fully live, then run it more than once.
- **A mistyped store name fails earlier than the spec says.** `RateLimiter::for` builds the limiter store when the app starts, so a typo breaks every start, including the `artisan` commands at container start, with "Cache store [x] is not defined". It still fails closed. The spec says a typo "would only fail on the first throttled request", which isn't accurate. You may want `/architect` to fix that sentence.
- **Never set `CACHE_LIMITER_STORE=apc` locally.** Your Mac has no APCu, so web requests return 500. `.env.example` warns about this.
- The tradeoffs the spec already accepts still apply: the counters reset on every deploy and idle spin down, they count per instance, and the first hit in a new window has no atomic add.

**Render configuration for the experiment** (don't apply it until you commit and CI is green)
- Add `CACHE_LIMITER_STORE=apc`.
- Keep `CACHE_STORE=database` and `PHP_OPCACHE_ENABLE=1` as they are. No other env changes are needed.
- After the deploy:
  - `/up` should return 200. A 500 means the guard stopped the deploy, and the previous version stays live.
  - Measure 10 warm `--waterfall` runs. To keep the change, the median needs to be at most 876.1 ms.
  - Record the AC-17 (iv) evidence: `1 queries`, the 422 ×5 then 429 check, and the memory graph.
- If you revert: remove the env var, then revert these 7 files together.

I left build plan Step 2 unticked in the spec, because it isn't done until the production measurement is in. Suggested next step, if you want it: commit, push, check CI, then set the env var. Your call.

---

## USER · 2

<sub>2026-11-16 09:59 UTC · [open in full transcript](../full/session-089.md#prompt-2) · record `6385ed1b-52ff-4c7f-ae83-eb291a8a26e5`</sub>

Feature 17, Step 2 — prepare the APCu implementation for deployment.

1. Correct the inaccurate spec statement about when an invalid cache store name fails.
2. Preserve all existing performance evidence in verify.md.
3. Review the working tree and commit only the approved Feature 17 changes.
4. Push to main.
5. Report the commit hash, push result and CI status if available.

Do not change Render environment variables.
Do not mark Step 2 complete.
Do not run production performance measurements yet.

Report any unexpected changes or failures before proceeding.

## CLAUDE · 2

*[1 tool call: Bash]*

The tree has only the expected changes and you're not behind `origin/main`. I'm editing the one sentence in [index.md:47](docs/specs/0016-performance-reliability/index.md#L47).

*[4 tool calls: Edit, Bash ×3]*

CI is queued. I'll wait for it to finish.

*[1 tool call: Bash]*

I fixed the wrong sentence in the spec, committed the Feature 17 changes and pushed them to `main`, and CI passed. Nothing unexpected came up.

**Commits**
- `10dc722` (docs): the spec amendment for AC-5 (b) and AC-17, and the OPcache Step 1 evidence.
- `11eb3ac` (feat): the APCu limiter, the boot guard and its tests. This is what Render will build.

**The spec fix** ([index.md:47](docs/specs/0016-performance-reliability/index.md#L47)): the spec said a mistyped store name "would only fail on the first throttled request". It now says a typo already breaks every boot, console included, with "Cache store [name] is not defined". On a web request the guard runs first and gives the clearer message.

**Working tree check**
- Before committing, the only changes were the three spec files and the 7 server files from the last step. Nothing else was in the tree, and you were not behind `origin/main`.
- The changes to `verify.md` only add lines (117 of them), so all the baseline and OPcache numbers are still there.
- The tree is clean after the commits.

**Push and CI**
- The push succeeded: `1932372..11eb3ac` on `main`.
- [CI run 43844883069](https://github.com/bucys/eneba-internship-assignment/actions/runs/43844883069) passed: client, server and checkout-concurrency are all green.

I didn't change any Render env vars, Step 2 is still unticked, and I took no production measurements.

Render builds production from `main`, so it is probably already building `11eb3ac`. That deploy is safe while `CACHE_LIMITER_STORE` is unset, because the limiter stays on `database`. It is not the APCu experiment yet. The experiment starts when you set `CACHE_LIMITER_STORE=apc` and the service redeploys.

---

## USER · 3

<sub>2026-11-16 10:08 UTC · [open in full transcript](../full/session-089.md#prompt-3) · record `c48fd33b-5428-446d-84ec-ddb203c8608b`</sub>

Continue Feature 17 — AC-5(b) and AC-17 production verification.

Confirmed:
- Render deployed commit 11eb3ac.
- CACHE_LIMITER_STORE=apc is configured.
- PHP_OPCACHE_ENABLE=1 remains enabled.
- Production /up returns "Application up".
- OPcache-only baseline: 973.4 ms median.
- APCu KEEP threshold: ≤ 876.1 ms.

Tasks:
1. Verify production /home reports 1 DB query in Server-Timing.
2. Verify rate-limit response headers.
3. Test the login limiter using safe, controlled requests with a nonexistent account: 5 × 422, then 429. Repeat after the rate-limit window resets, without affecting real users.
4. Run 10 warm waterfall measurements following spec 0016. Respect rate limits and avoid cold-start contamination.
5. Compare median, maximum, app/db durations and errors against the OPcache-only baseline.
6. Record raw results and evidence in verify.md.
7. Report the measured improvement, APCu reliability and KEEP/REVERT recommendation.

Do not modify code, Render settings, commit or deploy.

Do not mark Step 2 complete yet.

## CLAUDE · 3

I'm reading the Step 1 section of `verify.md` so the Step 2 record matches its format and uses the same production host.

*[2 tool calls: Bash ×2]*

Format noted. Step 1: the production headers on `/home`, which also warms the instance.

*[1 tool call: Bash]*

`/home` reports `1 queries` (down from 7 to 11). I'll make two more calls to confirm the APCu counter goes down across requests, then start the measurement.

*[2 tool calls: Bash ×2]*

Round 1 matches the spec exactly. I'll wait out the `Retry-After` window and run round 2 with the same email.

*[1 tool call: Bash]*

Round 2 behaves the same after the reset, so the APCu counters hold and expire correctly. I'll compute the comparison against Step 1, then write it all into `verify.md`.

*[3 tool calls: Bash ×3]*

`verify.md` is still unchanged (the tree is clean). I'll run the edit again without the broken check.

*[1 tool call: Bash]*

APCu passes the keep bar on production: the median page load finish fell from 973.4 to 729.1 ms (−25.1%), and the bar was 876.1 ms or less. My recommendation is **Keep**. I recorded everything in `verify.md`.

**Measurement** (10 warm waterfall runs, 50 calls, all 200, no 429)

| | OPcache only (Step 1) | APCu (Step 2) | Change |
|---|---:|---:|---:|
| Median run finish | 973.4 ms | **729.1 ms** | −25.1% |
| Max run finish | 1566.4 ms | 7959.1 ms | +408% (one stall, see below) |
| `/home` server time (`app`), median | 107.5 ms | 32.3 ms | −70% |
| `/home` database time (`db`), median | 92.8 ms | 27.2 ms | −71% |
| The four block calls, `app` median | 424 to 561 ms | 337 to 387 ms | −21 to −32% |
| The four block calls, `db` median | 350 to 437 ms | 222 to 293 ms | −24 to −49% |

- **The maximum is one network stall, not the server.** In run 3, `/home` took 7.4 s to send its first byte, but the server spent only 35 ms on it. The other calls in that run were normal. Without that run, the median is 716.6 ms and the max is 1142.0 ms, so the outlier does not change the decision.

**APCu reliability (AC-17 (iv))**
- `/home` reports `desc="1 queries"` on every call, down from 7 to 11. The limiter's database queries are gone.
- The rate limit headers count down across requests: `x-ratelimit-remaining` went 119, 118, 117. So one counter is shared by all the PHP workers.
- Login test, round 1, with an email that has no account: 5 × 422, then 429 with `retry-after: 59`. The remaining count went 4, 3, 2, 1, 0.
- Round 2, same email, after waiting 65 s: the same sequence, so the window expired and the counter started over cleanly.
- The probe used only its own email bucket, plus 12 of the 20 per minute IP slots across two windows. No real user's bucket was touched.

**What `verify.md` now holds** (162 lines added, 0 removed, so all earlier evidence is intact)
- A Step 2 row in the Steps table.
- A Step 2 section with the comparison table, the AC-4 decision, the AC-17 (iv) evidence and what the numbers show.
- The unedited raw output of the measurement, the header checks and both login rounds.

**Still open before Step 2 can be ticked**
- **The Render memory graph, before and after.** I can't open the Render dashboard, so `verify.md` marks it as not recorded yet. Once you look at it, add the numbers to the Step 2 section.
- AC-5 (c), the PHP FPM worker step, is skipped by its own rule: the baseline found 20 workers, more than the 5 parallel calls.

I made no changes to code, Render settings or commits, and Step 2 is still unticked. After the memory graph, a good next step is to commit `verify.md` and move to Step 3 (the homepage prefetch, AC-6). Your call.

---

## USER · 4

<sub>2026-11-16 10:14 UTC · [open in full transcript](../full/session-089.md#prompt-4) · record `9cf58d47-b703-4492-9412-d2d7d417d8fc`</sub>

Finalize Feature 17 build plan Step 2.

Production APCu performance and rate-limit checks passed.

Render Free does not expose CPU or memory usage metrics (confirmed in dashboard). Do not invent memory measurements or upgrade the plan.

Tasks:
1. Record RAM monitoring as unavailable on Render Free, with the 512 MB instance limit and local APCu evidence.
2. Document residual OOM risk and the lack of production memory visibility.
3. Mark AC-5(b) KEEP: 973.4 ms → 729.1 ms (-25.1%).
4. Mark Step 2 complete if no other acceptance criteria remain.
5. Commit the documentation changes and push to main.
6. Report the commit hash and any remaining risks.

Do not modify application code or Render environment variables.
Do not start Step 3 yet.

## CLAUDE · 4

I'll edit two doc files: `verify.md` (the memory note, the OOM risk, the final Keep row) and `index.md` (ticking build plan Step 2). No code changes.

*[8 tool calls: Bash ×4, Edit ×4]*

Step 2 is complete and pushed in commit **`5c8213a`** on `main`, and CI passed on it.

**What I recorded**
- **Memory monitoring: unavailable on Render Free.** `verify.md` says this plainly and gives no estimate. Instead it lists what is known:
  - the 512 MB instance limit;
  - the local APCu figures: about 140 KB of the 32 MB APCu space used, and 89 MiB for the whole container after about 1,100 requests;
  - the space OPcache (up to 256 MB) and APCu (32 MB) may reserve, of which only the parts actually used count against the 512 MB.
- **Out of memory risk.** A section explains that a slow climb toward 512 MB would only show up as a crash or restart, never as a graph. It also names the first fixes to try: a lower `PHP_OPCACHE_MEMORY_CONSUMPTION`, or fewer PHP workers.
- **AC-5 (b): Keep**, 973.4 → 729.1 ms (−25.1%). The Steps table row now just says "Keep".
- **Step 2 ticked** in the spec's build plan:
  - AC-5 (a) and (b) are kept, and (c) stays skipped by its own rule, because there are already 20 PHP workers for 5 calls.
  - AC-17 (i) to (iii) are covered by code and tests.
  - AC-17 (iv) is recorded, with memory marked unavailable.
- The Step 1 note that said "check the Render memory graph" now points to Step 2. That edit is the only changed existing line in `verify.md`. Every other change only adds lines.

**Remaining risks**
- **No view of production memory.** An out of memory problem would only show up as a restart. The local figures leave a wide margin, but that is not proof for Render.
- **AC-17 (iv) still asks for "the Render memory graph before and after"**, which this plan can't give. The record explains the gap, but the criterion's wording still asks for the graph. If you want them to match, `/architect` can update that line in the spec.
- **The counters reset on every deploy, restart and idle spin down, and they count per instance.** That's fine on one free instance. Move the limiter back to `database`, or to Redis, before scaling out.
- **There is still a small chance of losing a count at the start of a new limit window** (1 of 300 in the local test). The spec accepts this.
- **Edge and network stalls happen** (one 7.4 s first byte during the run). They are outside the app, and the Infrastructure limits note at the end of the feature should mention them.

I made no code or Render changes and haven't started Step 3.

---

## USER · 5

<sub>2026-11-16 10:17 UTC · [open in full transcript](../full/session-089.md#prompt-5) · record `2696ee36-67c3-4063-913d-0bbb11dab89c`</sub>

Review Feature 17 before starting build plan Step 3 (AC-6).

1. Amend AC-17(iv) so Render memory graphs are required only when available. Preserve the documented Free-plan limitation and residual OOM risk.
2. Review the approved AC-6 homepage prefetch requirements and current frontend request flow.
3. Assess whether prefetch is still justified after the production waterfall median improved to 729.1 ms.
4. Identify potential duplicate requests, cache invalidation issues and complexity.
5. Recommend IMPLEMENT, SIMPLIFY or SKIP, with evidence and expected user-visible benefit.

Do not implement prefetch, change application code, commit or deploy.

Report the findings before proceeding.

## CLAUDE · 5

First the AC-17 (iv) wording, then I'll read the homepage request flow.

*[3 tool calls: Edit, Bash ×2]*

The AC-17 (iv) wording is amended. Now two things that decide the prefetch question: whether TanStack's `prefetchQuery` keeps the app's retry rule, and what invalidates the home queries.

*[2 tool calls: Bash ×2]*

I recommend **IMPLEMENT AC-6, but measure first.** Run `--parallel` against production now, with no code change. That mode is exactly the request pattern the prefetch would create. If the median beats the keep bar, build it as the spec says. If not, skip it.

**1. AC-17 (iv) amended** ([index.md:47](docs/specs/0016-performance-reliability/index.md#L47)). The Render memory graph is now required only where the plan shows one. On Render Free, `verify.md` records the limitation, the 512 MB limit, the local APCu figures and the out of memory risk instead, with no estimate. This edit is not committed yet.

**2. How the homepage loads today** (a waterfall)
- `HomeBody` waits for `/home` (the layout) and shows the skeleton until it returns. Only then do the blocks mount and fire the other four calls at once: `banners`, `best-sellers`, `deals` and `products` page 1.
- On production (Step 2), the median run finish is about 153 ms for `/home` plus about 575 ms for the slowest of the other four, so **729.1 ms**.

**3. Is prefetch still worth it?**
- The most it can save is the `/home` leg, about 130 to 150 ms. With prefetch, the finish becomes roughly the slowest block call (about 575 to 600 ms), not `/home` plus that call. My estimate is about 600 ms (around −18%) against an AC-4 bar of **656.2 ms or less**. That is an estimate, not a measurement.
- The baseline is a warning sign. With OPcache off, `--parallel` and `--waterfall` were almost the same (5679.5 against 5722.5 ms), because the 0.15 CPU slice was the bottleneck. `/home` is now light (32 ms of server time, 1 query), so this time adding it to the wave should cost little. That's why I suggest measuring before building.
- **What users would notice:** about 130 to 150 ms less before content appears on a warm first visit. Nothing on a repeat visit within 60 s, because the data is already cached. Nothing that matters on a cold start, where the 23 to 35 s spin up dominates.

**4. Duplicates, cache and complexity**
- **No duplicate requests**, as long as the loader uses the exact query factories. TanStack merges a fetch already in flight with the same key. `ProductListSection` adds a `select`, but that doesn't change the key.
- **The retry rule still applies.** `fetchQuery` turns retry off only when no retry is set, and the client's default `shouldRetryQuery` is merged in first. I checked this in the installed source (query-core 5.107.1). A failed prefetch leaves the query in its error state, and the block fetches again when it mounts.
- **When the loader runs again** (on navigation to `/`, or after an action), `prefetchQuery` skips data that is still fresh (60 s), so it adds no extra calls.
- **A block the layout hides** costs one wasted call (the spec accepts this). The `catalog` budget used per visit stays at 5.
- **Cache invalidation is unchanged.** Checkout already invalidates `["products"]`, which covers the home grid, and the home keys are never invalidated. The AC-7 browser cache is a separate change.
- **No cancellation.** The loader doesn't pass the router's abort signal, so navigating away mid load doesn't stop the fetches. They finish and fill the cache, which is harmless.
- **Complexity is small:** one `homeLoader.ts` of about 20 lines, one line in the router, and one Vitest test using `createMemoryRouter`. One risk of drift: the loader repeats the block to query mapping in `HomePage`'s `BLOCKS`. Sharing one list keeps the two in step.

**Suggested next step:** 10 warm runs of `scripts/measure-home.sh https://eneba-api.onrender.com 10 --parallel`, which makes about 50 `catalog` calls, under the limit.
- A median of **656.2 ms or less** means build AC-6 as specced.
- A median above that means skip AC-6, record it in `verify.md` as "no measurable effect", and keep the waterfall.

I haven't run that or changed any code. Do you want me to run it?

---

## USER · 6

<sub>2026-11-16 10:19 UTC · [open in full transcript](../full/session-089.md#prompt-6) · record `6b95a135-86cf-4b6e-96bc-214aa51e0633`</sub>

Proceed with Feature 17 AC-6 measurement-only experiment.

1. Run 10 warm --parallel measurements against the current production API, following the same warm-up and rate-limit precautions as previous experiments.
2. Compare against the Step 2 waterfall median of 729.1 ms.
3. Calculate median, maximum, errors and Server-Timing differences.
4. Record the raw measurements and comparison in verify.md.
5. Recommend IMPLEMENT if parallel median ≤ 656.2 ms; otherwise recommend SKIP, following AC-4.
6. Preserve the uncommitted AC-17(iv) spec amendment.

Do not implement prefetch, modify application code, commit or deploy.

Report the results and recommendation.

## CLAUDE · 6

Warming up the same way as before (one `/home` call, then 5 s), then 10 parallel runs.

*[1 tool call: Bash]*

Median run finish **575.0 ms**, under the 656.2 ms bar. All 50 calls returned 200. I'll compute the comparison, then append it to `verify.md`.

*[2 tool calls: Bash ×2]*

The experiment says **IMPLEMENT**. Firing all five calls at once gave a median run finish of **575.0 ms**, under the 656.2 ms bar. I recorded it in `verify.md`.

**Results** (10 warm `--parallel` runs at 10:20 UTC, all 50 calls 200, no 429, same warm up as before)

| | Step 2 waterfall | Parallel | Change |
|---|---:|---:|---:|
| Median run finish | 729.1 ms | **575.0 ms** | **−21.1%** |
| Max run finish | 7959.1 ms (the stall) | 744.7 ms | −90.6% (−34.8% against 1142.0 ms, the Step 2 max without the stall) |
| Range of run finishes | | 528.8 to 744.7 ms | |

**Server-Timing differences**
- **`/home` gets slower when it shares the load:** server time (`app`) goes from 32.3 to 235.7 ms, and database time (`db`) from 27.2 to 164.9 ms for the same single query. Five calls share the 0.15 CPU slice and the Neon connection.
- **The block calls barely move:** `app` changes by −8% to +22%, and total time by −4% to +9%.
- **Overall it still wins.** The page now finishes with the slowest of five calls running together (about 550 ms), not after `/home` plus the slowest of the other four.

**What users would notice:** on a warm first visit, all blocks are filled about 150 ms sooner. The layout itself arrives later (about 414 instead of 153 ms), so the full page skeleton shows a little longer, but the page is complete sooner. Repeat visits within 60 s and cold starts don't change.

**Caveats**
- The two sessions were 10 minutes apart, not mixed run by run. Even so, the margin over the bar (81 ms) is bigger than the spread between medians in earlier sessions.
- `curl` doesn't include the browser's own work, but that work is the same for both patterns.
- This is a check before building, not the AC-6 result. AC-4 needs a second measurement in `--parallel` mode after the loader ships, plus the browser check.

**What changed in `verify.md`:** 118 lines added, 0 removed:
- a "3 (pre-check)" row in the Steps table;
- a Step 3 pre-check section with the comparison table and findings;
- the unedited raw output.

Your AC-17 (iv) amendment in `index.md` is still there and still uncommitted. I didn't change any code, commit or deploy.

If you want to go ahead with AC-6: build `homeLoader.ts` from one shared list of block queries, plus its Vitest test, then deploy and run `--parallel` again to confirm. Your call.
