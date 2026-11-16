# Session 060: AC-5 fix, spec 0012 and Feature 13

- Session ID: `2818dac7-b933-43e3-a1d5-c76ac7f691f9`
- Source: `2818dac7-b933-43e3-a1d5-c76ac7f691f9.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-13 15:38 UTC → 2026-11-13 15:58 UTC
- Prompts: 2
- Full technical transcript: [full/session-060.md](../full/session-060.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-13 15:38 UTC · [open in full transcript](../full/session-060.md#prompt-1) · record `9621cf70-1aa0-4b34-b5f6-e7b22b3c0947`</sub>

/debug store catalog

Investigate the AC-5 Enter → immediate Tab race reported in verify.md.

Reproduce it in a real browser and identify why two identical navigation requests create two history entries.

Fix the root cause, not just the Enter/Tab event sequence. Preserve:
- No-op actions never add history entries.
- Real filter changes reset pagination to page 1.
- Back/Forward restores the correct filter state.
- Rapid consecutive changes to different filters are not lost.

Add a regression test that reproduces the race before the fix, and verify the fix with a real browser test.

Keep changes scoped to AC-5. Do not commit, deploy, or mark Feature 13 complete yet.

## CLAUDE · 1

*[5 tool calls: Skill, Bash ×4]*

Reading the store URL hook now, it's the likely place where the two pushes come from.

*[2 tool calls: Bash ×2]*

Both servers are up. Reproducing in a real browser with Playwright.

*[2 tool calls: ToolSearch, mcp__playwright__browser_run_code_unsafe]*

Reproduced: 4 of 5 runs push `/store?price_min=10` twice. Now checking what the URL is at the moment the blur handler runs.

*[6 tool calls: mcp__playwright__browser_run_code_unsafe ×2, Bash ×4]*

Writing the two regression tests first, so we can watch them fail on the current code.

*[4 tool calls: Edit, Bash ×3]*

Both fail for the right reason (duplicate push, lost tick). Now the fix.

*[2 tool calls: Write, Bash]*

Updating the callers to send updaters that build on the latest state.

*[1 tool call: Bash]*

All 21 store tests pass, typecheck and lint clean. Small tidy: use the shared `StoreParamsUpdate` type in both components instead of repeating it, then run the full client checks.

*[1 tool call: Bash]*

Full client suite green (340 tests, build ok). Now the real browser pass against the dev server, covering the race plus the four behaviours you asked to keep.

*[3 tool calls: mcp__playwright__browser_run_code_unsafe ×2, Bash]*

## /debug complete · Enter then an immediate Tab on a price field pushed the same URL twice

**Root cause: `apply` in [useStoreParams.ts](client/src/lib/useStoreParams.ts) compared the change against `params` from the last render, not the latest URL.** Enter navigates, and the router pushes `?price_min=10`. The Tab blur then fires before React re-renders, so `apply` still sees the old empty `params`, decides the change is real, and pushes the same URL again. In the browser, that happened in 4 of 5 runs.

The same stale snapshot caused a second, silent bug: two checkbox ticks before a render kept only the second one. In the browser that left `?platform=playstation` and lost `nintendo`.

**Fix:** `apply` now reads the latest URL at the moment it is called.
- A ref holds the URL `apply` just asked for, and it re-syncs from `location.search` after each commit (Back and Forward included).
- `apply` now takes an updater, `(current) => next`, so each change builds on the latest state, not on the render's copy.
- Callers switched to updaters: [StoreFilterPanel.tsx](client/src/components/store/StoreFilterPanel.tsx), [ActiveFilterChips.tsx](client/src/components/store/ActiveFilterChips.tsx), and [StorePage.tsx](client/src/pages/StorePage.tsx) (sort and Clear filters). The `/ui` showcase passes a `useState` setter, which already accepts updaters, so it needed no change.

**Evidence:**
- **Regression tests** in [StorePage.test.tsx](client/src/pages/StorePage.test.tsx): one fires Enter then blur in the gap between the push and the render, the other does two ticks before a render. Both failed before the fix (two pushes; `?platform=xbox`) and pass now.
- **Client checks:** format, lint, typecheck, all 340 tests and the build pass.
- **Real browser** (Playwright on the dev server):
  - Enter then Tab pushed exactly once in 10 of 10 runs.
  - Rapid ticks kept both, 3 of 3.
  - Enter and blur on the same price, and choosing the current sort, pushed nothing.
  - A tick on `?page=2` dropped `page`.
  - Back and Forward restored the checkboxes and the Min field, and a change after Back built on the restored state.

**One side effect:** two ticks made before a single render now give one history entry (the second navigation cancels the first), so Back undoes both. AC-5 says each change pushes one entry, so the spec may want a line on this.

**Heads up:** [SearchForm.tsx:40](client/src/components/layout/SearchForm.tsx#L40) uses the same render time check for the AC-10 "no entry for the same URL" rule. It would only trip on two submits within one frame, so I left it alone because it is outside AC-5.

Nothing is committed, deployed, or ticked in verify.md. If you want, run `/test store catalog` to round out coverage, then tick the AC-5 Enter/Tab line in verify.md once you've checked it yourself.

---

## USER · 2

<sub>2026-11-13 15:44 UTC · [open in full transcript](../full/session-060.md#prompt-2) · record `6ac5ff5b-30a8-4551-a428-8bc1d3185821`</sub>

The AC-5 fix is approved.

1. Update spec 0012 to clarify that multiple rapid filter changes may share one browser history entry, provided no changes are lost and Back/Forward remains correct.
2. Record the potential SearchForm stale-state issue as a deferred follow-up. Do not change SearchForm now.
3. Run a focused review of the new URL ref/updater synchronization, especially Back/Forward and interrupted navigations.
4. If no blocking issues are found, commit and push the fix, confirm CI and deployment, then rerun the failed AC-5 verification against the deployed version.

Keep Feature 13 in-progress until production verification passes.

## CLAUDE · 2

Starting with the spec line and finding where deferred follow-ups live.

*[2 tool calls: Bash ×2]*

Editing the spec (AC-5 sentence plus a follow up), and adding the SearchForm item to the Deferred list in scope.md.

*[4 tool calls: Bash ×2, Edit ×2]*

That last command had a muddled stash step. Checking the file is intact, then proving the new interrupted test fails without the `location.key` dependency.

*[2 tool calls: Bash ×2]*

All green. Committing (code and docs separately, matching the repo's history) and pushing to `main`.

*[1 tool call: Bash]*

Pushed. Waiting on CI.

*[2 tool calls: Bash ×2]*

CI passed on `24aa737` (server, checkout-concurrency, client). Checking the Vercel production deploy for that commit.

*[3 tool calls: ToolSearch, Bash, mcp__claude_ai_Vercel__list_deployments]*

The Vercel connector lacks access to this team scope. Instead of asking you to authorize it, I'll use the deploy status Vercel posts to GitHub for the commit.

*[1 tool call: Bash]*

Vercel reports success for `24aa737`. Now the AC-5 verification against production, in a real browser. Render Free may be asleep, so the first load can be slow. I'll keep the request count modest.

*[1 tool call: mcp__playwright__browser_run_code_unsafe]*

Enter then Tab pushed once in 8 of 8 production runs, and the no ops pushed nothing. To tie this to the new commit, I'll build `main` locally with the production API URL and compare the bundle hash.

*[1 tool call: Bash]*

The hash matches production (`index-q5FvwIab.js`), so production is serving this fix. I'll also rerun the other three AC-5 lines on production as a regression check.

*[2 tool calls: mcp__playwright__browser_run_code_unsafe ×2]*

Render looks slow or busy. Checking whether this is a cold start or a 429 from my earlier runs before retrying.

*[2 tool calls: Bash, mcp__playwright__browser_run_code_unsafe]*

All URLs are right, but my checkbox read came back `undefined` (the label markup is not what my selector expected). Rereading UI 2 with role queries.

*[2 tool calls: mcp__playwright__browser_run_code_unsafe ×2]*

Render is flapping: the page load failed, but a direct fetch a moment later returned 200. That fits a post deploy instance swap. Waiting 45 seconds, then one retry.

*[1 tool call: mcp__playwright__browser_run_code_unsafe]*

I fixed the AC-5 race, committed and pushed it, and CI and the Vercel deploy both passed. I then reran all four AC-5 checks against the deployed site in a real browser, and they all pass.

**Spec and follow up**
- **Spec 0012, AC-5:** a new sentence says each change builds on the latest URL. Rapid changes may share one history entry, as long as no change is lost and Back and Forward still land on a correct state.
- **SearchForm:** recorded as deferred, both in the spec's Follow-up list and in the Deferred section of `scope.md`. I did not change `SearchForm`.

**Review of the ref and updater sync**
- **Rapid changes and Back/Forward:** both are correct. Each change updates the ref before it navigates, and the ref re-syncs from the URL after every page update.
- **Interrupted navigations (one gap, now fixed):** if another navigation to the *same* URL cancelled one of ours, the ref kept the cancelled target. That broke later checks for "no change, no new entry". The fix also resets the ref whenever `location.key` changes. Two new tests cover it: one for a change after Back, one for an interrupted change. The interrupted test fails without the `location.key` fix and passes with it.
- **Edge case, not a blocker:** if a change lands between Back and the next render, it builds on the state still on screen, which is what the visitor sees.
- **Checks:** all 342 client tests, format, lint, typecheck and the build pass.

**Commit, CI, deploy**
- `767faaf` is the fix and `24aa737` is the docs. Both are pushed to `main`.
- **CI:** the server, checkout-concurrency and client jobs passed on `24aa737`.
- **Vercel:** the Vercel connector has no access to your team, so I used the status Vercel posts to GitHub instead, which shows success. The live bundle `index-q5FvwIab.js` has the same hash as a local build of `main` pointed at the production API, so production runs this fix.

**AC-5 checks on the deployed site**

| verify.md line | Result |
|---|---|
| UI 1: messy store link is cleaned up | Becomes `?platform=steam,xbox`, and Back does not return to the old URL |
| UI 2: Steam, Xbox, back, forward | Back shows only Steam ticked, Forward shows both |
| UI 3: the one that failed before | Enter then Tab: one entry in 8 of 8 runs. Same price and current sort: no entry |
| UI 4: page reset and Next | A tick on page 2 drops `page`. Next keeps `sort` and scrolls to the top |

- **Render after the deploy:** the API failed for about a minute right after the push. Requests from the browser were blocked (CORS errors) and the page said "Could not reach the server". It worked normally after a short wait. This looks like Render restarting after the deploy, but I couldn't confirm it from Render itself.

I did not tick anything in `verify.md`. Feature 13 stays in progress, since its AC-11 milestone and the rest of verification are still open.
