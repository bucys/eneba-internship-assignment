# Session 079: Cyberpunk featured artwork CSP fix

- Session ID: `d6042c35-c1fc-40d8-afe5-4d3aecad7902`
- Source: `d6042c35-c1fc-40d8-afe5-4d3aecad7902.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-14 22:52 UTC → 2026-11-14 22:57 UTC
- Prompts: 2
- Full technical transcript: [full/session-079.md](../full/session-079.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-14 22:52 UTC · [open in full transcript](../full/session-079.md#prompt-1) · record `4cb176d7-c85a-4a52-b78f-9541ff648271`</sub>

Investigate and fix the production CSP blocking the Cyberpunk featured artwork.

Evidence:
- The image URL on Render returns HTTP 200 and image/webp.
- The production /api/v1/home/banners endpoint returns the correct Render image_url.
- Browser console reports an img-src Content Security Policy violation.

Tasks:
1. Locate the effective frontend CSP configuration (Vercel headers, vercel.json, HTML meta tags or other sources).
2. Identify the exact blocked image origin and why the current img-src policy rejects it.
3. Apply the smallest secure fix, allowing the required image origin without using wildcard or unsafe-inline.
4. Add a focused regression check if practical.
5. Run relevant frontend checks.

Do not change HomeSeeder, database records, unrelated CSP directives or backend code.

Do not commit or deploy. Report the root cause, exact changes and verification results.

## CLAUDE · 1

*[5 tool calls: Bash ×5]*

Confirmed: blocked origin is `https://eneba-api.onrender.com` (Cyberpunk banner served from the API's `public/images`), absent from `img-src`. Checking test setup to decide on a regression check.

*[2 tool calls: Bash ×2]*

Now the full frontend checks plus a production-style build to inspect the emitted meta tag.

*[3 tool calls: Bash ×3]*

I've fixed it locally: the build now adds the Render API origin to the CSP `img-src`. Nothing is committed or deployed. All frontend checks pass, and a production-style build emits the corrected policy.

**Root cause**
- The effective policy is the `<meta http-equiv="Content-Security-Policy">` tag that the build plugin in [vite.config.ts](client/vite.config.ts) writes into `index.html`. [vercel.json](client/vercel.json) only sends the `frame-ancestors 'none'` header and plays no part in this.
- The live production policy was `img-src 'self' https://shared.steamstatic.com`.
- The blocked origin is `https://eneba-api.onrender.com`. The banner `image_url` points to `https://eneba-api.onrender.com/images/banners/cyberpunk-2077-featured.webp`, because Laravel's `url()` builds it on the API host. The other banners use `shared.steamstatic.com`, which was already allowed, so only Cyberpunk broke.

**Changes**
- In [vite.config.ts:30](client/vite.config.ts#L30), `img-src` now reads `'self' https://shared.steamstatic.com ${apiOrigin}`. `apiOrigin` is the variable that already feeds `connect-src`, so the image origin comes from `VITE_API_URL` and isn't hardcoded. There's no wildcard and no `unsafe-*`, and no other directive changed.
- `contentSecurityPolicy` is now exported so it can be tested, and I added a one-line comment explaining why `img-src` includes the API origin.
- New test file [vite.config.test.ts](client/vite.config.test.ts):
  - One test checks that `img-src` is exactly `'self'`, steamstatic and the API origin, with any path removed from the URL.
  - The other checks that `connect-src` is unchanged.

**Verification**
- `format:check`, `lint` and `typecheck` all pass, and `npm test` passes all 430 tests in 46 files.
- Building with `VITE_API_URL=https://eneba-api.onrender.com` produces `img-src 'self' https://shared.steamstatic.com https://eneba-api.onrender.com` in `dist/index.html`.
- With the fix removed, both new tests fail. That's partly because the plugin isn't exported without the change, so the failure doesn't isolate the `img-src` change on its own.
- I haven't checked it in a browser: the live site will only show the image once you redeploy.

One follow-up: spec 0006 ([index.md:148](docs/specs/0006-authentication/index.md#L148)) still lists the old `img-src`, so it needs a one-line update. I left it alone because docs were outside this task.

---

## USER · 2

<sub>2026-11-14 22:54 UTC · [open in full transcript](../full/session-079.md#prompt-2) · record `528d364b-9483-464d-a6f5-1ac61eb40d76`</sub>

Finalize the Cyberpunk artwork CSP production fix.

1. Update only the outdated img-src description in spec 0006 to reflect that the API origin from VITE_API_URL is allowed alongside 'self' and shared.steamstatic.com.
2. Keep the existing vite.config.ts fix and focused tests.
3. Run git diff --check and review the staged files.
4. Commit with:
   fix(client): allow API-hosted images in CSP
5. Push to main and verify all three CI jobs pass.

Do not change unrelated code, seed data, or CSP directives.

Report commit hash, CI results and whether Vercel deployed successfully. Do not run another HomeSeeder.

## CLAUDE · 2

*[1 tool call: Bash]*

Staged diff is clean and limited to the three files. Committing and pushing.

*[3 tool calls: Bash ×3]*

Vercel deployed and the live CSP is updated. A quick browser check of the banner itself:

*[4 tool calls: ToolSearch, mcp__playwright__browser_navigate, mcp__playwright__browser_evaluate, mcp__playwright__browser_console_messages]*

No `<img>` from Render on the page yet. Checking whether the banner uses a CSS background or hasn't loaded.

*[2 tool calls: mcp__playwright__browser_evaluate ×2]*

The fix is committed, pushed to `main`, all three CI jobs passed, and Vercel deployed it. The Cyberpunk artwork now loads on the live site.

**Commit:** `97ef0a28f787c3573959eb7e7358c451fd0dff12`, message `fix(client): allow API-hosted images in CSP`

**What it contains**
- `docs/specs/0006-authentication/index.md`: only the `img-src` description changed, to `img-src 'self' https://shared.steamstatic.com <origin of VITE_API_URL>`.
- `client/vite.config.ts` and `client/vite.config.test.ts` are the fix and tests from before, unchanged.
- `git diff --check` found no problems, and I reviewed the staged files: just those three, 44 lines added and 3 removed.

**CI (run 43650500259):** passed overall.
- server: passed
- client: passed
- checkout-concurrency: passed

**Vercel:** the deploy finished with status "success".
- The live page's `img-src` is now `'self' https://shared.steamstatic.com https://eneba-api.onrender.com`.
- In a headless browser on the live site, `cyberpunk-2077-featured.webp` loaded at full size (2172×724) with no console errors.

I didn't run HomeSeeder, and no other code, seed data or CSP directives changed.

One thing I noticed: that banner image has an empty `alt`. That's fine if it's decorative, but give it text if it should be announced to screen readers. I left it alone because it was outside this fix.
