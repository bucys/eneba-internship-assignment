# Session 090: Feature 17 AC-6 homepage API

- Session ID: `a8aa64b5-1713-48aa-a72f-820df2c59725`
- Source: `a8aa64b5-1713-48aa-a72f-820df2c59725.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-16 10:27 UTC → 2026-11-16 10:49 UTC
- Prompts: 3
- Full technical transcript: [full/session-090.md](../full/session-090.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-16 10:27 UTC · [open in full transcript](../full/session-090.md#prompt-1) · record `26579deb-a1ff-4aca-8fcc-447451875e04`</sub>

/develop Feature 17 — build plan Step 3, AC-6 homepage prefetch.

The production pre-check passed:
- Waterfall median: 729.1 ms.
- Parallel median: 575.0 ms (-21.1%).
- Required threshold: ≤ 656.2 ms.

Implement AC-6 according to spec 0016.

Requirements:
1. Add the React Router home loader that starts all five existing homepage queries concurrently.
2. Reuse the exact TanStack Query factories and keys.
3. Keep the block-to-query mapping in one shared source to prevent drift.
4. Preserve existing stale times, retries, error handling and cache invalidation.
5. Avoid duplicate requests and unnecessary refetching.
6. Add the specified Vitest coverage.
7. Verify loading and navigation behavior in a real browser, including the initial skeleton and populated blocks.
8. Run relevant client tests, lint, typecheck and build.

Preserve the uncommitted AC-17(iv) spec amendment and Step 3 measurement evidence.

Do not commit, push or deploy yet.

Report changed files, test results, browser findings and any risks before proceeding.

## CLAUDE · 1

*[5 tool calls: Skill, Bash ×4]*

Context gathered. Next I'm checking the installed TanStack Query version's prefetch behavior, then I'll write the loader.

*[1 tool call: Bash]*

Prefetch reuses the client default retry (`retry` only falls back to `false` when undefined), so retry rules carry over. Writing the shared map, loader, and route wiring now.

*[2 tool calls: Bash ×2]*

The five factories return different data types, so the loop's union doesn't infer. Trying explicit `unknown` generics before reaching for a cast.

*[1 tool call: Bash]*

A cast would hide real type errors, so I'll go with an exhaustive `Record<HomeBlockType, …>` instead. Then typecheck makes you add a prefetch whenever you add a block.

*[3 tool calls: Write, Bash ×2]*

All 14 pass. Quick sanity check that the new tests actually fail when the prefetch is removed:

*[1 tool call: Bash]*

The tests fail without the prefetch and pass with it, so they really check the loader. Next I'm running the full client gate.

*[1 tool call: Bash]*

Everything is green: format, lint, typecheck, 437/437 tests, and build. Now the browser check. I'm seeing what is already running locally.

*[3 tool calls: Bash ×2, ToolSearch]*

Local API started. In the browser I'm holding `/api/v1/home` for 1.5 s, so you can see whether the other four requests start before the layout arrives.

*[9 tool calls: mcp__playwright__browser_run_code_unsafe ×4, Bash ×3, Read ×2]*

The skeleton and populated states both look right, and the spec docs diff is the same as when I started. Stopping the two servers I started (not your dev server):

*[1 tool call: Bash]*

## /develop complete: Feature 17, Step 3, AC-6 homepage prefetch

AC-6 is built and passes all client checks. Nothing is committed, pushed or deployed.

**Changed files** (client only)
- [homeLoader.ts](client/src/pages/homeLoader.ts) (new): starts the layout query and all four block queries without waiting, then returns `null`.
- [home.ts](client/src/api/home.ts): adds `HOME_BLOCK_QUERIES`, the one map from block type to query factory, plus `homeProductsQuery()` (it wraps `productsQuery({})`, so the key is unchanged).
- [HomePage.tsx](client/src/pages/HomePage.tsx), [HeroBanners.tsx](client/src/components/home/HeroBanners.tsx), [ProductListSection.tsx](client/src/components/product/ProductListSection.tsx): the blocks now read their query from that map. The block components are typed as `Record<HomeBlockType, …>`, so if you add a block without a query (or the reverse), typecheck fails.
- [router.tsx](client/src/router.tsx): the index route now has `loader: homeLoader`.
- [HomePage.test.tsx](client/src/pages/HomePage.test.tsx): 3 new tests (below).

The query factories, keys, stale times, `select`, retry and invalidation are all unchanged. One thing worth knowing: prefetch keeps the shared `shouldRetryQuery`, because TanStack only sets `retry: false` on prefetch when retry is undefined, and the client sets it by default.

**Tests and checks**
- New tests: all five requests start while the layout is held, each fires once, and the blocks render after the layout arrives. A second loader call within the stale time sends no request. A failed banners prefetch still shows that block's Try again, and clicking it recovers.
- With the prefetch removed from the loader, all 3 new tests fail, so they really cover the loader.
- `format:check`, `lint`, `typecheck` and `build` all pass, and `npm test` passes 437 of 437.

**Browser findings** (local API, `/home` held back 1.5 s)
- **Production build:** all five requests start at 55 to 61 ms, once each. The `<h1>` and skeleton render, then the four blocks fill in.
- **Navigation:** going to `/store` reused the cached page 1 products, and going back home within the stale time sent zero requests.
- **Dev only:** `/home`, `/auth/me` and `/cart` each go out twice. Most likely cause: React StrictMode's fake unmount aborts the request (its `signal` was used) and the remount fetches again. It does not happen in the production build, and it also hits `/auth/me` and `/cart`, which this change doesn't touch.

**Risks**
- On error, a failed block request now runs twice: the prefetch tries (with its one retry), then the block fetches again on mount. AC-6 accepts this.
- A block the layout hides still costs one request (accepted in the spec).
- The prefetch map is written out once per key, because the factories return different data types. I chose that over a type cast, so typecheck still catches a missing entry.

**Scope and spec:** I didn't tick anything. Build plan Step 3 still has the AC-6 production measurement, `PublicCache` and the triage rows. The spec status stays `In Progress`, and the AC-17(iv) amendment and your Step 3 evidence in `verify.md` are unchanged. I stopped the API and preview servers I started; your dev server on `:5173` is still running.

**Verify steps** (tell me if you want them added to `verify.md`)
- Open `/` with a slow `/home`: the four block requests start before `/home` finishes, each once, and the skeleton shows first → AC-6
- Go `/` → `/store` → back within 60 s: no new home requests → AC-6
- Run `scripts/measure-home.sh <prod> --waterfall`, then `--parallel` after deploy; the parallel median should be ≤ 656.2 ms → AC-6

Suggested next, if you like: deploy and run the production `--parallel` measurement, then `PublicCache`. It might be worth running `/clear` before the next piece.

_⚙ Automated `task-notification` message (not written by the developer; content is in the full transcript)._

## CLAUDE · 1 (continued)

Nothing went wrong here. The "failed" notice is the local API server I started for the browser check, and it ended with exit code 143 because I stopped it on purpose. Your dev server on `:5173` is still running.

---

## USER · 2

<sub>2026-11-16 10:33 UTC · [open in full transcript](../full/session-090.md#prompt-2) · record `4dc29f69-aaaa-490c-af31-4d47fdba6c69`</sub>

Prepare Feature 17 AC-6 for production verification.

1. Review git diff and identify all changed files.
2. Preserve my intentional footer change removing the placeholder "Sign in". Do not revert or modify it.
3. Add the AC-6 browser verification steps to verify.md.
4. Commit only the approved AC-6 implementation, tests and related spec/evidence changes. Keep my unrelated footer edit uncommitted.
5. Push to main and check CI.

Do not modify Render environment variables or start AC-7.

After deployment, verify in the real production browser:
- All five homepage API requests start concurrently, before /home completes.
- No duplicate requests.
- Skeleton and blocks render correctly.
- Navigation away and back within 60 seconds reuses cached data.

Then run 10 warm --parallel measurements and compare against the 729.1 ms waterfall baseline and 656.2 ms keep threshold.

Record evidence and report KEEP/REVERT recommendation.

Do not mark Step 3 complete yet.

## CLAUDE · 2

*[1 tool call: Bash]*

Nothing new on origin. The footer edit is your only unrelated change, and I'll leave it uncommitted. Next I'm reading the uncommitted spec and evidence changes to see where the AC-6 steps belong.

*[1 tool call: Bash]*

I'll put the AC-6 browser checks in a new Step 3 section, right after the pre-check and before Raw evidence.

*[3 tool calls: Bash ×2, Edit]*

I'll make two commits, following the repo's pattern: the client code and tests, then the spec and evidence. The footer stays out. Running a final client check first:

*[1 tool call: Bash]*

One test failed in that run, with your footer edit stashed out (so the original footer was in place). The stash is restored. Finding which test failed:

*[2 tool calls: Bash ×2]*

Passes 5 runs out of 5 now, so it looks flaky. If it's one of my new tests, it needs fixing before the push. Looping the suite to catch the failing name:

*[3 tool calls: Bash ×3]*

The flake is older than this change: it fails 2 of 15 runs on clean `HEAD` too, same test. I'll leave it and report it, not fix it now. Cleaning up the worktree and committing:

*[1 tool call: Bash]*

Both commits are in, and only the footer is left uncommitted. Pushing and watching CI:

*[2 tool calls: Bash ×2]*

CI is green on all three jobs. Next I'm finding the Vercel production deployment for `6e83f76`.

*[3 tool calls: ToolSearch, Bash, mcp__claude_ai_Vercel__list_projects]*

The Vercel connector needs team access, so I'll skip it and check the live site's JS bundle for the new code.

*[11 tool calls: Bash ×7, mcp__playwright__browser_run_code_unsafe ×2, Read ×2]*

The median run finish is **574.7 ms**, under the 656.2 ms bar. Getting the per run detail to record it:

*[1 tool call: Bash]*

All 50 calls returned 200 with no 429. That is −21.2% against the 729.1 ms waterfall, and the same as the 575.0 ms pre-check. Recording it in `verify.md`:

*[3 tool calls: Bash ×3]*

The three slow calls are all in Run 1, the first run after warm up. Adding that detail:

*[1 tool call: Edit]*

## Feature 17, AC-6: I recommend you KEEP it

The prefetch is live on production. The median run finish dropped to **574.7 ms** from the 729.1 ms waterfall baseline (**−21.2%**). That is 81.5 ms under the 656.2 ms keep bar, and it matches the 575.0 ms pre-check.

**What's committed and pushed**
- `5646940` feat(client): the loader, the shared `HOME_BLOCK_QUERIES` map, the router change and the 3 new tests.
- `6e83f76` docs(spec-0016): the AC-17(iv) amendment, the Step 3 pre-check evidence and the AC-6 browser steps.
- CI passed on all three jobs (server, checkout-concurrency, client).
- I confirmed the new loader is in the live Vercel bundle (`index-_dDjeDDl.js`). I didn't touch Render env and didn't start AC-7.

**Your footer edit** is still uncommitted and unchanged. One thing you may want to look at: it leaves an empty `<li>` behind in [Footer.tsx](client/src/components/layout/Footer.tsx).

**Production browser checks** (fresh browser context, warm API)
- **Concurrent start:** all five GETs start within 1 ms of each other. With `/home` held 1.5 s, the four block requests finished at 735 to 854 ms, before `/home` finished at 1903 ms.
- **No duplicates:** each request went out once, none aborted.
- **Skeleton:** while `/home` was pending, the `<h1>` and full skeleton showed with no block headings. Then all four blocks rendered in layout order.
- **Navigation:** `/` → `/store` → back took 3.1 s. `/store` reused the cached `/products` page and only fetched `/catalog/filters`. Going back sent zero API requests.

**Measurement** (10 warm `--parallel` runs, 50 of 50 calls returned 200, no 429)
- Median run finish 574.7 ms, max 926.3 ms. The slowest calls were all in Run 1, the first after warm up, so it looks like a shared server stall rather than one slow call.
- The tail is wider than in the pre-check (max 744.7 ms there), but the median is the same.

**Recorded in `verify.md`** (not committed yet): a new Step 3 row in the Steps table, four of five browser boxes ticked, the session table, the measurement table and the raw output. The fifth box (a failed prefetch shows Try again) stays unticked: only the Vitest test covers it, because forcing a 5xx on production would need a server change.

**Two things to know**
- `StorePage.test.tsx` "keeps the previous results dimmed…" is flaky, unrelated to this change. It failed 2 of 15 full suite runs on the commit before mine, and passes when run on its own.
- The curl script only fires requests the same way the new client does; it doesn't run the client. The browser sessions are what show the shipped client makes that pattern.

Build plan Step 3 is not ticked. Should I commit the `verify.md` evidence now, or hold it until `PublicCache` and the triage rows are done?

---

## USER · 3

<sub>2026-11-16 10:46 UTC · [open in full transcript](../full/session-090.md#prompt-3) · record `85f57049-92ca-42d8-a34d-da8479446d03`</sub>

Finalize AC-6 evidence without completing Feature 17 Step 3.

1. Review the uncommitted verify.md production evidence.
2. Record AC-6 as KEEP: 729.1 ms → 574.7 ms (-21.2%).
3. Keep the production error-state browser check explicitly unverified; reference the passing Vitest test separately.
4. Commit and push only the AC-6 verification documentation.
5. Preserve my uncommitted Footer.tsx edit exactly as-is.
6. Leave Step 3 unticked because PublicCache (AC-7) and triage remain.

Do not implement AC-7 yet.
Do not change application code or Render settings.

Report commit hash and CI status.

## CLAUDE · 3

Reviewing the evidence lines I'll change: the KEEP decision and the error state box.

*[2 tool calls: Bash ×2]*

Committed and pushed `4746081`. Only the footer is left uncommitted. Watching CI:

*[1 tool call: Bash]*

The AC-6 evidence is committed and pushed as **`4746081`**, and CI (run 43851937962) passed on all three jobs (server, client, checkout-concurrency).

**What changed in `verify.md`** (the only file in the commit)
- **KEEP recorded:** the Steps table row and the AC-4 line now say KEEP, 729.1 ms → 574.7 ms (−21.2%), 81.5 ms under the 656.2 ms bar.
- **Error state on production:** that box stays unticked and now says "Not verified on production."
- **Vitest evidence, kept separate:** a paragraph names the passing test `home route prefetch > shows the block's Try again when its prefetch fails`, green in CI at `6e83f76`. It says plainly that the test is not a substitute for the production check.
- The other four production browser checks, the measurement table and the raw output went in as reviewed.

**What I left alone**
- **Build plan Step 3** in `index.md` is still unticked (`3. **Homepage client and cache.**`), since `PublicCache` (AC-7) and the triage rows remain.
- No application code, no Render settings, and nothing for AC-7.
- **`Footer.tsx`** was not staged or touched. Its diff is now 5 deleted lines instead of the 3 from earlier, so it looks like you edited it again in your editor. That's left exactly as you have it.
