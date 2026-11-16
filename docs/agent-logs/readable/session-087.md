# Session 087: Feature 17 Step 1 evidence instrumentation

- Session ID: `dd052a84-0e6e-4a67-8c4d-2ee9ff7d294b`
- Source: `dd052a84-0e6e-4a67-8c4d-2ee9ff7d294b.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-16 07:36 UTC → 2026-11-16 09:42 UTC
- Prompts: 8
- Full technical transcript: [full/session-087.md](../full/session-087.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-16 07:36 UTC · [open in full transcript](../full/session-087.md#prompt-1) · record `1946fed4-1a3c-45ec-8318-23270f590c54`</sub>

`/develop`

performance & reliability

## CLAUDE · 1

I'll start with the freshness check and look at the scope and spec for this feature.

*[2 tool calls: Bash ×2]*

Bash checks are failing for now, so I'll read the files directly instead.

*[2 tool calls: Read ×2]*

The spec is detailed and names every value's source, so no decision is owed. I'll read the build flow next.

*[2 tool calls: Read ×2]*

Resuming at build plan step 1 (Evidence). I'll do the code part now and stop before any deploy, since production measurements need you. Reading the files this step touches.

*[4 tool calls: Read ×4]*

I need the exact query string the homepage grid sends, plus the existing NoStore test as a pattern.

*[2 tool calls: Bash, Read]*

Default params give an empty query string, so the grid call is likely plain `/products`. I'll confirm and look for test patterns.

*[1 tool call: Bash]*

Bash is still blocked by the safety check. I'll keep going with direct file reads.

*[5 tool calls: Read ×4, Bash]*

Confirmed: the home grid calls plain `/products` (default params give an empty query string). Now I'll check how Laravel orders the priority list, since `ServerTiming` must sit ahead of `NoStore`.

*[4 tool calls: Bash ×2, Read ×2]*

---

## USER · 2

<sub>2026-11-16 07:59 UTC · [open in full transcript](../full/session-087.md#prompt-2) · record `71e95e80-0fe1-490c-9c64-38268f335885`</sub>

try again

## CLAUDE · 2

*[4 tool calls: Bash ×4]*

I have the patterns I need. Writing the timing holder, the middleware, and the wiring.

*[8 tool calls: Write ×2, Edit ×6]*

Now the Pest test. I'll check which home endpoint has a known, fixed query count.

*[1 tool call: Bash]*

In tests one `/home` request is exactly one query, so the cache store isn't adding queries there. For a deterministic "3 queries" check I'll register a route inside the test that runs three selects.

*[2 tool calls: Write, Bash]*

All 9 pass. Now the full suite, Pint, and PHPStan, to be sure nothing else changed (the `DB::listen` runs on every query).

*[2 tool calls: Bash, Write]*

One fix before running it: I used `seq`, which breaks the bash, curl, and awk only rule. I'll swap it for a bash loop and use `if` where a false test could trip `set -e`.

*[7 tool calls: Edit ×4, Bash ×3]*

I've built the code half of step 1 (Evidence). The other half is a deploy and a production baseline, and those need you, so I stopped there.

**What's done (AC-1, AC-2)**
- **`Server-Timing` header**: every `/api/v1` response, errors included, now carries `app;dur=…, db;dur=…;desc="n queries"`. The work is in [ServerTiming.php](server/app/Http/Middleware/ServerTiming.php) and [RequestTimings.php](server/app/Support/RequestTimings.php), wired up in [AppServiceProvider.php](server/app/Providers/AppServiceProvider.php) and [bootstrap/app.php](server/bootstrap/app.php).
- **Tests**: [ServerTimingTest.php](server/tests/Feature/ServerTimingTest.php) covers 200, 401, 404, 422, 429 and 500, the query count, and that each request reports only its own queries.
- **Checks**: all 469 Pest tests pass, and so do Pint and PHPStan.
- **Script**: [measure-home.sh](scripts/measure-home.sh) has `--parallel`, `--waterfall` and `--serial` modes, prints medians and maximums, and exits non zero when a call fails. I ran all three modes against a local `php artisan serve`. The 429 message is only checked by reading the code.

**Two things you should know**
- **Where the spec was off**: it says anchoring `ServerTiming` on `AuthenticatesRequests` puts it ahead of `NoStore`. In Laravel's code it would land after `NoStore`. I passed both as anchors, which gives the order the spec meant. Behavior is unchanged, but `/sync` should note it.
- **Why the middleware resets the counter**: Laravel doesn't clear scoped objects between test requests, so `ServerTiming` sets the count back to zero at the start of each request.

**What I updated**
- Spec 0016 status: `Proposed` → `In Progress`.
- Scope feature 17: code pointer added. I left the Evidence box unticked, because the baseline isn't recorded yet.
- Nothing is committed. The root `AGENTS.md` has no git setting, so I didn't commit anything.

**Next steps you could take (each one is your call)**
1. Commit and push this change alone, so the baseline is taken before any fix. Pushing to `main` deploys to Render.
2. Send me the Render facts AC-3 asks for: `PHP_OPCACHE_ENABLE` (or "unset"), whether the deploy log shows the config and route caches being built, and the instance CPU and RAM.
3. After that, I'll run the 10 waterfall, 10 parallel and 10 serial warm runs, plus 3 cold runs, and write the baseline into `verify.md`.

---

## USER · 3

<sub>2026-11-16 08:09 UTC · [open in full transcript](../full/session-087.md#prompt-3) · record `4c50e5d3-10d0-46ab-92ad-b0d598b3b080`</sub>

Prepare Feature 17 Step 1 (Evidence instrumentation) for deployment.

1. Inspect git status and diff for unrelated changes.
2. Run git diff --check.
3. Confirm the Server-Timing middleware, tests and measurement script are the only implementation changes.
4. Commit the Evidence instrumentation and relevant spec/scope updates with:
   feat: add homepage latency measurement instrumentation
5. Push to main.
6. Report the commit hash and CI status.

Do not implement any performance optimizations yet. Do not mark the Evidence milestone complete.

## CLAUDE · 3

I'll start by looking at the full working tree.

*[4 tool calls: Bash ×4]*

The CI run started. I'll watch it until it finishes.

*[1 tool call: Bash]*

The Evidence instrumentation is committed and pushed to `main`, and CI passed. No performance fixes are in this commit, and the Evidence milestone is still unticked.

- **Commit**: `eabd7aa` (`feat: add homepage latency measurement instrumentation`), pushed with `0192de8..eabd7aa`. You were 0 commits behind `origin/main` before the push.
- **Checks before committing**: `git diff --check` was clean, and there were no unrelated changes.
- **What's in it**: the code is `ServerTiming`, `RequestTimings`, their wiring in `AppServiceProvider` and `bootstrap/app.php`, `ServerTimingTest`, and `scripts/measure-home.sh`.
- **Docs in it**: the new spec 0016 (`index.md`, `rationale.md`, with status now `In Progress`), the amendment notes it adds to specs 0008 and 0014, and the scope update for feature 17.
- **CI**: run `43829023467` succeeded. All three jobs passed: server, checkout concurrency, and client.

I haven't checked the Render deploy. Before the baseline, you may want to confirm it's live by running `curl -sI <api-origin>/api/v1/home` and looking for a `Server-Timing` header.

The next step is still yours. When you send the Render facts (OPcache env, whether the deploy log shows the config and route caches being built, and the instance CPU and RAM), I'll take the AC-3 baseline runs.

---

## USER · 4

<sub>2026-11-16 08:18 UTC · [open in full transcript](../full/session-087.md#prompt-4) · record `38ee8f87-b687-4dd9-a3c2-a86806cc015a`</sub>

Continue Feature 17 Step 1 — Evidence.

Production instrumentation is deployed and verified.

Confirmed Render facts:
- Service: eneba-api
- Region: Frankfurt (EU Central)
- CPU limit: 0.15 CPU
- Memory limit: 512 MB
- PHP_OPCACHE_ENABLE: unset
- Laravel config, routes, events and views caches: built successfully
- Commit eabd7aa: deployed live
- Server-Timing header verified:
  app;dur=745.7, db;dur=272.7;desc="11 queries"

Now complete the production baseline according to spec 0016:
1. Run 10 warm waterfall, 10 warm parallel and 10 warm serial measurements using scripts/measure-home.sh.
2. Respect rate limits and pauses between runs.
3. Run the 3 cold-start measurements only under the conditions defined in the spec. Do not force restart production or change Render configuration.
4. Record raw evidence, medians, maximums and Server-Timing measurements in verify.md.
5. Compare client latency with app/db durations to identify likely queuing or infrastructure constraints.

Do not implement optimizations yet.

Report findings and whether the Evidence milestone can be marked complete.

## CLAUDE · 4

First I need the production API origin. I'll look it up in the repo docs.

*[1 tool call: Bash]*

The API is `https://eneba-api.onrender.com`. I'll send one warm up request to make sure the instance is awake, then the 10 waterfall runs, saving the raw output to the scratchpad.

*[2 tool calls: Bash ×2]*

Parallel finishes in 5.68 s, about the same as waterfall's 5.72 s. Starting all five calls at once doesn't help when the CPU is the limit. Pausing again, then the serial runs.

*[3 tool calls: Bash ×3]*

While the cold job waits, I'll fill the AC-3 gap you didn't list: the FPM process settings. Since I can't open a shell on Render, I'll read the defaults from the same image tag locally.

*[2 tool calls: Bash ×2]*

The image env says `ondemand` with 20 workers, but a pool file says `dynamic` with 5. I'll check which file FPM actually loads.

*[2 tool calls: Bash, Write]*

Before I append the raw output, I'll check one claim I just wrote: that tests use the `array` cache.

*[1 tool call: Bash]*

Confirmed. Appending the raw outputs.

*[1 tool call: Bash]*

The warm baseline is in `verify.md`. The cold job is still running: each of its three runs waits 16 min 40 s of idle time, so it should finish around 09:17 UTC. Please don't open the site or the API until then, because any request, from you or a reviewer, resets Render's idle timer and spoils that cold run. I'll add the cold numbers and give you the full report when the job finishes.

_⚙ Automated `task-notification` message (not written by the developer; content is in the full transcript)._

## CLAUDE · 4 (continued)

*[3 tool calls: Bash ×2, Edit]*

The production baseline is done and recorded in [verify.md](docs/specs/0016-performance-reliability/verify.md). I didn't change any code, apply any fix, or touch Render. The file is not committed yet.

**Baseline on commit `eabd7aa` (median run finish, 10 warm runs per mode)**

| Mode | Median | Max |
|---|---:|---:|
| waterfall (the client today) | 5.72 s | 6.63 s |
| parallel | 5.68 s | 6.69 s |
| serial | 5.58 s | 6.39 s |
| cold (3 runs, after more than 15 min idle) | 30.6 s | 41.5 s |

All 165 calls answered 200, and no run hit the rate limit.

**What it shows**
- **The CPU is the limit, not the workers.** All three modes finish in about the same time, and that only happens when the server has a fixed amount of work capacity. One call's server time is about 0.8 s alone and about 5.3 s when five run together, which fits five requests sharing 0.15 CPU.
- **Requests aren't waiting for a free PHP worker.** The time to first byte minus `app` stays at about 190 ms in every mode. FPM is `ondemand` with 20 workers, so AC-5 (c), FPM tuning, is skipped by the spec's own rule.
- **PHP itself is the cost, not the database.** `db` is only about 17% of `app` (120 to 150 ms out of 730 to 880 ms). OPcache is off (the image default), so every request compiles Laravel's PHP files again. That makes AC-5 (a) the strongest candidate.
- **The rate limiter adds most of the queries.** `/home` runs 7 to 11 queries in production but 1 in tests (which use the `array` cache). The extra ones are the limiter reading and writing in the `database` store, which supports trying AC-5 (b).
- **The prefetch fix will likely do little for now.** Parallel is already no faster than waterfall, so AC-6 should show "no measurable effect" unless the runtime fixes first stop the CPU being the limit.
- **A cold start costs 23 to 35 s, all before PHP runs.** The first call's `app` stays under 1 s, so that time is Render waking the container. AC-8 keeps cold starts as they are.

**Can the Evidence milestone be marked complete?** Yes. Everything it asks for is met:
- **AC-1**: the header is in production.
- **AC-2**: the script is built and tested.
- **AC-3**: the date, the commit, 3 × 10 warm runs, 3 cold runs, and the runtime facts are all in `verify.md`.

I haven't ticked it, since you said not to.

One caveat: I read the FPM settings from my local pull of the image (dated 2026-11-10). The tag isn't pinned, so Render's build could be slightly newer. This is noted in `verify.md`.

**Suggested next steps, your call**
- Commit `verify.md`.
- Tell me to tick Evidence in the spec build plan and in the scope.
- Start AC-5 (a): set `PHP_OPCACHE_ENABLE=1` on Render, then run 10 waterfall runs against this baseline. That's a Render env change, so you'd make it, or ask me to.

---

## USER · 5

<sub>2026-11-16 09:20 UTC · [open in full transcript](../full/session-087.md#prompt-5) · record `bbd43ed1-e8af-4e97-9ea4-2e519cead216`</sub>

Finalize Feature 17 Evidence milestone.

1. Review the recorded baseline in verify.md for completeness and consistency.
2. Mark Evidence complete in the spec build plan and docs/scope/scope.md.
3. Run git diff --check.
4. Commit only the baseline evidence and milestone status updates.

Commit message:
docs: record feature 17 production performance baseline

Do not push yet, change Render settings, or implement optimizations.

Report the commit hash and changed files.

## CLAUDE · 5

First I'll review `verify.md` against the raw data.

*[7 tool calls: Bash ×3, Edit ×4]*

The Evidence milestone is complete and committed locally as `1932372` (`docs: record feature 17 production performance baseline`). I haven't pushed it, changed Render, or applied any optimization. Your branch is 1 commit ahead of `origin/main`.

**Changed files**
- `docs/specs/0016-performance-reliability/verify.md` (new): the runtime facts, the 3 × 10 warm runs and 3 cold runs, the findings, the steps table, and the unedited raw output.
- `docs/specs/0016-performance-reliability/index.md`: build plan step 1 is now `[x] **Evidence.**`.
- `docs/scope/scope.md`: the feature 17 Evidence milestone is ticked.

**Review of `verify.md`**
- I fixed one inconsistency in points 2 and 6. They said the gap between time to first byte and `app` was "190 to 250 ms", but the per call medians actually range from 97 to 246 ms, and one example in the text was 179 ms. They now say "about 100 to 250 ms", plus the point that the gap doesn't grow when calls run together. The conclusion (no waiting for a free PHP worker) is unchanged.
- Everything else matches the raw output: 165 calls, all 200, no 429.

`git diff --check` was clean, and the working tree is clean after the commit.

When you're ready, the next step is AC-5 (a), turning on OPcache. It needs a Render env change (`PHP_OPCACHE_ENABLE=1`), then 10 waterfall runs compared against the 5.72 s baseline.

---

## USER · 6

<sub>2026-11-16 09:24 UTC · [open in full transcript](../full/session-087.md#prompt-6) · record `1f4c3270-5af3-42ca-b845-86bdd58d9057`</sub>

Inspect the PHP Docker image and configuration used by our Render deployment.

Verify:
1. Whether PHP OPcache is installed.
2. Whether PHP_OPCACHE_ENABLE=1 is a supported environment variable that actually enables OPcache.
3. What OPcache settings are currently used by default.
4. Whether enabling it requires only a Render environment change or also a code/Dockerfile change.

Read-only investigation. Do not modify files, commit, deploy or change Render settings.

Report the exact evidence and recommended next step.

## CLAUDE · 6

I'll check the Dockerfile first, then the image itself.

*[2 tool calls: Bash ×2]*

OPcache is installed and its `enable` setting reads `${PHP_OPCACHE_ENABLE}`. Next I'll prove the variable switches it on for the FPM side that serves web requests, not just the CLI.

*[1 tool call: Bash]*

Unexpected: with `PHP_OPCACHE_ENABLE=1`, FPM still reports `opcache.enable => Off`. I'll look for what overrides it.

*[6 tool calls: Bash ×6]*

Yes: OPcache is installed, and setting `PHP_OPCACHE_ENABLE=1` in Render turns it on. No code or Dockerfile change is needed. I tested this on my local pull of `serversideup/php:8.4-fpm-nginx` (PHP 8.4.27, dated 2026-11-10), which is the image your [Dockerfile](server/Dockerfile) builds on. I used throwaway containers only and changed no files.

**1. Is OPcache installed?** Yes.
- `php -m` lists `Zend OPcache`.
- `conf.d/docker-php-ext-opcache.ini` loads it with `zend_extension=opcache`.

**2. Does `PHP_OPCACHE_ENABLE=1` actually enable it?** Yes, for the FPM process that serves web requests.
- The image's `serversideup-docker-php.ini` contains `opcache.enable=${PHP_OPCACHE_ENABLE}`. PHP fills that in from the environment at startup.
- With the variable unset, the startup log shows `• OPcache: ❌ Disabled`, and a live request reports `sapi=fpm-fcgi ini='0' enabled=false`.
- With `-e PHP_OPCACHE_ENABLE=1`, the log shows `• OPcache: ✅ Enabled`. Live requests then report `enabled=true cached_scripts=1`, with hits counting `0 → 1 → 2`.
- One correction to an intermediate result: an early run seemed to show the variable doing nothing. That was my test's fault, not the image's (zsh passed the `-e` flag as a single argument). The rerun with the flag written out is the evidence above.

**3. Default OPcache settings** (from `php-fpm -i` and the image env):

| Setting | Default |
|---|---|
| `opcache.enable` | Off (`PHP_OPCACHE_ENABLE=0`) |
| `opcache.enable_cli` | On |
| `opcache.memory_consumption` | 256 MB |
| `opcache.interned_strings_buffer` | 32 MB |
| `opcache.max_accelerated_files` | 32531 |
| `opcache.validate_timestamps` | Off (so code changes need a restart) |
| `opcache.revalidate_freq` | 2 |
| `opcache.save_comments` | On |
| `opcache.jit` | off (buffer 0) |
| `opcache.preload` | none |
| `opcache.enable_file_override` | Off |

**4. Render change only, or code too?** Render only.
- The Dockerfile doesn't set or override any OPcache value, and nothing else in the repo does either.
- `validate_timestamps=0` is safe here. Every Render deploy builds a new image and starts a fresh container, so stale code can't be served.
- This matches the spec: AC-5 (a) says "in the Render container env".

**Two things to watch**
- **Memory**: `memory_consumption=256` reserves 256 MB of shared memory on a 512 MB instance. Only the pages actually used count toward real memory use, and Laravel's compiled code is usually far smaller than that. Still, check Render's memory graph after the deploy. If it gets tight, lowering `PHP_OPCACHE_MEMORY_CONSUMPTION` would be a separate measured step, not part of this one.
- **Image version**: the tag isn't pinned, so Render may build from a newer image. To confirm on the live service, look for `OPcache: ✅ Enabled` in the Render deploy log.

**Recommended next step (AC-5 (a))**
1. In Render, set `PHP_OPCACHE_ENABLE=1` on `eneba-api` and redeploy. This is a Render settings change, so it's yours to make.
2. Confirm `OPcache: ✅ Enabled` in the startup log.
3. Then I run 10 warm `--waterfall` runs. Under AC-4 the change is kept only if the median run finish drops by at least 10%, from 5722.5 ms to 5150 ms or less. Either way, the numbers go into the `verify.md` steps table.

---

## USER · 7

<sub>2026-11-16 09:31 UTC · [open in full transcript](../full/session-087.md#prompt-7) · record `50a40f8d-d155-41a9-8e01-63fbe4883ab0`</sub>

Continue Feature 17, AC-5(a) — OPcache performance experiment.

Confirmed:
- Render deployment is Live.
- Startup log shows OPcache: Enabled.
- PHP_OPCACHE_ENABLE=1.
- Baseline warm waterfall median: 5722.5 ms.
- Required 10% improvement threshold: ≤ 5150 ms.

Tasks:
1. Run 10 warm waterfall measurements using scripts/measure-home.sh, following spec 0016.
2. Ensure the instance is warm and respect rate limits.
3. Compare median, maximum, Server-Timing app/db durations and errors against the recorded baseline.
4. Record raw results and the comparison in verify.md.
5. Recommend KEEP if the median improves by at least 10%; otherwise recommend REVERT, following the spec.

Do not change code, Render settings or other optimizations.

Do not commit yet. Report the measured improvement percentage and recommendation.

## CLAUDE · 7

I'll warm up the same way as the baseline (one `/home` request), then do the 10 waterfall runs.

*[1 tool call: Bash]*

All 50 calls answered 200. The median run finish dropped from 5722.5 ms to 973.4 ms, about 83%. I'll compute the per call comparisons exactly, then record them.

*[3 tool calls: Bash ×2, Edit]*

Turning on OPcache made the homepage 83.0% faster: the median waterfall run went from 5722.5 ms to 973.4 ms, so I recommend **KEEP**. That clears the spec's 10% bar (≤ 5150 ms) by a wide margin.

**Run conditions**: same as the baseline. I sent one `/home` warm up call, waited 5 s, then did 10 warm waterfall runs. All 50 calls answered 200, with no rate limiting. The only change since the baseline is `PHP_OPCACHE_ENABLE=1`; the deployed code is the same.

**Comparison with the baseline**

| | Baseline | OPcache on | Change |
|---|---:|---:|---:|
| Median run finish | 5722.5 ms | 973.4 ms | −83.0% |
| Max run finish | 6631.0 ms | 1566.4 ms | −76.4% |
| `/home` server time (`app`), median | 631.7 ms | 107.5 ms | −83.0% |
| Block calls `app`, median | 3975 to 4620 ms | 424 to 561 ms | −87 to −89% |
| `db`, median | 157 to 830 ms | 93 to 437 ms | −36 to −58% |

**What it shows**
- **PHP recompiling every file was the main cost.** It took about 520 ms of every request on the 0.15 CPU slice.
- **The database is now most of the server time.** `db` is 71 to 86% of `app`, up from about 17%. That makes the rate limiter's extra queries (7 to 11 on `/home` against 1 needed) the next thing to try, AC-5 (b). Its keep bar against this step is ≤ 876.1 ms.
- **Run 1 is the slowest (1566 ms)** because the block endpoints' files were still being compiled into OPcache during it. Runs 2 to 10 took 915 to 1113 ms.

**Watch item**: OPcache can reserve up to 256 MB on the 512 MB instance, so check Render's memory graph.

**Recorded in [verify.md](docs/specs/0016-performance-reliability/verify.md)**: a step 1 row in the steps table, a "Step 1: AC-5 (a) OPcache" section with the per call comparison and the reasoning, and the unedited raw output. `git diff --check` is clean. Nothing is committed, and I haven't changed any code or Render settings.

---

## USER · 8

<sub>2026-11-16 09:35 UTC · [open in full transcript](../full/session-087.md#prompt-8) · record `f031524d-290d-4d47-a65d-03bc0f21a82c`</sub>

Finalize Feature 17 AC-5(a) OPcache experiment and investigate AC-5(b).

1. Review the recorded OPcache measurements in verify.md.
2. Mark AC-5(a) as KEEP: median 5722.5 ms → 973.4 ms (-83.0%).
3. Investigate how Laravel's production rate limiter uses the database cache.
4. Identify the smallest safe alternative that works on Render Free without Redis or additional paid services.
5. Check rate-limit persistence, multi-worker behavior, concurrency safety and deployment implications.
6. Recommend a solution and explain risks before implementation.

Do not implement AC-5(b), modify Render settings, commit or deploy yet.

Report the proposed change and how we would measure it against the new 973.4 ms baseline.

## CLAUDE · 8

First I'll mark step 1 as Keep, then read how Laravel's limiter talks to the cache.

*[6 tool calls: Edit, Bash ×5]*

One more check: in what order does `ThrottleRequests` check the count and record the hit? That decides how much the lost update matters.

*[1 tool call: Bash]*

I've marked step 1 as **Keep** in `verify.md`, and I've finished the AC-5 (b) investigation. Nothing is implemented, committed, or deployed, and Render is untouched. I recommend APCu over the `file` store the spec names, for the reasons below.

## How the limiter uses the database today

- **Wiring**: `CacheServiceProvider` builds `RateLimiter` on `cache.limiter`. Your `config/cache.php` has no `limiter` key, so it falls back to `CACHE_STORE=database`.
- **Order of work**: `ThrottleRequests` checks the count (`tooManyAttempts`), records the hit (`hit`), runs the route, then re-reads the count for the response headers.
- **SQL cost** (in `DatabaseStore`):
  - each `get` is a `SELECT`, and each `add` is a `SELECT` plus `insertOrIgnore`;
  - each `increment` is a transaction holding `SELECT … FOR UPDATE` and an `UPDATE`.
  - That makes **6 queries per request** in steady state, and 8 when a new minute window opens. Add `/home`'s own 1 query and you get exactly the 7 observed.
- **Row lock**: the 4 parallel block calls from one IP share one counter row. So the `FOR UPDATE` lock makes them wait on each other.
- **Share of the time**: after OPcache, `db` is 71 to 86% of server time, and these 6 queries are most of it.

## Options that work on Render Free without Redis

| | `file` store (what the spec names) | APCu store |
|---|---|---|
| Change | `'limiter' => env('CACHE_LIMITER_STORE')` in `config/cache.php`, `.env.example`, Render env | the same, plus an `apc` store entry, plus `install-php-extensions apcu` in the Dockerfile (APCu is **not** in the image, though the installer is) |
| Cost per request | a few local file reads and writes, no network | shared memory, no I/O |
| **Concurrency** | **not atomic**: `FileStore::increment` reads, then `put`s, with no lock across both steps, so parallel hits can lose counts | atomic: `apcu_add` and `apcu_inc` |
| Shared across FPM workers | yes (same disk) | yes (same FPM master) |
| Survives deploy or cold start | no | no |
| Multiple instances | wrong (each counts alone) | wrong (each counts alone) |
| Needs a spec change | no | yes, via `/architect` (it changes the store and touches the Dockerfile) |

**Risks common to both**
- **Counters reset** on every deploy and every Render spin down after 15 min idle. Per minute limits lose at most one window. `register` (10 per hour) can grant a fresh 10 after a restart. Nobody outside can force a restart, though; it needs 15 min of quiet.
- **One instance only**: correct only while there's a single instance, which is always true on Free.
- **Bursts can already overshoot by one burst** on any store, because Laravel checks and then hits rather than doing both atomically. The database store at least records every hit, so the next burst is blocked. The `file` store can also *lose* hits, so a repeated parallel attack on `login` could keep slipping past the limit. On a 0.15 CPU instance, a process can easily be paused between the read and the write, which widens that gap.

## Recommendation

Use **APCu for the limiter**. It's the smallest change that keeps counting atomic, and that matters for the `login`, `register`, and `checkout` limiters spec 0006 relies on. The extra cost is one Dockerfile line, which adds build time on Render and carries a small risk of a build failure. Because it differs from the spec's "file", the first step would be:

```
/architect performance & reliability: AC-5 (b) use APCu instead of the file store for the rate limiter (FileStore::increment is not atomic)
```

If you'd rather stay inside the approved spec, the `file` store is acceptable for this demo, provided the lost update risk is added to the spec's Consequences.

## How we'd measure it

- **Same method as before**: one `/home` warm up call, wait 5 s, then 10 warm `--waterfall` runs.
- **Keep or revert**: compare against step 1's **973.4 ms**. Keep only if the median is **≤ 876.1 ms** (−10%); otherwise revert by unsetting `CACHE_LIMITER_STORE` and record "no measurable effect".
- **Expected signals**:
  - query counts drop by about 6 per call (`/home` from 7 to 1);
  - `db` falls sharply;
  - wave 2 calls stop waiting on each other for the row lock.
- **Before measuring**: confirm that one test request still returns `X-RateLimit-Remaining`. I'd also add a Pest test that `cache.limiter` is read from env and that the default stays null.
