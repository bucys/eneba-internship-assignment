# Session 022: AC-6 CORS allow-origin rules

- Session ID: `291956d2-cb61-4117-9cdc-4103e01cfe24`
- Source: `291956d2-cb61-4117-9cdc-4103e01cfe24.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-11 20:12 UTC → 2026-11-12 09:46 UTC
- Prompts: 6
- Full technical transcript: [full/session-022.md](../full/session-022.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-11 20:12 UTC · [open in full transcript](../full/session-022.md#prompt-1) · record `fda22f9e-a270-4cd2-bd78-00dfa1432f66`</sub>

`/develop`

walking skeleton + public deploy

## CLAUDE · 1

I'll start with the freshness check and read the scope and the new spec.

*[4 tool calls: Bash ×3, Read]*

Now the server side: models, bootstrap, provider, and existing tests.

*[1 tool call: Bash]*

Let me check what spec 0001 says about proxy trust, CORS, and the Docker env, plus the factories and laravel skill.

*[2 tool calls: Bash ×2]*

Let me confirm how the CORS package matches patterns, and skim the laravel skill.

*[1 tool call: Bash]*

I have what I need. Building step 1 (price scope and helpers) and step 2 (route, limiter, action, resource).

*[9 tool calls: Bash ×2, Write ×6, Edit]*

Now I'll wire up routing, proxy trust, and the limiter, then publish the CORS config.

*[2 tool calls: Bash ×2]*

Now the Pest tests for the price rule, discount, list shape, rate limit, pagination, and CORS.

*[2 tool calls: Bash ×2]*

Two blank pattern tests fail. Let me check why in the package.

*[1 tool call: Bash]*

**Claude asked — spec gap** (select one):

> AC-6 conflicts with the CORS package. With a blank preview pattern, the package always sends Access-Control-Allow-Origin set to FRONTEND_URL, even when the request comes from another origin. Browsers still block the other origin, so this is safe, but the spec says 'no header'. How should I handle it?
> - **Update the spec first** — Recommended. Stop the CORS part and run `/architect walking skeleton + public deploy: AC-6 blank pattern sends the single FRONTEND_URL origin, not no header`. I keep building the rest meanwhile.
> - **Tell me the answer now** — You state the rule now (for example, 'the header never equals a foreign origin'). I record it via /architect before finishing, and test that rule.

**USER answered:**

Tell me the answer now

*[2 tool calls: Edit, Bash]*

Two PHPStan fixes: declare the computed column on the model, and simplify the origins list.

*[1 tool call: Bash]*

The docblock has to sit above the attribute for PHP to attach it. Moving it.

*[1 tool call: Bash]*

Server steps 1 to 3 pass (126 tests, Pint, PHPStan). Now the client: I'll read the existing pieces the section will reuse.

*[2 tool calls: Bash ×2]*

Installing TanStack Query (approved in spec 0001), then checking its installed version.

*[2 tool calls: Bash ×2]*

Let me confirm how `retry` counts failures in the installed version before writing the predicate.

*[1 tool call: Bash]*

`failureCount` is 0 on the first failure, so "retry once" is `failureCount < 1`. Writing the data layer.

*[1 tool call: Bash]*

Wiring the provider and the home page.

*[1 tool call: Bash]*

Now the Vitest tests for `apiFetch`, the retry rule, and the mapping.

*[1 tool call: Bash]*

All client checks pass (22 tests, lint, typecheck, build). Now a local end to end check: the API against the seeded dev DB, with the CORS header.

*[1 tool call: Bash]*

The API serves all 81 seeded products correctly, with CORS for the local frontend. Now step 6, the Dockerfile. I'll check the image's defaults directly rather than guess.

*[1 tool call: Bash]*

Port 8080 and the `/var/www/html/public` web root are defaults, and `pdo_pgsql` is present. Let me confirm the autorun variable names the spec relies on.

*[1 tool call: Bash]*

Names match. Writing the Dockerfile and `.dockerignore`.

*[1 tool call: Bash]*

Built. Now running it against a fresh, throwaway database on the compose Postgres, so the start up migrations really run.

*[2 tool calls: Bash ×2]*

Both `.env.example` files already list every key this feature reads, and no Render, Neon, or Vercel host appears in tracked code. One last full run of the server checks:

*[1 tool call: Bash]*

Everything is green. I'll tick the three milestones that are built and checked in the scope.

*[1 tool call: Bash]*

**Claude asked — Push main?** (select one):

> Spec step 7 is a push to main so CI runs. Should I commit this work (server endpoint, CORS, proxy trust, Dockerfile, client data layer and grid, tests) and push it to main now?
> - **Commit and push** — Recommended. One feature commit on main, pushed, then I watch the CI run with gh and report the result.
> - **Commit only** — Commit locally and don't push. You push when you're ready.
> - **Neither** — Leave everything uncommitted so you can review the diff first.

**USER answered:**

Commit and push

**Claude asked — Verify steps** (select one):

> Save the verify steps for walking skeleton + public deploy to docs/specs/0005-walking-skeleton-deploy/verify.md, or just show them in the summary?
> - **Save to verify.md** — Recommended here, since the deploy checks are manual: a durable checklist /check verify can run.
> - **Just show in summary** — Keep them in this report only.

**USER answered:**

Save to verify.md

Writing `verify.md`, then committing and pushing.

*[5 tool calls: Write, Bash ×4]*

I built everything that can run on your machine and pushed it to `main` (commit `349b0d7`). CI hasn't run yet: after more than 10 minutes the run is still `queued` with no jobs started, so it looks like GitHub is waiting for a runner. A background watcher will tell me when it finishes.

**What works now**
- **API:** `GET /api/v1/products` returns 24 products per page, sorted with priced games first. The price is the cheapest active offer that still has a key to sell, the discount is computed on the server, and each IP can make 120 requests per minute. Against the seeded dev database it returned all 81 products with correct prices.
- **CORS and proxy trust:** the allowed origins come from `FRONTEND_URL` and `CORS_PREVIEW_ORIGIN_PATTERN`. A blank pattern turns previews off; it never becomes a pattern that matches every origin. The proxy setup follows spec 0001.
- **Client:** I added `apiFetch` (90 s timeout, typed `ApiError`), TanStack Query 5.107 (retries once after 3 s, only on network errors and 5xx), and a "Browse games" grid on the home page. The grid has loading, slow ("waking up the server"), error, empty, and loaded states.
- **Dockerfile:** I built the image and ran it against an empty database. The migrations ran with no seed, `/up` returned 200, and the container health check reported healthy.
- **Checks:** all pass. The server has 126 Pest tests plus Pint and PHPStan. The client has 22 Vitest tests plus lint, typecheck, and build.

**One change from the spec you should confirm:** AC-6 says any other origin gets no `Access-Control-Allow-Origin` header. That only holds while a preview pattern is set. With a blank pattern, the CORS package always sends the `FRONTEND_URL` origin, whatever the request's origin. Browsers on other sites are still blocked, so it's safe. You chose to give the rule now but didn't state one, so I tested the rule I proposed: the header never echoes a foreign origin. If you agree, I'd suggest recording it in the spec: `/architect walking skeleton + public deploy: AC-6 blank pattern returns the single FRONTEND_URL origin`.

**Not checked yet:** I haven't looked at the grid in a browser, so its visual states still need the manual steps in `verify.md`.

**What I updated**
- **Spec 0005:** status moved from `Proposed` to `In Progress`, and I added [verify.md](docs/specs/0005-walking-skeleton-deploy/verify.md). Its build plan is a numbered list, so it had no checkboxes to tick.
- **Scope:** I ticked three milestones (products API, CORS and proxy trust, client grid). "Dockerfile, checks green, CI on `main`" stays open until CI is green, and the deploy milestone is still open.

**Next, in your dashboards (spec steps 8 to 11):**
1. Create a Neon project (Postgres 17, Frankfurt).
2. Create a Render service with every env var from the spec. You can get `APP_KEY` with `php artisan key:generate --show`.
3. Seed production from your machine.
4. Create the Vercel project with `VITE_API_URL` set before the first build.
5. Set `FRONTEND_URL` and the preview pattern on Render.
6. Do the one time IP log check.

When the deploy is live, you could run `/check verify walking skeleton + public deploy`. I'd suggest a `/clear` before the next feature.

---

## USER · 2

<sub>2026-11-11 20:45 UTC · [open in full transcript](../full/session-022.md#prompt-2) · record `c89c5448-6570-4694-88db-0a8207a65489`</sub>

Keep AC-6 unchanged. Return Access-Control-Allow-Origin only for the exact FRONTEND_URL or an origin matching the configured preview pattern. A blank preview pattern allows no preview origins. For disallowed origins, omit the CORS allow-origin header. Record the decision in the spec and implement the smallest compatible solution.

## CLAUDE · 2

Files I'll change, and why:
- `server/config/cors.php`: get around the package's single origin shortcut so a disallowed origin never gets the header
- `server/tests/Feature/CorsTest.php`: test AC-6 exactly as written again
- `docs/specs/0005-walking-skeleton-deploy/index.md`: record the decision in the CORS config bullet (you asked for this; normally `/architect` owns spec content)
- `docs/specs/0005-walking-skeleton-deploy/verify.md`: remove the blank pattern exception I added

The smallest fix: pass `FRONTEND_URL` to the package as an exact, anchored pattern (`^…$`, with special characters escaped) instead of as a plain origin. The shortcut only applies when there are no patterns, so this way the package always checks the request's origin and leaves the header off when it doesn't match.

*[1 tool call: Bash]*

CI is still queued. Making the edits now.

*[1 tool call: Bash]*

131 tests pass, plus Pint and PHPStan. Now I'll record the decision in the spec and fix the verify step.

*[1 tool call: Bash]*

AC-6 is unchanged and the code now meets it exactly. Server checks all pass: 131 Pest tests (up from 126), Pint, and PHPStan.

- **Cause:** the CORS package has a "single origin" shortcut. When there's exactly one allowed origin and no patterns, it sends that origin on every response, even when the request's origin isn't allowed.
- **Fix ([cors.php](server/config/cors.php)):** `allowed_origins` is now empty. `FRONTEND_URL` is passed in as an exact, anchored pattern (`'#^'.preg_quote($url, '#').'$#'`), next to the preview pattern when one is set. With a pattern in the list, the shortcut never runs, so the package only returns a request origin that matches. Any other origin gets no header, whether the preview pattern is set or blank.
- **Tests ([CorsTest.php](server/tests/Feature/CorsTest.php)):**
  - With a blank pattern, a preview origin and an unrelated origin get no header.
  - The frontend origin still gets the header with a blank pattern.
  - The frontend match is exact: a longer host, a dot standing in for any character, and `http` instead of `https` are all rejected.
  - With neither variable set, no origin is allowed.
- **Spec:** I recorded the decision in [index.md](docs/specs/0005-walking-skeleton-deploy/index.md), in the CORS bullet of *Configuration required*: AC-6 unchanged, why the shortcut breaks it, and the exact pattern fix. In [verify.md](docs/specs/0005-walking-skeleton-deploy/verify.md) I removed the exception for a blank pattern from the foreign origin step.

These 4 files are not committed. Your earlier go ahead covered only the first commit, so tell me if you want this one committed and pushed. The CI run for `349b0d7` is still queued on GitHub with no jobs started, and the background watcher will report when it finishes.

---

## USER · 3

<sub>2026-11-11 20:51 UTC · [open in full transcript](../full/session-022.md#prompt-3) · record `bec213d8-1e87-4e90-8f64-10670b0c99ed`</sub>

Approved. Commit and push the four CORS-related files. Do not modify anything else. Report the commit hash and CI status. If GitHub Actions remains queued, don't repeatedly retry or push additional commits.

## CLAUDE · 3

*[1 tool call: Bash]*

I committed the four CORS files as **`362eb44`** and pushed it to `main`. No other files changed, and the working tree is clean.

**CI has not run yet.** Both runs on `main` are stuck in GitHub's queue:

| Run | Commit | Status |
|---|---|---|
| 43098464245 | `362eb44` (CORS fix) | queued |
| 43096577646 | `349b0d7` (walking skeleton) | queued, for more than 10 minutes |
| 43091192604 | `b64efac` (earlier) | passed |

The earlier run passed, so the workflow itself works. The new runs look like they're waiting for GitHub to assign a runner. As you asked, I won't retry or push anything else. A background watcher is still on run `43096577646` and will tell me when it finishes. You can also check both runs yourself with `gh run list --branch main --limit 3`.

The "Dockerfile, checks green, CI on `main`" milestone stays unticked in the scope until CI is green.

_⚙ Automated `task-notification` message (not written by the developer; content is in the full transcript)._

## CLAUDE · 3 (continued)

*[1 tool call: Bash]*

The background watcher has exited, but CI still hasn't run. It ended without reporting a result, while both runs are still queued with no jobs started:

| Run | Commit | Status |
|---|---|---|
| 43098464245 | `362eb44` (CORS fix) | queued |
| 43096577646 | `349b0d7` (walking skeleton) | queued |

As you asked, I'm not retrying, starting another watcher, or pushing anything. If the runs stay queued, check the repo's Actions tab: a GitHub Actions outage or a paused or limited Actions setting would explain it. The CI milestone stays unticked until a run passes.

---

## USER · 4

<sub>2026-11-12 07:12 UTC · [open in full transcript](../full/session-022.md#prompt-4) · record `069f20ec-aabd-484d-a8c3-79685cbd8199`</sub>

GitHub Actions is working again. A new commit has triggered CI successfully.

Check the latest CI run on main and confirm that both client and server jobs passed. If successful, update Feature 6 verification documentation and mark only the CI-related checks as passed.

Do not retry the two old stuck runs. Do not commit or push anything yet. Report the remaining Feature 6 verification steps, especially Neon, Render, and Vercel deployment.

## CLAUDE · 4

*[4 tool calls: Bash ×4]*

CI passed on `main`. Run `43173320123` on `a12f635` was green in both jobs:
- **server:** Pint, PHPStan, and Pest all passed.
- **client:** Prettier, oxlint, TypeScript, Vitest, and the build all passed.

That commit only adds manual workflow dispatch on top of `362eb44`, so it covers all the Feature 6 code. I didn't touch the two old stuck runs.

**What I changed:** in [verify.md](docs/specs/0005-walking-skeleton-deploy/verify.md) I ticked only the CI step (AC-13), noted the run ID and date, and updated the header date. Nothing is committed or pushed.

**Two things I left alone:**
- The local server and client command steps in `verify.md` run the same checks as CI. I didn't tick them because you said CI checks only. Tell me if you want them counted as passed through CI.
- The scope milestone "Dockerfile, checks green, CI on `main`" is now fully met, but it lives in the scope file, not the verify doc, so I didn't tick it.

**Remaining Feature 6 steps**

*Deployment (your dashboards, spec steps 8 to 11):*
1. **Neon:** create a Postgres 17 project in AWS `eu-central-1` (Frankfurt) and copy the direct connection string, not the pooled one, with `sslmode=require`.
2. **Render:** create a Docker web service with root `server/`, region Frankfurt, free plan, auto deploy from `main`, and health check path `/up`.
   - App env vars: `APP_KEY` (from `php artisan key:generate --show`), `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, `DB_CONNECTION=pgsql`, `DB_URL`, `FRONTEND_URL`, `CORS_PREVIEW_ORIGIN_PATTERN`, `CACHE_STORE=database`, `SESSION_DRIVER=array`, `QUEUE_CONNECTION=sync`, `MAIL_MAILER=log`, `LOG_CHANNEL=stderr`.
   - Container env vars: `PORT=8080`, `AUTORUN_ENABLED=true`, `AUTORUN_LARAVEL_MIGRATION_TIMEOUT=60`, `AUTORUN_LARAVEL_MIGRATION_SEED=false`, `HEALTHCHECK_PATH=/up`.
   - Check the first deploy log for the migrations and a passing `/up` (AC-10).
3. **Seed production** from your machine: ` APP_ENV=production DB_URL=<neon direct url> php artisan db:seed --force` (the leading space keeps it out of shell history), then run spec 0004's cover URL check (AC-11).
4. **Vercel:** create the project with root `client/`. Set `VITE_API_URL` to the Render origin for both Production and Preview **before the first build**, because Vite bakes it in at build time.
5. **Back on Render:** set `FRONTEND_URL` to the Vercel production origin. Once you know the project name and scope slug, set `CORS_PREVIEW_ORIGIN_PATTERN`. Then redeploy both.

*Production checks:*
- The Vercel URL shows the seeded grid, and DevTools shows the request going to Render (AC-11).
- A cold Render instance shows the waking notice, then the grid (AC-8).
- CORS: the production origin and a preview origin get the allow-origin header, and `https://evil-eneba.vercel.app` gets none (AC-6).
- A preview deployment loads the grid (AC-6).
- Add a temporary `Log::info($request->ip())`, confirm it logs your real IP, then remove it and redeploy (AC-12).
- 121 requests within a minute: the last one returns 429 with `Retry-After` (AC-5).
- `git grep` finds no Render, Neon, or Vercel host outside `docs/` (AC-11).

*Local checks that still need a browser (UI and value sourcing sections):*
- The grid's loading, slow, error, retry, and empty states.
- The Network tab request.
- The price, discount, and ordering edge cases against the seeded database.

When the deploy is live, you could run `/check verify walking skeleton + public deploy` to work through all of these.

---

## USER · 5

<sub>2026-11-12 08:31 UTC · [open in full transcript](../full/session-022.md#prompt-5) · record `35ff0587-a982-4418-858f-25d20602ed11`</sub>

Update Feature 6 verification documentation:

- Mark the completed "Dockerfile, checks green, CI on main" scope milestone as done.
- Count equivalent automated checks as passed based on GitHub CI run 43173320123. Record CI as the evidence; do not claim they were run locally.
- Keep manual browser, integration, and deployment checks unticked.
- Commit and push documentation changes only. Do not modify application code or start deployment.

Report the commit hash and remaining verification steps.

## CLAUDE · 5

*[2 tool calls: Bash ×2]*

I committed and pushed the documentation changes as **`7327622`**. Only two documentation files changed, and the working tree is clean.

**Ticked, with GitHub CI run `43173320123` (on `a12f635`) recorded as the evidence and "not run locally" stated next to each:**
- The scope milestone "Dockerfile, checks green, CI on `main`" in [scope.md](docs/scope/scope.md).
- The server check command: Pint, PHPStan, and Pest, from the `server` job.
- The client check command: Prettier, oxlint, TypeScript, Vitest, and build, from the `client` job.
- The timeout and retry step, covered by the Vitest files CI ran.
- The CI step itself was already ticked.

**Remaining verification steps in [verify.md](docs/specs/0005-walking-skeleton-deploy/verify.md)**

*Local, need a browser (AC-7 to AC-9):*
- The grid layout and card links.
- The throttled load: 12 skeletons and the waking notice after about 3 s.
- The stopped API: one retry, the error state, then "Try again".
- The empty state.
- The request in the Network tab.

*Local value checks against the seeded database (AC-1 to AC-4, AC-7 to AC-9):*
- Active filter, order, and paging.
- Item fields, the price rule, EUR currency, list price, and discount rounding.
- The waking notice timing.
- The loading count and the empty state text.
- The `VITE_API_URL` grep.
- The CORS and proxy rows, which point to the production steps.

*Automated, but not part of CI:*
- Docker image build and run against an empty database (AC-10).
- 121 requests in a minute, expecting 429 with `Retry-After` (AC-5).

*Deployment and production (AC-5, AC-6, AC-8, AC-10 to AC-12):*
- Render's first deploy log shows the migrations and a passing `/up`.
- The Vercel URL shows the seeded grid, with requests going to Render.
- A cold start shows the waking notice.
- CORS: the production origin and a preview origin get the header, and `evil-eneba.vercel.app` gets none.
- A preview deployment loads the grid.
- A temporary `$request->ip()` log shows your real IP, then gets removed.
- `git grep` finds no committed hosts.

The scope's "Deploy to Neon, Render, Vercel; seed and production checks" milestone and the "Build it" box are still open, so Feature 6 stays `in-progress`. Once you've done the dashboard setup and the deploy is live, you could run `/check verify walking skeleton + public deploy` to close out these steps.

---

## USER · 6

<sub>2026-11-12 09:14 UTC · [open in full transcript](../full/session-022.md#prompt-6) · record `1526dd2e-f2f2-4c14-8450-6863a0009a97`</sub>

Feature 6 Render deployment is live at https://eneba-api.onrender.com.

The /up endpoint works and GET /api/v1/products returns HTTP 200 with an empty catalog (total: 0).

Before production seeding, review the existing seeders and provide a safe, exact procedure to seed Neon from my local machine without changing server/.env or exposing DB credentials in shell history.

Verify that the seed is idempotent and preserves existing orders and sold keys. Do not execute any production commands or modify code. Report the commands and safety checks.

## CLAUDE · 6

I'll review the seeders and the existing seed tests. Nothing here touches production.

*[6 tool calls: Bash ×5, Read]*

I haven't run anything against production or changed any files. The seed is safe to run on Neon, but don't use spec 0004's leading space method on this machine (details below). Use the procedure further down instead.

## Review findings (checked locally only)

- **Idempotent:** platforms, regions, and sellers are upserted by `slug`, products by `slug`, and offers by `(product_id, seller_id)`. A second run changes no row counts or ids. The test `reruns without changing counts or ids` passes.
- **Orders and sold keys are kept:** the seeder never deletes a row. It never touches `orders`, `order_items`, `cart_items`, or a key's `order_item_id`. It only adds keys until each offer's *unsold* count is back at its target. The tests `keeps sold keys and orders on rerun` and `never deletes unsold keys above the target` pass (18 of 18 seed tests passed on the local test database).
- **Manual changes survive a rerun:** `is_active` is set on insert only, so a product or offer you turn off by hand stays off.
- **Prices stay stable:** offer prices come from a fixed random sequence seeded from each product's slug (`crc32($slug)`), so a rerun writes the same prices. Even if they changed, orders keep their own `order_items.unit_price_cents`.
- **All or nothing:** everything runs in one `DB::transaction`, so a dropped Neon connection rolls back the whole seed. With `APP_ENV=production`, no test user is created and the destructive command guard is on.
- **Your `.env` loses to the shell:** I ran a local check with a fake host and `APP_ENV=production`. Laravel reported `production` and the fake host, so a shell `DB_URL` wins over the one in `.env`. There is no `bootstrap/cache/config.php`, which matters because a cached config would ignore shell env vars.
- ⚠️ **Shell history:** `HIST_IGNORE_SPACE` is not set in your zsh, so spec 0004's leading space would still save the URL in history. The procedure below reads the URL with `read -s` instead, so it never appears in a command line.

## Procedure

**0. Before you start (no database connection):**
```zsh
cd ~/AI_WORKSPACE/Projects/eneba/server
git status --short                                   # expect: empty
git diff --quiet origin/main -- database/ && echo "seed data matches main: OK"
test ! -f bootstrap/cache/config.php && echo "no config cache: OK"
```

**1. Backup point (Neon console):** create a branch from `main`, for example `pre-seed-2026-11-12`. It's instant and lets you restore the database. Copy the **same direct connection string Render uses**: the host has no `-pooler`, and the string includes `sslmode=require`.

**2. Seed, in one subshell (the URL disappears when the subshell exits):**
```zsh
(
  read -rs "NEON_URL?Paste Neon DIRECT connection string: "; echo
  case "$NEON_URL" in
    *-pooler.*) echo "STOP: pooled host, use the direct one"; exit 1 ;;
    *sslmode=require*) ;;
    *) echo "STOP: missing sslmode=require"; exit 1 ;;
  esac
  export APP_ENV=production DB_URL="$NEON_URL"; unset NEON_URL

  php artisan db:show --counts    # CHECK: Host = your Neon direct host; products 0, orders 0
  php artisan migrate:status      # CHECK: every migration "Ran"
  read -q "?Seed this database? [y/N] " || { echo; echo "aborted"; exit 1; }; echo

  php artisan db:seed --force
  php artisan db:show --counts    # EXPECT: platforms 4, regions 3, sellers 8, products 81, users 0

  # Optional idempotency check in production (safe: there are no orders yet)
  php artisan db:seed --force
  php artisan db:show --counts    # EXPECT: identical counts, product_keys unchanged

  # Cover URL check (spec 0004, AC-8): prints only failures
  php artisan tinker --execute="foreach (App\Models\Product::query()->distinct()->pluck('cover_image_url') as \$u) { echo \$u.PHP_EOL; }" \
    | grep '^https://' | while read -r url; do
        result=$(curl -sL --max-time 15 -o /dev/null -w "%{http_code} %{content_type}" "$url")
        case "$result" in "200 image/jpeg"*) ;; *) echo "FAIL $result $url" ;; esac
      done
)
pbcopy </dev/null                  # clear the URL from the clipboard
```
`db:show` prints the host, database, and username, but not the password.

**3. Check the public API (no credentials needed):**
```zsh
curl -s https://eneba-api.onrender.com/api/v1/products \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["meta"]["total"], d["data"][0]["name"], d["data"][0]["price"])'
# EXPECT: 81, then a game name and a { amount, currency: EUR } price
```
This may take up to a minute if Render is cold.

**4. Afterwards:**
- Run `fc -l -30 | grep -ci neon.tech`. It should print `0`.
- Delete the Neon backup branch once you're happy with the result.

**What to watch for:**
- Stop if `db:show` shows a host other than Neon.
- Stop if `products` isn't 0 before the first seed.
- If the connection fails on `channel_binding=require`, your local libpq is too old for it. Ask before removing that parameter.

**Spec note:** the leading space instruction in spec 0004 (and in step 9 of spec 0005) doesn't work on this machine. To change it, you could run `/architect seed catalog data: production seed uses read -s, not a leading space`. For now, follow the procedure above. Once the seed passes, the next verify steps are the Vercel setup and the production checks in `verify.md`.
