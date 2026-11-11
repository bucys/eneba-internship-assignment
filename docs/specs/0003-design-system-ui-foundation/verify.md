# Verify: Design system & Eneba UI foundation · spec 0003 · updated 2026-11-11
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run `cd client && npm run dev`, then open the app in a browser. Use DevTools device mode for 360px.

## UI / manual

- [x] Open `/ui` at 1280px → every component shows in Eneba purple, yellow, and mint, in Metropolis (DevTools Computed: font family Metropolis) → AC-1, AC-2, AC-14
- [x] Network panel, filter Font, reload `/ui` → only `metropolis-latin-*.woff2` from the app's own origin, no Google Fonts or other host → AC-2
- [x] From the address bar on `/`, press Tab once → "Skip to content" appears top left in yellow. Press Enter → focus moves to `<main>` (no outline on main), next Tab lands inside the page, not the header → AC-3, AC-6
- [x] Keep pressing Tab from the top at 1280px → order is wordmark, search, Store, cart, Sign in, then page content. Each shows a 2px yellow ring with a gap. Clicking any control with the mouse shows no ring → AC-6
- [x] Tab to the yellow "Primary" button on `/ui` → the purple gap between button and yellow ring is visible → AC-6
- [x] Open `/does-not-exist` → 404 page in the layout: `<h1>` "Page not found", the line "This page does not exist or is not built yet.", yellow "Go to homepage" link that goes to `/` → AC-3
- [x] Open `/` → only `<h1>` "Buy game keys at the best prices" between header and footer. DevTools `document.querySelectorAll('h1').length` is 1 on `/`, `/ui`, and the 404 → AC-3
- [x] Header at 1280px → one row: wordmark, search growing, Store, cart icon, "Sign in" text → AC-4
- [x] Header at 360px → row one: wordmark, Store, cart, person icon. Row two: full width search. `document.querySelectorAll('form[role=search]').length` is 1. `document.documentElement.scrollWidth` is 360 on `/`, `/ui`, and the 404 → AC-4
- [x] Inspect landmarks → `<nav aria-label="Primary">` holds Store, `<nav aria-label="Footer">` holds footer links → AC-4
- [x] Type " witcher " in search, press Enter → URL becomes `/store?q=witcher` with no full page reload (Network shows no document request), the 404 shows → AC-5
- [x] Clear search, press Enter → nothing happens, URL unchanged → AC-5
- [x] Inspect the wordmark link → accessible name "Eneba marketplace home", goes to `/` → AC-5
- [x] Inspect the cart link → `aria-label="Cart, 0 items"`, no badge. In React DevTools set `Header` `cartCount` to 1 → "Cart, 1 item" and badge "1". Set 150 → "Cart, 150 items", badge "99+" → AC-5
- [x] At 360px inspect the Sign in link → `User` icon, accessible name "Sign in", goes to `/login` → AC-5
- [x] Tab to a focused element near the top while scrolled → it never hides under the sticky header → AC-6
- [x] `/ui` Buttons: primary yellow with black text, hover lighter yellow. Secondary lavender outline, hover darker fill. Ghost white text. `md` is 44px tall, `lg` 56px → AC-8
- [x] `/ui` Disabled buttons: 50% opacity, clicking does nothing → AC-8
- [x] `/ui` Loading buttons: spinner before the still visible label, `aria-busy="true"` and `aria-disabled="true"`, not `disabled`. Tab reaches them. In the Elements panel remove the `loading` spinner state and compare width → same width → AC-8
- [x] `/ui` Form fields: each field's label is clicked → focuses its control. The error email shows `aria-invalid="true"`, a pink border, pink message, and `aria-describedby` points to the message id. The hinted email's `aria-describedby` points to the hint → AC-9
- [x] `/ui` Select dropdown opens with dark options (purple background, white text) → AC-9
- [x] `/ui` Checkboxes: Space toggles them. The error checkbox has `aria-invalid="true"` and a pink outline → AC-6, AC-9
- [x] `/ui` Price: first row "€9.98", struck "€19.99", badge "-50%". "€49.99" alone. Large row is 24px. The `discountPercent={0}` row shows only "€9.98". The null row shows only "Out of stock" in muted text → AC-10
- [x] Screen reader or Accessibility tree on the struck price → reads "was €19.99" → AC-10
- [x] `/ui` Product cards: each card is one Tab stop, links to `/products/<slug>`. The long name clamps to 2 lines, no `title` attribute. Hover turns the card darker purple → AC-11
- [x] `/ui` Broken image card and null image card → the gamepad placeholder box is the same size as the real covers (no layout shift). Out of stock card shows "Out of stock" with no "From" → AC-10, AC-11
- [x] `/ui` Grid columns: 2 at 360px, 3 at 768px, 4 at 1024px, 5 at 1280px → AC-11
- [x] `/ui` Skeletons pulse and are `aria-hidden`. Empty state shows an `<h2>` and an action. Error state shows `<h2>` "Something went wrong", "Please try again in a moment.", and a secondary "Try again" button → AC-12
- [x] `/ui` Alerts: info (lavender icon), success (green), error (pink). Each has a role (the showcase error alert passes `role="status"` to override the `alert` default) → AC-13
- [x] `/ui` Toasts: click Success → a toast slides up bottom right (bottom center at 360px) and closes after about 4 seconds. Hover it → it stays while hovered. Click Error → stays until "Dismiss" is clicked. Click 4 times fast → only 3 show, the oldest drops. The live region has `aria-live="polite"` and toasts have no role → AC-13
- [x] DevTools Rendering, emulate `prefers-reduced-motion: reduce` → skeletons stop pulsing, toasts appear without sliding, button hovers change instantly → AC-15
- [x] Browser tab shows the title "Eneba Marketplace (demo)" and a purple square favicon with a yellow "e" → AC-17

## Commands

- [x] `cd client && grep -rE '\[#|#[0-9a-fA-F]{3,8}\b' src/components src/pages` → no output → AC-1
- [x] `grep -n -- '--color-\*: initial' client/src/index.css` → one match → AC-1
- [x] `cd client && npm run build && grep -r "UI Showcase" dist` → no output → AC-14
- [x] `cd client && npm run preview`, open `/ui` → the 404 page → AC-14
- [x] `cd client && npm test` → `formatPrice` gives `€9.98` for 998, `€0.99` for 99, `€1,234.00` for 123400 → AC-10
- [x] `ls client/src/App.tsx client/src/App.css client/src/assets client/public/icons.svg` → all missing → AC-17
- [x] `grep -E 'lang="en"|theme-color|description' client/index.html` → three matches → AC-17
- [x] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → all pass → AC-17
- [x] Open `client/design.md` → tokens with the contrast table, type, layout and breakpoints, focus and motion, every component's props and states. `client/AGENTS.md` links it → AC-7, AC-16

## Value sourcing

- [x] Colors: change `--color-cta` in `index.css` → every yellow (button, ring, badge) changes together → Token table
- [x] Price text: `formatPrice` only, in cents (try 1 → `€0.01`). No `/ 100` anywhere else: `grep -rn "/ 100" client/src` → only `money.ts` → Value sourcing: price
- [x] List price and discount badge come only from props: a card with `listPrice: null` and `discountPercent: 50` shows no strike and no badge → Value sourcing: discount
- [x] "Out of stock" derives from `price === null` only → Value sourcing: out of stock
- [x] Card link uses the `slug` prop → `/products/sample-discounted` → Value sourcing: card link
- [x] Card image falls back when the URL is null or fails → Value sourcing: card image
- [x] Cart badge and name derive from `cartCount` (0, 1, 150 as above) → Value sourcing: cart
- [x] Search target is the trimmed input, URL encoded: search `a&b` → `/store?q=a%26b` → Value sourcing: search
- [x] Toast lifetime 4000ms and cap 3 are the constants in `Toast.tsx` → Value sourcing: toast

## Acceptance-criteria coverage

- AC-1 Commands 1, 2; UI step 1 · AC-2 UI 1, 2 · AC-3 UI 3, 6, 7 · AC-4 UI 8, 9, 10 · AC-5 UI 11 to 15 · AC-6 UI 3, 4, 5, 16, 22 · AC-7 Commands 9 · AC-8 UI 17, 18, 19 · AC-9 UI 20, 21, 22 · AC-10 UI 23, 24, 26; Commands 5 · AC-11 UI 25, 26, 27 · AC-12 UI 28 · AC-13 UI 29, 30 · AC-14 UI 1; Commands 3, 4 · AC-15 UI 31 · AC-16 Commands 9 · AC-17 UI 32; Commands 6, 7, 8
