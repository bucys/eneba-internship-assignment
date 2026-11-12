# 0006. Authentication: rationale

## Context

The purchase journey (Journey 1) needs a signed in buyer: checkout creates orders that belong to a user, keys must only ever be shown to their owner, and order history is private. Feature 7 is the gate every later Journey 1 feature passes through, and it has to land before the product page, cart, and checkout build on it.

Spec 0001 already fixed the mechanism. Laravel Sanctum personal access tokens are sent as `Authorization: Bearer`, because the client (Vercel) and API (Render) sit on two unrelated free domains where cross site cookies are unreliable. Tokens expire after 7 days, the client keeps the token in memory and `localStorage`, and clears it on logout or any 401. Spec 0002 left the `users` table unchanged and made carts and orders private to their `user_id`. Spec 0005 left the `BlockPreviewWrites` middleware for the first write endpoint, which is this feature. Sanctum is not installed yet.

What is open is everything around that mechanism. Which methods and fields, how the forms submit and show errors, how the client knows who is signed in on page load (a cold start can take a minute), how protected routes redirect and return, what happens when a token expires mid session or the user signs out in another tab, and how to slow down password guessing on a public demo. The build budget is 3 to 4 days for the whole product, and the developer must be able to explain every line. Email is not configured (`MAIL_MAILER=log`), which rules out anything that depends on sending mail.

If these are not decided now, each later feature reinvents them: checkout would invent its own redirect, the cart its own cache keys, and every 401 would be handled differently.

## Options considered

### Option 1: Router data mode on the client (route actions, loader guards, user in TanStack Query)

The forms are React Router `<Form>`s whose `action` calls the API and returns 422 errors. Protected routes call `requireAuth()` in their loader, which redirects before render. The current user is the `['me']` query, seeded from the login response. The token lives in a tiny module, and `apiFetch` attaches it and reports 401s to one handler.

**Pros**:
- Uses only what is installed (React Router 8 data mode, TanStack Query) and follows the project's routing skill.
- Loaders run before render, so a guarded page never flashes, and the page's own loaders never fire a request that gets a 401.
- One place handles a 401, and one query key prefix clears all user data.

**Cons**:
- Auth logic is spread across a few small modules (token store, `lib/auth.ts`, loaders, actions), which takes a short diagram to explain.
- Loaders can't use hooks, so they reach the query client through its module export.

### Option 2: An AuthContext with a RequireAuth wrapper and useMutation forms

A React context holds `{ user, token, login, logout }`. Forms are controlled inputs that submit with `useMutation`, and protected pages are wrapped in `<RequireAuth>`.

**Pros**:
- The most familiar React pattern. Every tutorial shows it.
- All auth state is in one provider file.

**Cons**:
- It duplicates the `['me']` cache that spec 0001 already places in TanStack Query, so two sources of truth can drift.
- Loaders can't read context, so a wrapped page's loaders still run first and fire requests that get a 401.
- Form state and pending handling are hand rolled, unlike the router's built in navigation state.

### Option 3: Laravel Fortify or a starter kit's auth scaffolding

Install Fortify (Laravel's headless auth backend) for register and login endpoints, and pair them with Sanctum tokens.

**Pros**:
- Ready made register and login, plus password reset and email verification when they are added later.
- Battle tested validation and throttling.

**Cons**:
- Fortify is built around session cookies and redirects. Bending it to return Bearer tokens means overriding its responses, which is more code to understand than the four small actions.
- It brings features (2FA, password confirmation) that are out of scope, along with routes to disable.
- It hides the logic the developer must be able to explain in the review.

## Rationale

Option 1 wins because it builds on decisions that are already made instead of beside them. Spec 0001 put the user in TanStack Query and chose React Router data mode. Option 1 uses both as designed, while Option 2 adds a second state holder that loaders can't see. The no flash guard matters for this project in particular: a Render cold start can stretch a request to a minute, and a wrapped page that renders, fires its own requests, and then bounces is visibly broken in that window. Option 3's prebuilt flows are attractive, but the two it would really save (reset and verification) need email, which is deferred. For login and register alone, four short actions are easier to explain than Fortify's overrides.

Several smaller calls were made inside the design conversation, and the reasoning for each is recorded here.
- **One tabbed page as two routes.** The engineer chose one auth page with tabs. Making each tab a link to its own route (`/login`, `/register`) keeps the URL honest, makes Back work, and avoids hand building an ARIA tablist. The runner up (real ARIA tabs on one route) gives the same experience with more code and more to test.
- **`redirectTo` query param with a strict same origin check.** It survives reloads and the switch between tabs, unlike router state. The check blocks open redirects (`//evil.com`, `/\evil.com`).
- **422 for bad credentials.** This keeps "any 401 means the token is dead" true across the client, so the global 401 handler needs no special case for the login form.
- **Email lowercased on write.** The existing unique index then guarantees one account per address with no migration. A case insensitive index was the runner up.
- **Password length only, 8 characters to 72 bytes.** This follows NIST guidance. The limit is measured in bytes because bcrypt silently ignores anything past 72 bytes, and a character count would let multibyte passwords slip past that.
- **Throttle, never lock out.** The 5 per minute limit per email and IP plus 20 per minute per IP slows guessing without letting a stranger lock a real user out.
- **Disclosure, not an ARIA menu, for the account button.** Two items don't need the menu keyboard model, and a disclosure (a button with `aria-expanded` that shows and hides a panel) is simpler and fully accessible. The runner up was a `role="menu"` with arrow key handling.
- **`['me', ...]` key prefix for all user data.** One `removeQueries` call on sign out or a 401 clears everything a user owns, so later features can't forget to clear their own cache. The runner up was calling `queryClient.clear()`, which also throws away the public catalog cache.
- **`handle.requiresAuth` on protected routes.** The 401 handler can ask "is this page protected?" without a hardcoded path list, and new guarded routes opt in where they are declared.
- **Racing registrations caught as 422.** Validation's unique check and the insert are not atomic. Catching the database's unique violation turns the race into the normal "email taken" error instead of a 500.
- **Cross check fixes (2026-11-12).** An independent review found edge rules that were missing. All were applied as recommended: the 401 handler acts only for the token still in use and runs once; the token store is reactive (`useSyncExternalStore`); `['me']` never goes stale on its own; tabs that adopt a token skip the after sign in hooks; `redirectIfSignedIn` trusts only a confirmed user (no redirect loop); `redirectTo` parsing rejects encoded and control character tricks; the preview guard runs first and is documented as a browser guard, not a security boundary; the login limiter normalises the email itself.
- **Register and logout status codes.** Register returns 201 (a user was created), and logout returns 204 (nothing to return). Both are the HTTP conventions Laravel resources support out of the box.
