# 0006. Authentication: Sanctum Bearer tokens, one auth page with tabs, loader guards

**Date**: 2026-11-12
**Status**: Accepted

## Summary

You add email and password accounts. Laravel Sanctum (Laravel's official API token package) issues a Bearer token on register and login. The React app keeps that token in memory and in `localStorage`, and asks `GET /auth/me` who is signed in. Visitors use one auth page with two tabs, **Sign in** (`/login`) and **Register** (`/register`). Protected pages redirect to it and send the user back afterward, and `/orders` becomes the first guarded route (a placeholder that feature 12 fills in). The spec also covers rate limits, the read only guard for preview deployments, and how the app reacts to an expired token, a failed sign out, or a second open tab. That means checkout, orders, and the cart merge can rely on one tested sign in.

## Requirements

**User stories**:
- As a visitor, I want to create an account with my name, email, and password so that I can buy keys and find them again later.
- As a returning buyer, I want to sign in and stay signed in across reloads for a week so that I don't retype my password on every visit.
- As a buyer sent to sign in from a protected page, I want to land back on that page afterward so that I don't lose my place in the purchase.
- As a signed in buyer, I want to see my name in the header and sign out from any page.
- As the site owner, I want password guessing and account spam slowed down, and preview deployments kept read only.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: `POST /api/v1/auth/register` with a valid `name`, `email`, and `password` returns **201** `{ data: { token, user: { id, name, email } } }`. The stored email is trimmed and lowercased, the password is stored as a bcrypt hash (never plain text), and exactly one `personal_access_tokens` row exists for the user, named `spa`, with `expires_at` 7 days from now.
- **AC-2**: Register returns **422** with a field error under `errors.<field>` for each of these: a missing or blank `name`; a `name` over 60 characters after trimming; a missing or invalid `email`; an email that is already registered in any letter case (`Bob@X.com` when `bob@x.com` exists); a `password` under 8 characters or over 72 bytes. Two registrations racing with the same email produce one 201 and one 422, never a 500.
- **AC-3**: `POST /api/v1/auth/login` with correct credentials (email in any case, with surrounding spaces) returns **200** `{ data: { token, user } }` and creates a new `spa` token. The user's older tokens keep working. A wrong password and an unknown email both return **422** with exactly `errors.email = ["These credentials do not match our records."]`, the same body in both cases.
- **AC-4**: `GET /api/v1/auth/me` with a valid Bearer token returns **200** `{ data: { id, name, email } }`. `POST /api/v1/auth/logout` returns **204** and deletes only the token it was called with: that token then gets 401, while the same user's other tokens still work. A missing, malformed, revoked, or expired (older than 7 days) token gets **401** JSON `{ message }` on both endpoints. This also holds when the request has no `Accept: application/json` header (never a 500 or an HTML redirect).
- **AC-5**: Rate limits answer **429** with a `Retry-After` header that the browser can read (CORS `exposed_headers`): the 6th login within one minute for the same email and IP (successful logins count too); the 21st login within one minute from one IP, across any emails; the 11th registration within one hour from one IP; the 61st `me` or `logout` call within one minute for one user. A login request with a missing, non string, or padded uppercase email never makes the limiter fail (`"  Ana@X.com "` and `"ana@x.com"` share one bucket).
- **AC-6**: The `BlockPreviewWrites` middleware returns **403** `{ "message": "Preview deployments are read only." }` for any `api/*` request that is not `GET`, `HEAD`, or `OPTIONS` and whose `Origin` matches `CORS_PREVIEW_ORIGIN_PATTERN`. It runs before throttling and `auth:sanctum`, so a preview POST to `/auth/logout` without a token gets 403, not 401 or 429. Requests from `FRONTEND_URL`, requests with no `Origin`, CORS preflight, and all `GET` requests from previews pass through. A blank pattern blocks nothing.
- **AC-7**: `/login` and `/register` render one auth page with two tabs, **Sign in** and **Register**. The tabs are links: the active one has `aria-current="page"`, and switching tabs keeps `?redirectTo`. The page has exactly one `<h1>` ("Sign in" or "Create account"). Every field has a visible label and the right `autocomplete` (`email`, `current-password`, `name`, `new-password`). Each password field has a show or hide toggle. The page works at 360 px wide and with the keyboard alone.
- **AC-8**: A successful sign in or registration stores the token (memory and `localStorage`), puts the returned user in the `['me']` cache (no extra `/me` call), runs the after sign in hooks, and navigates to the safe `redirectTo` or `/`. Server field errors (422) render inline under the matching field, and focus moves to the first field with an error. An error for a field the form doesn't show (for example `errors.name` on login) goes into the form alert. A 429 shows the form alert "Too many attempts. Try again in N seconds." (N is `Retry-After` with a minimum of 1, or 60 when the header is missing or not a number; "1 second" in the singular). A network error, timeout, 5xx, or 403 shows the form alert with the error's message. While the request runs, the submit button is disabled and shows its loading state. After 3 seconds, the "waking up the server" notice appears. After an error, the typed name and email stay filled in, and the password does not.
- **AC-9**: `redirectTo` is honoured only when it starts with exactly one `/`, contains no backslash and no control or whitespace character, resolves through `new URL(value, window.location.origin)` to the same origin, and its path is not `/login` or `/register`. The result is that URL's path plus search. Anything else (for example `https://evil.com`, `//evil.com`, `/\evil.com`, `/\t/evil.com`, `/%0a/evil.com`, `javascript:alert(1)`, or an empty value) sends the user to `/`. When the app builds a `redirectTo`, it encodes path plus search with `encodeURIComponent` (the hash is dropped).
- **AC-10**: A visitor with no token who opens `/orders` is redirected to `/login?redirectTo=%2Forders` before any of the page renders, and after signing in lands on `/orders`, which shows a placeholder ("My orders" heading, text "Your orders will appear here."). A signed in user (the `['me']` cache holds a user) who opens `/login` or `/register` is redirected to the safe `redirectTo` or `/`. A user whose stored token is not yet confirmed sees the form, so a stale token never causes a redirect loop.
- **AC-11**: After a reload with a valid stored token, the user is still signed in. While `/me` is pending, the header shows a neutral account placeholder (accessible name "Loading account") and no "Sign in" link. If `/me` fails for a reason other than 401 (network error, timeout, 5xx) after the shared retry, the placeholder becomes an account button (accessible name "Account unavailable") that opens a disclosure, like the signed in one, holding "Retry" (refetches `/me`, the token is kept) and "Sign out" (the same local sign out as AC-12, through `signOut()`). The header reacts to token changes made outside React (the 401 handler, other tabs) without a reload. Once signed in, the header shows an account button with the user's name (visually truncated with an ellipsis when long, full name as the accessible name). It opens a disclosure (a button that shows and hides a small panel) holding a "My orders" link (`/orders`) and a "Sign out" button. Enter or Space opens it, Escape closes it and returns focus to the button, and a click outside closes it. It fits the mobile header at 360 px.
- **AC-12**: "Sign out" signs out locally at once, without waiting for the server: it clears the token from memory and `localStorage`, removes every `['me', ...]` query, navigates to `/` (`navigate('/')`), and shows the toast "You're signed out." through the existing toast component. In the background it sends `POST /auth/logout` carrying the token being signed out (passed explicitly, not read from the store), so the server revokes that token. The result of that request is ignored: a failure (network error, timeout, 5xx, or 401) never runs the global 401 handler and never touches a session started after it.
- **AC-13**: When an API response is 401 for a request that carried a token, and that token is still the current one, the app clears the token and every `['me', ...]` query. If the current route is protected, it navigates to `/login?redirectTo=<current path and search>&reason=expired`, and the page shows the alert "Your session expired. Please sign in again." On a public page, the header just switches to "Sign in". A stored token that the server rejects on page load behaves the same way. A 401 that arrives while a navigation to a protected route is running sends the user to sign in once that navigation settles. Several 401s at once clear and navigate only once. A 401 for an older token (replaced since the request was sent) changes nothing.
- **AC-14**: With two tabs open, signing out in one tab switches the other tab's header to "Sign in" (and sends it to `/login?redirectTo=<its path>`, without `reason=expired`, if it is on a protected page). Signing in in one tab makes the other tab adopt the token, drop any cached `['me', ...]` data, refetch `/me`, and show the name. The adopting tab does not run the after sign in hooks.
- **AC-15**: Pint, PHPStan, and Pest pass in `server/`, and Prettier, oxlint, typecheck, Vitest, and the build pass in `client/`, locally and in CI. Pest covers AC-1 to AC-6. Vitest covers `safeRedirect`, the token store, and the 401 handler.

## Decision

**Chosen option**: Option 1: Sanctum tokens on the server, React Router data mode on the client (route actions for the forms, `requireAuth()` in loaders, the user in TanStack Query).

You install `laravel/sanctum` ^4.4 without `install:api`, add four `/api/v1/auth/*` endpoints in the project's controller → Form Request → action → Resource shape, add three rate limiters, the preview write guard, and an exposed `Retry-After` header. On the client you add a small token store, Bearer and 401 handling inside `apiFetch`, one tabbed auth page with route actions, a `requireAuth()` loader helper, an account menu in the header, and a guarded `/orders` placeholder.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

| Table | Change | Columns | Constraints |
|---|---|---|---|
| `users` | none (existing Laravel table) | `id` PK, `name` varchar(255) not null (1 to 60 chars by validation), `email` varchar(255) not null (stored lowercased), `password` (bcrypt hash), `email_verified_at` (unused), `remember_token` (unused), timestamps | unique `email` (exists) |
| `personal_access_tokens` | **new**, Sanctum's published migration, unedited | `id` PK, `tokenable_type` + `tokenable_id` (the owning user), `name` (always `'spa'`), `token` (SHA 256 hash of the secret), `abilities` (Sanctum default `["*"]`), `last_used_at`, `expires_at`, timestamps | unique `token`; index on (`tokenable_type`, `tokenable_id`); confirm the exact columns in the published file at build time |

- Relationship: `users` 1:N `personal_access_tokens`, polymorphic, with no database foreign key. No user delete feature exists, so orphaned tokens can't occur in practice.
- `password_reset_tokens` and `sessions` stay in the schema, unused.
- `User` gains the `HasApiTokens` trait. `#[Hidden]` already hides `password` and `remember_token`.
- Retention: expired tokens stay in the table (they are already rejected). Cleanup is a follow up.

**State transitions** (a token, and the client's view of auth):
- Token: `active` → `revoked` (logout deletes the row) or `expired` (`expires_at` passed; Sanctum rejects it; the row stays).
- Client: `signed out` (no token) → `checking` (token present, `['me']` pending) → `signed in` (`['me']` has a user). `checking` → `signed out` on a 401. `signed in` → `signed out` on sign out, on any 401, or on a storage event that removes the token.

**API surface** (all under `/api/v1`, JSON, Laravel default error shape):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/auth/register` | POST | `name`: string (req, 1 to 60 after trim), `email`: string (req, email, max 255), `password`: string (req, 8 chars to 72 bytes) | 201 `{ data: { token, user: { id, name, email } } }` | public, `throttle:register` | 422 field errors (email taken), 429, 403 preview |
| `/auth/login` | POST | `email`: string (req), `password`: string (req) | 200 `{ data: { token, user } }` | public, `throttle:login` | 422 `errors.email` = `auth.failed`, 429, 403 preview |
| `/auth/me` | GET | Bearer token | 200 `{ data: { id, name, email } }` | `auth:sanctum`, `throttle:account` | 401, 429 |
| `/auth/logout` | POST | Bearer token | 204, empty body | `auth:sanctum`, `throttle:account` | 401, 429, 403 preview |

Server files: `AuthController` (four thin methods), `RegisterRequest`, `LoginRequest` (both lowercase `email` in `prepareForValidation`; the global `TrimStrings` middleware already trims and skips `password`), actions `RegisterUser`, `LoginUser`, `LogoutUser`, resources `UserResource` (`id`, `name`, `email`) and `AuthTokenResource` (`token`, `user` as `UserResource`). Register returns 201 through the resource's response.

Client routes (data mode):

| Route | Loader | Action | Component | `handle` |
|---|---|---|---|---|
| `/login` | `redirectIfSignedIn` | `loginAction` | `AuthPage` (Sign in tab) | none |
| `/register` | `redirectIfSignedIn` | `registerAction` | `AuthPage` (Register tab) | none |
| `/orders` | `requireAuth` | none | `OrdersPlaceholderPage` | `{ requiresAuth: true }` |

Client behaviour details:
- `authToken.ts` exposes `get`, `set`, `clear`, `subscribe`, and `getSnapshot`. React reads it with `useSyncExternalStore`, so the header updates when the 401 handler or another tab changes the token. Only `set` and `clear` write `localStorage`. A `storage` event updates memory and notifies subscribers without writing back, so there is no sync loop.
- `meQueryOptions`: `queryKey: ['me']`, `staleTime: Infinity` (the user changes only through sign in and sign out, which update the cache themselves), `enabled` only when a token exists. Retry uses the shared policy, which never retries a 4xx, so a 401 is not retried.
- `apiFetch` records the token it sent. On a 401 it calls the unauthorized handler with that token. A caller that sets its own `Authorization` header (sign out) handles its own 401, so the handler is not called. The handler does nothing if the token is no longer current or the path is `/auth/logout`; once it has cleared, later 401s carry an old token, so concurrent calls clear and navigate once. While a navigation runs, it waits for the navigation to settle (`router.subscribe`), then redirects only if the token is still missing and the route it landed on is protected.
- `requireAuth()`: no token → `throw redirect('/login?redirectTo=…')`. With a token it awaits `queryClient.ensureQueryData(meQueryOptions)`. On a 401, or on any failure after the token is gone (the 401 handler's `clearAuth` cancels this very query), it clears auth and throws that same redirect with `reason=expired`. Any other error is thrown to the route's error element (`ErrorState` with a retry that calls `revalidate()`).
- `signOut()` in `lib/auth.ts` reads the current token, calls `clearAuth()`, then fires `logout(token)` without awaiting it.
- `redirectIfSignedIn()`: redirects only when `queryClient.getQueryData(['me'])` holds a user; it never calls the API.
- `afterSignIn` hooks run only in the tab that signed in, after the token is stored and before navigation. Storage event adoption skips them.

Client files: `src/lib/authToken.ts` (token store), `src/api/auth.ts` (types plus `register`, `login`, `logout`, `fetchMe`), `src/lib/auth.ts` (`meQueryOptions`, `requireAuth`, `redirectIfSignedIn`, `clearAuth`, `afterSignIn` hook list), `src/lib/safeRedirect.ts`, `src/pages/AuthPage.tsx`, `src/pages/OrdersPlaceholderPage.tsx`, `src/components/layout/AccountMenu.tsx`. Changes to `apiFetch`: it attaches `Authorization: Bearer <token>` when a token exists, adds `retryAfter?: number` to `ApiError` for 429s, and on a 401 for a request that carried a token, calls the handler registered with `setUnauthorizedHandler` (registered in `main.tsx`, which avoids an import cycle between `client.ts` and `router.tsx`).

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| register, login | `token` | `$user->createToken('spa')->plainTextToken` (Sanctum) |
| register, login | token `expires_at` | `config/sanctum.php` `expiration` = 10080 minutes (spec 0001) |
| register, login, me | `user.id`, `user.name`, `user.email` | `users` columns through `UserResource` |
| register | stored email | input `email`, trimmed (global middleware) and lowercased in `RegisterRequest::prepareForValidation` |
| register | password byte length | `strlen($password)` in a closure rule (bytes, not characters, because bcrypt reads only the first 72 bytes) |
| login | "These credentials do not match our records." | `__('auth.failed')` (Laravel's language line) |
| login, register, me, logout | 429 `Retry-After` seconds | Laravel's throttle middleware header, readable via `exposed_headers: ['Retry-After']` in `config/cors.php`, parsed into `ApiError.retryAfter` as `max(1, integer)`, or 60 when missing or not a number |
| rate limiters | the limit key | `login`: one limiter returning two `Limit`s with distinct keys, `'email:'.mb_strtolower(trim(email)).'|'.ip` (the limiter normalises the email itself, because it runs before the Form Request; a non string email becomes `''`) and `'ip:'.ip` (IP set by NGINX, spec 0001); `register`: IP; `account`: `$request->user()->id` (route middleware order `auth:sanctum` before `throttle:account`) |
| preview guard | is this a preview | request `Origin` header matched against `CORS_PREVIEW_ORIGIN_PATTERN` (same `#...#` wrapping as `config/cors.php`) |
| auth page | which tab is active, which `<h1>` | the matched route path (`/login` or `/register`) |
| auth page, guard | post sign in destination | `redirectTo` search param through `safeRedirect()`, default `/` |
| auth page | session expired alert | `reason=expired` search param, set only by the 401 handler |
| auth actions | field error under each input | `ApiError.errors` from the 422 body |
| header | the user's name | `['me']` query data (seeded by login and register via `setQueryData`, else fetched by `fetchMe`) |
| header | `checking` placeholder vs "Sign in" link | token present (`authToken.get()`) and `['me']` pending |
| 401 handler | is the current route protected | `router.state.matches` has a route with `handle.requiresAuth === true` |
| 401 handler | the `redirectTo` value | `encodeURIComponent(router.state.location.pathname + search)` |
| 401 handler | whether to act | the token `apiFetch` sent equals `authToken.get()`, and the path is not `/auth/logout` |
| auth actions | errors for fields the form lacks | keys of `ApiError.errors` with no matching input → form alert |
| header | account button text and accessible name | `['me']` `name`, CSS truncation; the placeholder's name is the constant "Loading account" |
| `/orders` placeholder | heading and text | constants "My orders" and "Your orders will appear here." |
| other tabs | new or removed token | `window` `storage` event for key `eneba.auth_token` |
| sign out | toast text | constant "You're signed out." |

**Key invariants**:
- An email exists at most once, compared lowercased: normalisation on write plus the existing unique index. A racing duplicate insert (`UniqueConstraintViolationException`) becomes the same 422 as the validation rule. It is caught around a plain `User::create`, not inside a `DB::transaction`, because Postgres aborts the whole transaction after the violation.
- The plain text token is returned once, in the register or login response, and is never logged. The database stores only its hash.
- Wrong password and unknown email are indistinguishable in status and body.
- Logout deletes only `currentAccessToken()`.
- A token older than 7 days is never accepted.
- The client sends the token only to `${env.apiUrl}`. `apiFetch` is the only reader of the token outside `authToken.ts` and `auth.ts`.
- Every user scoped TanStack Query key starts with `'me'` (`['me']`, later `['me', 'cart']`, `['me', 'orders']`), so `removeQueries({ queryKey: ['me'] })` clears all of a user's cached data at once. Features 9 and 12 follow this.
- `redirectTo` never sends the user off this origin, and never back to the auth pages.
- `localStorage` access is wrapped in try and catch. If storage is blocked (private mode), the token lives in memory only and the app still works for that tab.
- Laravel's API stays stateless: no `statefulApi()`, no cookies, `supports_credentials` stays false (spec 0001).

**Security model**:
- Public: register and login, each throttled. Authenticated (`auth:sanctum`): `me` and `logout`, scoped to the token's own user. No roles: every account is a buyer. There is no admin in scope.
- No endpoint takes a user id, so one user can't act on another's account. Future user owned data (cart, orders) is scoped by `$request->user()`, as spec 0002 says.
- Passwords: bcrypt via the `hashed` cast; 8 characters up to 72 bytes; no composition rules (NIST 800-63B style). No account lockout, since that would let anyone lock a victim out. The throttles do the slowing down.
- Token in `localStorage` is readable by injected script (XSS). This is accepted in spec 0001. Mitigations: React escapes output, the code never uses `dangerouslySetInnerHTML` with API data, a Content Security Policy blocks inline and third party scripts and limits `connect-src` to the API origin, tokens expire after 7 days, and logout revokes.
- Sanctum's `guard` is `[]`: requests authenticate by Bearer token only, never by session or remember me cookie.
- Account enumeration through register ("email already taken") is accepted. It's the standard UX, and the 10 per hour limit caps probing. Login does not leak it.
- Personal data: name and email only. Nothing is logged beyond Laravel defaults. Request bodies (passwords) are never logged.
- Previews: `BlockPreviewWrites` makes register, login, and logout return 403 from preview origins, so previews can't sign in. This is accepted in spec 0001; test auth locally or on production. It checks only the `Origin` header, so it stops accidental writes from a preview page in a browser. It is **not** a security boundary: any script or tool can send a request without that header. It is prepended to the `api` group so it runs before throttling and auth.

**Configuration required**:
- No new environment variables. `config/sanctum.php` sets `expiration` to `10080` and `guard` to `[]`.
- CSP: a build only plugin in `client/vite.config.ts` puts a `<meta http-equiv="Content-Security-Policy">` in `index.html`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://shared.steamstatic.com; font-src 'self'; connect-src 'self' <origin of VITE_API_URL>; object-src 'none'; base-uri 'self'; form-action 'self'`. It is a meta tag because the API origin comes from `VITE_API_URL` at build time; dev mode is left without it (React Refresh needs an inline script). `frame-ancestors 'none'` cannot live in a meta tag, so `client/vercel.json` sends it as a header. `config/cors.php` sets `exposed_headers` to `['Retry-After']`. `BlockPreviewWrites` reuses `CORS_PREVIEW_ORIGIN_PATTERN`.
- Render runs migrations on container start (spec 0005), so `personal_access_tokens` reaches production on the next deploy.

**Failure and edge handling** (decided in the design conversation):
- Cold start: auth requests use `apiFetch`'s 90 second timeout. The submit button shows loading, and after 3 seconds `useSlowPending` shows the waking up notice.
- Double submit: the button is disabled while `navigation.state` is `submitting`.
- Logout fails: the local sign out already happened (AC-12). The orphaned token expires within 7 days.
- `/me` fails with a network error or 5xx (not 401): the shared query client retries once. If it still fails, the header shows the "Account unavailable" button with Retry and Sign out (AC-11) and a protected loader shows the route's error state (existing `ErrorState`) with a retry. The token is kept.
- A guarded route without `Accept: application/json` must still get a 401 JSON. `shouldRenderJsonWhen` alone was not enough (the `Authenticate` middleware first builds a redirect to a `login` route that does not exist), so `bootstrap/app.php` sets `redirectGuestsTo(null)`. A Pest test proves it (AC-4).

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: register with `  Ana@Example.com ` → 201, stored as `ana@example.com`, token works on `/me`, logout → 204, the same token → 401, verifies **AC-1**, **AC-4**
- Failure case: two parallel registrations with one email → one 201, one 422; wrong password and unknown email return identical 422 bodies, verifies **AC-2**, **AC-3**
- Failure case: a token whose `expires_at` (travel 7 days and 1 minute ahead) has passed → 401 on `/me`, verifies **AC-4**
- Failure case: 6 logins in a minute for one email → the 6th is 429 with `Retry-After`; `Access-Control-Expose-Headers` includes it, verifies **AC-5**
- Auth/permission: a preview origin POST to `/auth/login` → 403; the same with a blank pattern → passes, verifies **AC-6**
- Auth/permission: a preview origin POST to `/auth/logout` with no token → 403, not 401, verifies **AC-6**
- Client: `safeRedirect` table test (`/orders?x=1` ok; `//evil.com`, `/\evil.com`, `/\t/evil.com`, `/%0a/evil.com`, `https://evil.com`, `javascript:alert(1)`, `/login`, empty → `/`), verifies **AC-9**
- Client: the 401 handler on a `requiresAuth` route navigates to `/login?redirectTo=...&reason=expired`; on a public route it only clears; three 401s at once navigate once; a 401 for a replaced token and a 401 from `/auth/logout` do nothing, verifies **AC-12**, **AC-13**
- Client: `Retry-After` parsing (`"30"` → 30, `"0"` → 1, missing or `"soon"` → 60), verifies **AC-8**
- Browser (`/check verify`): visitor opens `/orders` → lands on `/login?redirectTo=%2Forders` → registers → lands on `/orders`; reload keeps them signed in; sign out in a second tab flips the first, verifies **AC-7**, **AC-8**, **AC-10**, **AC-11**, **AC-12**, **AC-14**

## Build plan

Journey approach: auth is the gate in Journey 1, so you finish the whole path, server and client, with every state, before feature 8. The server comes first because every client state depends on real responses.

1. `composer require laravel/sanctum:^4.4`. Publish its config and migration (`vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"`, not `install:api`). Set `expiration` to `10080` and add `HasApiTokens` to `User`. Run the migration, satisfies **AC-1**, **AC-4**
2. Register and login: `RegisterRequest`, `LoginRequest` (email lowercasing, the 72 byte password rule), `RegisterUser` (catches the unique violation as 422), `LoginUser` (`auth.failed` on any mismatch), `UserResource`, `AuthTokenResource`, `AuthController::register|login`, routes. Pest tests, satisfies **AC-1**, **AC-2**, **AC-3**
3. Me and logout: `AuthController::me|logout`, `LogoutUser`, the `auth:sanctum` group (`auth:sanctum` before `throttle:account`). Pest tests including expiry, per token revocation, and the 401 JSON without an `Accept` header, satisfies **AC-4**
4. Limits and preview guard: `login` (two keyed `Limit`s, self normalised email), `register`, `account` limiters in `AppServiceProvider`; `exposed_headers: ['Retry-After']` in `config/cors.php`; `BlockPreviewWrites` prepended to the `api` middleware group. Pest tests including the preview POST to `/auth/logout` → 403, satisfies **AC-5**, **AC-6**
5. Client auth core: `authToken.ts` (memory plus `localStorage` key `eneba.auth_token`, try and catch, `subscribe` / `getSnapshot`, storage event listener that never writes back); `apiFetch` Bearer header, sent token passed to the handler, `retryAfter` parsing, `setUnauthorizedHandler`; `api/auth.ts`; `lib/auth.ts` (`meQueryOptions` with `staleTime: Infinity` and `enabled` on token, `clearAuth`, idempotent unauthorized handler, `afterSignIn` hook list); `safeRedirect.ts`. Vitest for the token store, `safeRedirect`, `Retry-After` parsing, and the 401 handler, satisfies **AC-8**, **AC-9**, **AC-12**, **AC-13**, **AC-14**, **AC-15**
6. Auth page: `/login` and `/register` routes with `redirectIfSignedIn`, `loginAction`, `registerAction`, and `AuthPage` (link tabs, per tab `<h1>`, existing `TextField` and `Button`, password toggle, inline errors, focus on the first error, 429 and form alerts, pending and slow notice, `reason=expired` alert), satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-13**
7. Header and sign out: `AccountMenu` (disclosure, keyboard, outside click); the header's three states (signed out, checking, signed in); sign out flow with toast; register the unauthorized handler and the storage sync in `main.tsx`, satisfies **AC-11**, **AC-12**, **AC-13**, **AC-14**
8. Guard: `requireAuth()` and the `/orders` route with `handle: { requiresAuth: true }`, an error element, and `OrdersPlaceholderPage`. Then run all checks locally and in CI, deploy, and smoke test register, login, and logout on production, satisfies **AC-10**, **AC-15**

## Consequences

**Positive**:
- Cart, checkout, and order history get a tested `auth:sanctum` group, a `requireAuth()` helper, an `afterSignIn` hook for the guest cart merge, and the `['me', ...]` cache convention, with nothing to redesign.
- No new infrastructure, environment variables, or third party accounts. Sanctum is first party Laravel and small enough to explain line by line.
- The server stays the only validator. The client shows the server's messages, so the rules live in one place.

**Negative / tradeoffs**:
- The token in `localStorage` is exposed to any XSS (accepted in spec 0001).
- No password reset or email verification: a user who forgets their password can't recover the account. The README must say this.
- Registration reveals whether an email is registered (rate limited, but real).
- Previews can't sign in, so auth and anything behind it can only be tested locally or on production.
- Expired token rows pile up until a cleanup exists (tiny at demo scale).
- The tabs as links pattern is not a true ARIA tablist. It's simpler and correct as navigation, but screen readers announce it as links, not tabs.

**Neutral**:
- One new table (`personal_access_tokens`), one new Composer package, and three new rate limiters next to `catalog`.
- `/orders` exists as a placeholder until feature 12 replaces its body (the guard stays).
- `BlockPreviewWrites` lands here as the first write endpoint, as spec 0005 planned.

## Follow-up

- [ ] Deferred (scope): password reset and email verification. Both need a real mail provider (`MAIL_MAILER=log` today).
- [ ] Expired token cleanup: delete the user's expired tokens on login, or schedule `sanctum:prune-expired` if a scheduler ever runs.
- [ ] Cart (feature 9) registers the guest cart merge in `afterSignIn` and keys its server cart query `['me', 'cart']`. Order history (feature 12) keeps the `/orders` guard and uses `['me', 'orders']`.
- [ ] Spec 0001 says login and register return `{ token, user }`. This spec wraps it as `{ data: { token, user } }` to follow the API Resource rule. Flag spec 0001's auth header bullet as stale for `/sync`.
- [ ] Root `AGENTS.md` lists Sanctum as "Planned". After the build, `/sync` should record it as installed (`laravel/sanctum` ^4.4) and the Agent Skill decline for Sanctum (the `Declined:` line).
- [ ] README: explain the token in `localStorage` tradeoff, the missing password reset, and that previews can't sign in.
