# Session 029: (untitled) “/architect”

- Session ID: `5d1f02ad-34fe-4a9f-80d1-e465cc3c0c64`
- Source: `5d1f02ad-34fe-4a9f-80d1-e465cc3c0c64.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-12 17:44 UTC → 2026-11-12 18:13 UTC
- Prompts: 1
- Full technical transcript: [full/session-029.md](../full/session-029.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-12 17:45 UTC · [open in full transcript](../full/session-029.md#prompt-1) · record `8231f113-0292-4bba-b8d8-255028746f11`</sub>

`/architect`

authentication

## CLAUDE · 1

I'll start the pre-flight checks.

*[3 tool calls: Bash ×2, Read]*

Pre-flight is clean (0 commits behind, no overlapping auth spec). Next I'm checking what specs 0001 and 0002 already decided about auth, users, and the guest cart.

*[1 tool call: Bash]*

Spec 0001 already settles the core mechanism (Sanctum Bearer tokens, 7 day expiry, localStorage mirror, clear on 401). Now the user and cart model.

*[1 tool call: Bash]*

**Claude asked — Methods** (select one):

> Which sign in methods should the first version support?
> - **Email + password only (recommended)** — Covers the assignment, needs no third party setup or secrets, and fits the 3 to 4 day budget.
> - **Email + password plus Google sign in** — Closer to real Eneba, but needs OAuth (sign in through Google) setup, Socialite, callback URLs per environment, and more to test.
> - **Magic link (emailed sign in link)** — No passwords, but needs real email delivery. Today MAIL_MAILER=log, so it would not work on the public deploy.

**USER answered:**

Email + password only (recommended)

**Claude asked — Register** (select one):

> Which fields should registration ask for?
> - **Name, email, password (recommended)** — Matches the existing users table (name is required). No confirm field; a show password toggle covers typos.
> - **Name, email, password, confirm password** — The classic Laravel `confirmed` rule. One more field to fill and test.
> - **Email and password only** — Shortest form, but users.name is NOT NULL, so you would need a migration or a name derived from the email.

**USER answered:**

Name, email, password (recommended)

**Claude asked — After signup** (select one):

> What happens right after a successful registration?
> - **Signed in at once, return to the intended page (recommended)** — The register call returns { token, user } (spec 0001 contract), so no second step. Best for the purchase journey.
> - **Send them to the sign in page** — An extra step for the buyer, with no security benefit since there's no email verification.

**USER answered:**

Signed in at once, return to the intended page (recommended)

**Claude asked — Reset/verify** (select one):

> Should password reset or email verification be part of this feature?
> - **Neither, list both as Deferred (recommended)** — Both need real email delivery (today MAIL_MAILER=log). Out of the assignment's core path, and easy to justify in the README.
> - **Password reset, with the email going to the log** — Laravel's built in broker. It works locally, but a reviewer can't use it on the public deploy.
> - **Both, with a real mail provider** — Adds a provider, secrets, and a day of work.

**USER answered:**

Neither, list both as Deferred (recommended)

*[1 tool call: Bash]*

The header and footer already link to `/login`, so the route name is settled. Next round: screens and flow.

**Claude asked — Screens** (select one):

> How should the sign in and register screens be laid out?
> - **Two pages, /login and /register, linked to each other (recommended)** — Matches the existing header link, each URL can be shared and bookmarked, and each page has a clear single h1. Simple to guard and test.
> - **One /login page with Sign in / Register tabs** — Similar to Eneba's own auth screen, but the tab state needs URL sync and ARIA tab handling.
> - **Modal dialog over the current page** — Keeps context, but focus trapping, deep links, and redirect from protected pages all get harder.

**USER answered:**

One /login page with Sign in / Register tabs

**Claude asked — Return to** (select one):

> How should 'return to where you were' be carried through sign in?
> - **?redirectTo= query param, same origin paths only (recommended)** — Survives a reload and the login to register switch. Only relative paths starting with a single '/' are accepted, which blocks open redirects.
> - **Router location state** — Invisible in the URL, but lost on reload or when the user follows the link to register.

**USER answered:**

?redirectTo= query param, same origin paths only (recommended)

**Claude asked — Header** (select one):

> What should the header show once someone is signed in?
> - **Account menu button with name, 'My orders' and 'Sign out' (recommended)** — A small disclosure menu, operable by keyboard. 'My orders' points at the route feature 12 will build (it falls through to 404 until then).
> - **Just the name and a separate Sign out button** — No menu to build, but it crowds the mobile header.
> - **Account icon linking to an /account page** — Needs a whole extra page this feature doesn't otherwise need.

**USER answered:**

Account menu button with name, 'My orders' and 'Sign out' (recommended)

**Claude asked — Cart merge** (select one):

> Does merging the guest cart into the account on sign in belong to this feature?
> - **No, feature 9 (Cart) owns the merge (recommended)** — There's no guest cart yet. Auth only exposes a single 'after sign in' point that Cart will hook into later, so nothing is built twice.
> - **Yes, build the merge endpoint here** — It would mean designing cart rules (caps, stock, unknown offers) before the cart exists.

**USER answered:**

No, feature 9 (Cart) owns the merge (recommended)

You picked tabs, so here's a follow up on how they work, plus the rules.

**Claude asked — Tab model** (select one):

> How should the Sign in / Register tabs on the auth page work?
> - **Two routes (/login, /register), one page, tabs are links (recommended)** — Each tab is a NavLink with aria-current that carries ?redirectTo along. The URL always says which form is showing, Back works, and there's no ARIA tablist to get wrong. The h1 changes per tab.
> - **One route, /login?mode=register, real ARIA tabs** — True tablist semantics (arrow key navigation, aria-selected, tabpanel). More code and tests for the same result.
> - **One route, tab state held only in React** — Simplest code, but a reload or a shared link always lands on Sign in.

**USER answered:**

Two routes (/login, /register), one page, tabs are links (recommended)

**Claude asked — Password** (select one):

> What password rule should registration enforce?
> - **At least 8 characters, max 72, nothing else (recommended)** — Laravel's Password::min(8) plus max:72 (bcrypt ignores bytes past 72). Follows current NIST guidance: length over composition rules.
> - **8+ with mixed case, numbers and symbols** — Annoying for reviewers testing the flow, and not more secure according to NIST.
> - **8+ plus a breached password check (uncompromised)** — Calls the Have I Been Pwned API on every registration: an external dependency and an extra failure point.

**USER answered:**

At least 8 characters, max 72, nothing else (recommended)

**Claude asked — Email** (select one):

> How should emails be normalised before they're stored and compared?
> - **Trim and lowercase on register and login (recommended)** — Stops 'Bob@x.com' and 'bob@x.com' becoming two accounts. The existing unique index then works as is, with no migration.
> - **Store as typed, case insensitive unique index** — Needs a new functional index migration on lower(email), and every lookup must use lower().
> - **Store and compare exactly as typed** — Users get 'wrong credentials' if they capitalise differently. Allows duplicate accounts.

**USER answered:**

Trim and lowercase on register and login (recommended)

**Claude asked — Bad login** (select one):

> What error should a wrong email or password produce?
> - **422 with one generic message on the email field (recommended)** — Laravel's convention (auth.failed: 'These credentials do not match our records.'). It doesn't reveal which part was wrong, and the existing TextField shows it inline.
> - **401 with a form level alert** — Collides with the global 'any 401 clears the token' rule from spec 0001, so the client would need a special case.

**USER answered:**

422 with one generic message on the email field (recommended)

Next is the data model. Two tables are involved: the existing `users` and Sanctum's `personal_access_tokens`. A few choices shape them.

**Claude asked — Name** (select one):

> What limits should apply to the name field?
> - **Required, trimmed, 1 to 60 characters (recommended)** — Short enough to fit in the header menu on mobile. The column stays varchar(255), so no migration is needed.
> - **Required, up to 255 characters** — Matches the column exactly, but a very long name breaks the header layout.

**USER answered:**

Required, trimmed, 1 to 60 characters (recommended)

**Claude asked — Tokens** (select one):

> When the same user signs in again, what happens to their older tokens?
> - **Keep them: one token per sign in, many devices allowed (recommended)** — Phone and laptop both stay signed in. Logout revokes only the current token (spec 0001). Each token still expires after 7 days.
> - **Revoke all older tokens on every sign in** — Only one session at a time. Signing in on the phone silently signs out the laptop.

**USER answered:**

Keep them: one token per sign in, many devices allowed (recommended)

**Claude asked — Cleanup** (select one):

> How should expired token rows get cleaned up?
> - **Not at all for now, note it as a follow up (recommended)** — Expired tokens are already rejected. Render's free plan has no cron, and at demo scale the table stays tiny.
> - **Delete the user's expired tokens on each successful login** — A cheap inline cleanup in the login action, at the cost of one extra query per login.
> - **Schedule sanctum:prune-expired** — Needs a scheduler process, which this deploy doesn't run.

**USER answered:**

Not at all for now, note it as a follow up (recommended)

**Claude asked — Token name** (select one):

> What should the token's name (Sanctum's required label) be?
> - **A fixed 'spa' label (recommended)** — No device management UI exists, so a richer label has no reader. And it doesn't store user agent data.
> - **The browser's user agent, truncated** — Useful for a future 'your devices' list, but it's personal data stored with no current use.

**USER answered:**

A fixed 'spa' label (recommended)

**Claude asked — Data model** (select one):

> Does this data model match what you want?
> - **This matches what I described (recommended)** — users unchanged, plus Sanctum's personal_access_tokens table from its published migration.
> - **Change/add/remove a field or entity** — For example, drop the unused sessions table or add a column.
> - **A relationship is wrong** — Tell me which one.

**USER answered:**

This matches what I described (recommended)

The model is confirmed. Next I'm checking which Sanctum version fits Laravel 13 before the stack round.

*[1 tool call: Bash]*

Sanctum v4.4.0 supports Laravel 13 (it requires `illuminate/* ^12|^13`). Now the stack and tool round.

**Claude asked — Install** (select one):

> How should Sanctum be installed on the server?
> - **composer require laravel/sanctum:^4.4 + publish config and migration (recommended)** — Touches only what you need. The existing routes/api.php and the api/v1 prefix in bootstrap/app.php stay untouched.
> - **php artisan install:api** — Laravel's one shot installer. It also tries to create routes/api.php and wire bootstrap/app.php, both of which already exist and are customised.

**USER answered:**

composer require laravel/sanctum:^4.4 + publish config and migration (recommended)

**Claude asked — Forms** (select one):

> How should the client handle the sign in and register forms?
> - **React Router route actions + <Form>, server is the validator (recommended)** — Data mode is already in use. The action calls the API and returns the 422 errors, which the existing TextField shows. No new dependency.
> - **TanStack Query useMutation + controlled inputs** — Also no new dependency, but form state is hand rolled and the code doesn't follow the router's data mode pattern.
> - **react-hook-form + zod** — On your ask first list. It duplicates server rules on the client for two small forms.

**USER answered:**

```
React Router route actions + <Form>, server is the validator (recommended)
```

**Claude asked — Auth state** (select one):

> Where should the signed in state live on the client?
> - **Token module (memory + localStorage) + TanStack Query ['me'] query (recommended)** — Matches spec 0001 ('TanStack Query for the user'). Login seeds the cache with setQueryData. A 401 clears the token and the cache in one place.
> - **A React AuthContext holding user and token** — Familiar, but it runs parallel to the Query cache, and loaders can't read context.

**USER answered:**

Token module (memory + localStorage) + TanStack Query ['me'] query (recommended)

**Claude asked — Guard** (select one):

> How should protected routes (checkout, orders) be guarded?
> - **A requireAuth() helper called in route loaders (recommended)** — Redirects to /login?redirectTo=<path> before the page renders, so there's no flash of protected content. The data mode way.
> - **A <RequireAuth> wrapper component** — Works, but the page's loaders still run first and may fire API calls that get a 401.

**USER answered:**

A requireAuth() helper called in route loaders (recommended)

Sanctum is a new tool, so I'm reading the skill discovery step before going on.

*[1 tool call: Read]*

**Claude asked — Agent skills** (select one):

> Want me to find Agent Skills and MCP servers for this stack (Laravel Sanctum)?
> - **No, skip it (recommended here)** — Sanctum's token API is small, and laravel-best-practices already covers auth patterns. I'll record the decline so nothing offers it again.
> - **Yes, find them for me** — I'll search the registry for Sanctum in the background and show you what I find. Nothing installs without your pick.
> - **I'll name the ones I want** — Tell me which skills or servers, and I'll add exactly those. No searching.
> - **Not now, later** — I'll note it in the spec's Follow-up.

**USER answered:**

No, skip it (recommended here)

**Claude asked — References** (select one):

> Add a References section to the spec (where the recommendations come from, and optionally links)? The full reasoning (the Rationale) stays either way.
> - **No references, keep it clean (recommended)** — Rationale stays. No extra section.
> - **Sources only (named sources, no web fetch)** — Names the Laravel/Sanctum docs, NIST 800-63B, OWASP, with no URLs fetched.
> - **Sources plus web verified links** — Fetches pages to confirm the links. Costs some extra tokens.

**USER answered:**

No references, keep it clean (recommended)

**Claude asked — Login limit** (select one):

> How should sign in attempts be rate limited?
> - **5 per minute per email+IP, plus 20 per minute per IP (recommended)** — Laravel's usual login throttle. It slows password guessing on one account and spraying from one IP. A 429 shows 'Too many attempts, try again in N seconds'.
> - **10 per minute per IP only** — Simpler, but one attacker IP can still try 10 passwords a minute on any account.
> - **Account lockout after N failures** — Lets anyone lock a victim out of their account (a denial of service on users). Not recommended.

**USER answered:**

5 per minute per email+IP, plus 20 per minute per IP (recommended)

**Claude asked — Signup limit** (select one):

> How should registration be rate limited?
> - **10 per hour per IP (recommended)** — Plenty for a reviewer, and it caps account spam and email probing on the public demo.
> - **Reuse the existing 120 per minute catalog limit** — Effectively no protection for a write endpoint.
> - **No limit** — Open to scripted account creation.

**USER answered:**

10 per hour per IP (recommended)

Next is the API surface.

**Claude asked — Paths** (select one):

> What paths should the auth endpoints use (all under /api/v1)?
> - **/auth/register, /auth/login, /auth/logout, GET /auth/me (recommended)** — Grouped under one prefix, which is easy to throttle and read in logs. 'me' clearly means the current user.
> - **/register, /login, /logout, GET /user** — Laravel's starter kit naming. Flatter, but it mixes with resource routes like /products.

**USER answered:**

/auth/register, /auth/login, /auth/logout, GET /auth/me (recommended)

**Claude asked — Envelope** (select one):

> What JSON shape should login and register return?
> - **{ data: { token, user } } via an API Resource (recommended)** — Follows the project rule (every success response has the { data } wrapper). The token sits beside the user and nothing is special cased in apiFetch.
> - **Bare { token, user }** — Literally what spec 0001 wrote, but it breaks the { data } convention every other endpoint follows.

**USER answered:**

{ data: { token, user } } via an API Resource (recommended)

**Claude asked — User fields** (select one):

> Which user fields should the API expose (in me, login, register)?
> - **id, name, email (recommended)** — Everything the header and future order pages need. No timestamps or verification flags with no reader.
> - **id, name, email, created_at** — Only useful if an account page shows 'member since', and none is planned.

**USER answered:**

id, name, email (recommended)

**Claude asked — Logout** (select one):

> What status should a successful logout return?
> - **204 No Content (recommended)** — Nothing to return. The client ignores the body anyway.
> - **200 with { message: 'Signed out' }** — A message the UI would never show.

**USER answered:**

204 No Content (recommended)

Last round: edge cases and failure handling.

**Claude asked — Boot state** (select one):

> On page load with a stored token, what should the header show while GET /auth/me is still loading (the cold start can take up to a minute)?
> - **A neutral account icon placeholder, no Sign in link (recommended)** — No flash of 'Sign in' for a signed in user. Protected loaders wait for /me, and the existing 'waking up' notice covers slow starts.
> - **Assume signed in until /me says otherwise** — Feels faster, but we don't know the name yet and an expired token flips the header later.
> - **Show 'Sign in' until /me resolves** — Simplest, but signed in users see the wrong state for up to a minute on cold starts.

**USER answered:**

A neutral account icon placeholder, no Sign in link (recommended)

**Claude asked — Logout fail** (select one):

> If the logout request fails (network error, 5xx, cold start timeout), what should happen?
> - **Sign out locally anyway (recommended)** — Clear the token and the cache, then go home. The orphaned token expires within 7 days. The user's intent always wins.
> - **Show an error and stay signed in** — Strictly revokes server side, but leaves the user stuck signed in when the API is down.

**USER answered:**

Sign out locally anyway (recommended)

**Claude asked — 401 mid-use** (select one):

> When any request returns 401 (token expired or revoked) while the user is on a protected page, what should happen?
> - **Clear auth and redirect to /login?redirectTo=<current page> with a notice (recommended)** — 'Your session expired, please sign in again.' After signing in they land back where they were.
> - **Clear auth and show a toast only** — The user stays on a page that can't load its data.

**USER answered:**

```
Clear auth and redirect to /login?redirectTo=<current page> with a notice (recommended)
```

**Claude asked — Multi tab** (select one):

> Should other open tabs react when the user signs in or out in one tab?
> - **Yes, sync via the storage event (recommended)** — A few lines. Another tab clears or adopts the token and refetches /me, so there's no stale 'signed in' header after logging out elsewhere.
> - **No, each tab catches up on its next 401** — Less code, but a tab can show a signed in header after sign out until its next API call.

**USER answered:**

Yes, sync via the storage event (recommended)

**Claude asked — Guard proof** (select one):

> Which route should prove the guard works in this feature, before checkout and orders exist?
> - **Guard /orders now with a placeholder page (recommended)** — 'My orders' in the header menu stops being a 404. Feature 12 replaces the placeholder body and keeps the guard. A real route, testable end to end.
> - **Guard a minimal /account page (name + email)** — A real page, but it's a new page outside the scope.
> - **Unit test requireAuth only, no live route** — No extra UI, but /check verify can't prove 'redirect and return' in the browser.

**USER answered:**

Guard /orders now with a placeholder page (recommended)

That covers every dimension. Now I'm loading the spec writing guidance.

*[2 tool calls: Bash, Read]*

Before writing, I'm reading the integration points: the API client, the router, the CORS config, and how spec 0005 is shaped.

*[5 tool calls: Bash ×5]*

Writing the spec now: `docs/specs/0006-authentication/` (`index.md` plus `rationale.md`).

*[3 tool calls: Write ×2, Read]*

Self check passed. Every required section is present in `index.md` and `rationale.md`, every AC traces to a build task, and every value in the Value sourcing table names a source.

**Claude asked — Cross check** (select one):

> Cross check this spec before you review it? (Recommended: Another model. This is an Alpha feature, but auth is risky and every later Journey 1 feature depends on it.)
> - **Another model (recommended)** — A read only critique on a different capable model, which catches gaps the model that wrote the spec is blind to. Writes nothing.
> - **Same model** — A read only, fresh eyes critique on this same model.
> - **I'll review it myself** — No AI critique. You read docs/specs/0006-authentication/ yourself.
> - **Skip** — Go straight to accept.

**USER answered:**

Another model (recommended)

*[1 tool call: Agent · 1 subagent]*

The draft is in [docs/specs/0006-authentication/](docs/specs/0006-authentication/index.md), and the cross check on another model is still running. When it reports back, I'll list any gaps it finds, each with the fix I'd recommend, and ask you before changing anything.

_⚙ Automated `peer` message (not written by the developer; content is in the full transcript)._

## CLAUDE · 1 (continued)

The cross check found no flaw in the core design. It did find edge rules I hadn't written down, which `/develop` would otherwise have to make up. Here are the gaps, each with the fix I recommend:

| # | Gap | Recommended fix |
|---|---|---|
| 1 | 401 handler could wipe a fresh token, fire during sign out, or navigate several times at once | Record the token when the request is sent and act only if it still matches. Skip the handler for `/auth/logout`. Make it idempotent (running it twice does nothing extra). |
| 2 | Preview guard could answer 401/429 instead of 403, depending on middleware order | Prepend `BlockPreviewWrites` (run it first) and add a Pest test that a preview POST to `/logout` gets 403. Rationale states it guards browsers only and is not a security boundary. |
| 3 | `Retry-After` parsing is undefined | Use `max(1, parsed)`, fall back to 60 when the header is missing, and word it "1 second" / "N seconds". |
| 4 | `['me']` query options are unstated, so a background refetch would break "no extra `/me` call" | `staleTime: Infinity`, `enabled` only when a token exists, and a 401 is never retried (already true). |
| 5 | The header can't see token changes (it reads a plain module) | The token store exposes `subscribe` and `getSnapshot`, and the header reads it with `useSyncExternalStore` (React's hook for outside state). |
| 6 | Second tab behaviour is unclear | On a new token, clear and refetch `['me']` but don't run `afterSignIn`, so the cart merge never runs twice. On a removed token, a protected page goes to `/login?redirectTo=…` without `reason=expired`. |
| 7 | Redirect loop risk with a stale token on `/login`, and a double redirect in `requireAuth` | `redirectIfSignedIn` redirects only when `['me']` is already cached. `requireAuth` awaits `/me` and does its own redirect on a 401 (handler suppressed). |
| 8 | `redirectTo` encoding is unsafe for tricks like `/\t/evil.com` | Reject backslashes and control characters, parse with `new URL(value, origin)`, require the same origin, keep path plus search, and add those cases to the test table. |
| 9 | Login limiter details | The limiter trims and lowercases the email itself (it runs before the Form Request) and never errors on a missing or array email. Successful logins count toward the limit. `auth:sanctum` runs before `throttle:account`. |
| 10 | A 422 error for a field the form doesn't show (for example `password` on login) is lost | Show it in the form alert. |
| 11 | Small UI values | Long names are truncated with the full name as the accessible name. The placeholder is labelled "Loading account". The toast reuses the existing `Toast`. Sign out uses `navigate('/')`. The placeholder text is "Your orders will appear here." |
| 12 | Two technical notes | Drop the `redirectGuestsTo` hedge, since Laravel 13 already returns 401 JSON for `api/*` (keep the test). Catch the duplicate email error outside any DB transaction. |

**Claude asked — Gaps** (select one):

> The cross check found 12 gaps in spec 0006 (401 handler races, preview guard order, the me query settings, second tab sync, redirect loop and encoding, limiter details, small UI values). How should I proceed?
> - **Apply the recommended fixes (recommended)** — I edit index.md (ACs, invariants, value sourcing, tests, build plan) with exactly the fixes listed in the table, then show you the accept panel.
> - **Let me answer each one** — I walk you through the gaps one by one.
> - **Leave them, I'll decide later** — I add them to Follow-up, and /develop will stop on them.

**USER answered:**

Apply the recommended fixes (recommended)

You chose to apply the fixes, so I'm editing the spec now.

*[13 tool calls: Edit ×13]*

**Claude asked — spec** (select one):

> Accept spec 0006 (authentication), or change it?
> - **Accept, looks solid (recommended)** — Status stays Proposed (/develop advances it). I'll then link it on the scope and add the build milestones.
> - **Change something, I'll tell you what** — Targeted edits to the sections you name.
> - **Rethink the approach** — Revisit a stage or the options.

**USER answered:**

Accept, looks solid (recommended)

You accepted it, so I'm updating feature 7 on the scope (in `docs/scope/scope.md`): spec link, milestones, Verify box, status `in-progress`.

*[1 tool call: Bash]*

Spec 0006 is accepted and linked on the scope. Its status stays `Proposed` until `/develop` builds it.

- **What we decided:** email and password accounts using Laravel Sanctum Bearer tokens. There's one auth page with Sign in and Register tabs, an account menu in the header, and `/orders` is the first protected page (a placeholder for now).
- **Why:** it builds on what spec 0001 already chose (Sanctum, React Router loaders, TanStack Query) and adds no new services or environment variables. The cross check's 12 fixes close the races and redirect loop risks before you start building.
- **New scope items:**
  - Feature 7 is now `in-progress`, with 4 build milestones and a Verify box.
  - "Password reset & email verification" went onto the Deferred list.
- **Flagged for `/sync`:**
  - Spec 0001's `{ token, user }` response line is now stale: this spec returns `{ data: { token, user } }`.
  - `AGENTS.md` should record Sanctum as installed once it's built, plus the declined Sanctum Agent Skill.
- **Not committed:** the changes are `docs/specs/0006-authentication/` and `docs/scope/scope.md`. Commit them whenever you like.
- **What's next:** you could run `/clear` to start a fresh session (it reads the spec from disk), then `/develop authentication`.
