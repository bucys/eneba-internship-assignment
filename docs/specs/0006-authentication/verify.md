# Verify: Authentication · spec 0006 · updated 2026-11-12
_Steps derived from spec 0006 acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones. Run locally (previews block auth writes) or on production._

## UI / manual
- [x] Signed out, open `/orders` → lands on `/login?redirectTo=%2Forders` before any orders content renders → AC-10
- [x] Click the **Register** tab → URL is `/register?redirectTo=%2Forders`, the tab has `aria-current="page"`, one `<h1>` "Create account" → AC-7
- [x] Inputs carry `autocomplete` `name`, `email`, `new-password` (register) and `email`, `current-password` (sign in); the eye button toggles the password between hidden and shown → AC-7
- [x] Register with email `not-an-email` and password `short` → inline errors under Email and Password, focus on Email, name and email still filled, password empty → AC-8
- [x] Register with `  Ana@Example.com ` and a valid password → lands on `/orders` ("My orders", "Your orders will appear here."), header shows the name; Network tab shows no extra `/auth/me` call → AC-1, AC-8, AC-10
- [x] Register again with `ana@example.com` → "The email has already been taken." under Email → AC-2
- [x] Reload `/orders` → still signed in; while `/me` is pending the header shows the "Loading account" placeholder, never "Sign in" → AC-11
- [x] At 360 px: no sideways scroll on `/login`, `/register`, `/orders`; the account button fits the first header row and its panel stays on screen → AC-7, AC-11
- [x] Account menu by keyboard: Tab to it, Enter opens, Escape closes and focus returns to the button; a click outside closes it; a long name is cut with an ellipsis at `md` and up, and the button's accessible name is the full name → AC-11
- [x] Sign out from the menu → `/`, toast "You're signed out.", `localStorage` key `eneba.auth_token` gone, header shows "Sign in" → AC-12
- [x] Stop the API, then sign out → still signed out locally, exactly one toast → AC-12
- [x] Make `/auth/logout` slow (cold start, or delay it in DevTools), then sign out → the header shows "Sign in" and the toast appears before the request finishes; the request carries the old token, and that token then gets 401 on `/auth/me` → AC-12
- [x] Signed in, stop the API, reload → the header shows "Loading account", then about 3 s later the "Account unavailable" button; open it → "Retry" and "Sign out"; start the API, click Retry → the account button with your name → AC-11
- [x] Signed in, stop the API, reload, open "Account unavailable", click Sign out → `/`, toast "You're signed out.", header shows "Sign in", `eneba.auth_token` gone from `localStorage` → AC-11, AC-12
- [x] "Account unavailable" by keyboard: Enter opens, Escape closes and returns focus to the button; a click outside closes it → AC-11
- [x] Production build (`npm run build && npx vite preview --port 5173`): home, sign in, register, `/orders` and sign out work with no "Refused to" CSP errors in the console; cover images and fonts load → security model (CSP)
- [x] Sign in with a wrong password → "These credentials do not match our records." under Email, password cleared → AC-3, AC-8
- [x] Sign in 6 times in a minute with one email → form alert "Too many attempts. Try again in N seconds." with N from the `Retry-After` header → AC-5, AC-8
- [x] Throttle the network to make the API slow (or a cold Render start) → the submit button shows its spinner, and after 3 s the "Waking up the server" notice appears → AC-8
- [x] Set `localStorage['eneba.auth_token'] = '999|bogus'`, open `/orders` → lands on `/login?redirectTo=%2Forders&reason=expired` with "Your session expired. Please sign in again.", token removed → AC-13
- [x] Same bogus token on `/` → header switches to "Sign in", no navigation → AC-13
- [x] Signed in, open `/login` by a client side link → redirected to `/` (or the safe `redirectTo`); on a full reload with an unconfirmed token the form shows (no loop) → AC-10
- [x] Open `/login?redirectTo=//evil.com` and sign in → lands on `/` → AC-9
- [x] Two tabs on `/orders`: sign out in tab A → tab B shows "Sign in" and moves to `/login?redirectTo=%2Forders` without `reason=expired` → AC-14
- [x] Two tabs signed out: sign in in tab A → tab B fetches `/auth/me` once and shows the name; the after sign in hooks did not run in tab B → AC-14

## Commands
- [x] `cd server && php artisan test tests/Feature/Auth` → all pass (AC-1 to AC-6) → AC-15
- [x] `cd server && composer format:check && composer analyse` → pass → AC-15
- [x] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → pass → AC-15
- [x] CI on the pushed commit → server and client jobs green → AC-15
- [x] `curl -i -X POST $API/api/v1/auth/logout` (no Accept header, no token) → 401 JSON `{"message":"Unauthenticated."}`, not HTML and not 500 → AC-4
- [x] `curl -i -X POST -H 'Origin: <a preview URL>' $API/api/v1/auth/logout` → 403 `{"message":"Preview deployments are read only."}` → AC-6
- [x] Production smoke test: register, `GET /auth/me`, logout, then the same token on `/auth/me` → 201, 200, 204, 401 → AC-1, AC-4
- [x] `curl -sI <production site>` → `Content-Security-Policy: frame-ancestors 'none'`; the page source has the CSP `<meta>` with `connect-src` naming the production API origin → security model (CSP)

## Value sourcing checks
- [x] Token: the response token's id part matches a `personal_access_tokens` row named `spa` → AC-1
- [x] `expires_at` on that row is 7 days after `created_at`; a token with `created_at` moved back 7 days and 1 minute gets 401 → AC-1, AC-4
- [x] `user.id`, `user.name`, `user.email` in register, login and `/me` match the `users` row → AC-1, AC-4
- [x] Stored email for `  MiXeD@Case.com ` is `mixed@case.com` → AC-1
- [x] Password byte limit: 36 × `é` (72 bytes) is accepted, 37 × `é` (74 bytes) is rejected even though it is only 37 characters → AC-2
- [x] Wrong password text equals Laravel's `auth.failed` line → AC-3
- [x] `Retry-After` on a 429 is readable from the browser (`Access-Control-Expose-Headers: Retry-After`); a header of `0` shows "1 second", missing shows "60 seconds" → AC-5, AC-8
- [x] Login limiter key: `"  Ana@X.com "` and `"ana@x.com"` share one bucket; 20 different emails from one IP hit the IP limit on the 21st → AC-5
- [x] Account limiter key is the user: two users from one IP each get 60 `/me` calls → AC-5
- [x] Preview guard reads `Origin` against `CORS_PREVIEW_ORIGIN_PATTERN`: a blank pattern blocks nothing; `FRONTEND_URL` is never blocked → AC-6
- [x] Active tab and `<h1>` follow the route path (`/login` → Sign in, `/register` → Create account) → AC-7
- [x] Post sign in destination is `safeRedirect(redirectTo)`: `/orders?x=1` kept, `/register` → `/` → AC-9
- [x] Expired alert appears only with `reason=expired`, which only the 401 handler and the guard set → AC-13
- [x] An unknown 422 key (for example `errors.name` on sign in) shows in the form alert, not under a field → AC-8 _(verified 2026-11-12, `/check verify`: mocked 422 `errors.name` on `/login` rendered "Name problem from server." in the form `role="alert"`, production build)_
- [x] Header name comes from the `['me']` cache: after sign in no `/me` call; after a reload exactly one → AC-8, AC-11
- [x] Header shows the placeholder only while a token exists and `['me']` is pending → AC-11
- [x] 401 handler acts only when the sent token equals the current one and the path is not `/auth/logout` → AC-12, AC-13
- [x] Protected route detection: only routes with `handle.requiresAuth` navigate on a 401 → AC-13
- [x] `redirectTo` built by the app is `encodeURIComponent(pathname + search)`, with the hash dropped → AC-9, AC-13
- [x] Other tab changes arrive through the `storage` event for key `eneba.auth_token` → AC-14
- [x] Toast text is exactly "You're signed out."; placeholder name is exactly "Loading account"; orders placeholder copy matches → AC-10, AC-11, AC-12

## Acceptance-criteria coverage
- AC-1 register steps, smoke test, token and email checks · AC-2 duplicate email, byte limit · AC-3 wrong password · AC-4 curl 401, expiry, smoke test · AC-5 six logins, limiter keys · AC-6 preview curl, guard check · AC-7 tabs, autocomplete, 360 px · AC-8 inline errors, 429 alert, slow notice · AC-9 evil redirect, safeRedirect · AC-10 guard, auth page redirect · AC-11 reload, menu keyboard · AC-12 sign out, failed sign out · AC-13 bogus token on `/orders` and `/` · AC-14 two tab steps · AC-15 command steps and CI
