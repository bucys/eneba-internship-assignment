# 0003. Eneba design system: Tailwind v4 tokens and hand built accessible base components

**Date**: 2026-11-11
**Status**: Accepted

## Summary

This spec sets the look of the whole client: Eneba's real colors, the Metropolis font, spacing, and a small set of base components (header, layout, buttons, form fields, price, product card, loading and error states, alerts and toasts). The values come from studying eneba.com live, kept as close as possible, with only the few colors that fail contrast lightened. Everything lives as Tailwind v4 theme tokens (named design values) plus plain React components you can explain line by line, with no UI library. A dev only `/ui` page shows every component and state, so each later feature reuses these parts instead of inventing its own.

## Requirements

**User stories**:
- As a visitor, I want the site to look and feel like Eneba so that it is recognizable and trustworthy.
- As a keyboard or screen reader user, I want every control reachable, visible when focused, and named so that I can shop without a mouse.
- As the developer, I want one set of tokens and base components so that later features stay consistent and fast to build.

**Acceptance criteria** (the contract, each one independently checkable):
- **AC-1**: `client/src/index.css` defines every token in the *Token table* below inside a Tailwind v4 `@theme` block that starts with `--color-*: initial;` (so Tailwind's default palette such as `text-red-500` no longer exists), then adds the tokens plus `transparent`, `current`, `black`, and `white`. Components use only token utilities (`bg-surface`, `text-fg-muted`, and so on): searching `client/src/components` and `client/src/pages` with `grep -rE '\[#|#[0-9a-fA-F]{3,8}\b'` finds no color value (an arbitrary `[#...]` value or a hex in a class or style string).
- **AC-2**: Metropolis loads in weights 400, 600, and 800 from the app's own origin (Fontsource), with `Arial, Helvetica, sans-serif` as fallback. The browser network panel shows no request to any third party font host.
- **AC-3**: Every route renders inside one `AppLayout`: a "Skip to content" link (the first Tab stop, visible on focus, moves focus to `<main id="main" tabIndex={-1}>`, which has no outline), the sticky header, a `<main>` landmark, and the footer. An unknown path renders a 404 page inside the same layout: `<h1>` "Page not found", the line "This page does not exist or is not built yet.", and a `LinkButton` "Go to homepage" to `/`. Home shows only `<h1>` "Buy game keys at the best prices" until feature 15. Every page has exactly one `<h1>`, and components never render an `<h1>` themselves.
- **AC-4**: The header layout: at 768px and wider it is one row (wordmark, search field growing to fill, Store link, cart button, Sign in link). Below 768px, row one holds the wordmark, Store link, cart, and Sign in icon, and row two holds a full width search field. There is exactly one `SearchForm` in the DOM. Below `md` it moves to the second row through `flex-wrap`, `order-last`, and `w-full`, and is never rendered twice. The Store link sits in `<nav aria-label="Primary">`, and the footer links sit in `<nav aria-label="Footer">`. At 360px wide no page scrolls sideways.
- **AC-5**: Header behavior: the wordmark links to `/` with the accessible name "Eneba marketplace home". On submit, the search form calls `preventDefault()` and then `navigate("/store?q=" + encodeURIComponent(term))` with the term trimmed, so there is no full page reload. An empty term does nothing (no navigation, no error). The cart is a router `Link` to `/cart` with a `ShoppingCart` icon and a count from the `cartCount` prop (0 for now). Its accessible name is "Cart, 1 item" or "Cart, N items". The yellow badge shows only when the count is above 0, and shows "99+" above 99. Sign in is a `Link` to `/login`: the text "Sign in" from `md` up, and a `User` icon with `aria-label="Sign in"` below `md`. Routes not built yet show the 404 page, honestly, until their feature lands.
- **AC-6**: Every interactive element is reachable with Tab in visual order and activates with Enter (and Space for buttons and checkboxes). Keyboard focus shows a 2px `cta` yellow outline with a 2px offset (`focus-visible` only, so a mouse click shows no ring). On the yellow primary button, the offset gap shows the purple background between the button and the ring, so the ring stays visible. `html` has `scroll-padding-top` (8rem below `md`, 5rem from `md`), so a focused element never hides under the sticky header.
- **AC-7**: Every text and background pair the components use meets WCAG AA: 4.5:1 for normal text, 3:1 for large text, icons, and input borders. `design.md` lists every text, icon, and border pairing the built components actually use (alerts, toasts, badges, and form errors included) with its ratio, computed by the WCAG relative luminance formula (start from the contrast table in `rationale.md`, and use a throwaway script for new pairs). Pairs not on that list are not used.
- **AC-8**: `Button` has variants `primary` (yellow, black text), `secondary` (lavender outline on purple), and `ghost`, and sizes `md` (`min-h-11`, 44px, `px-4 text-sm`) and `lg` (`min-h-14`, 56px, `px-6 text-base`), all `font-extrabold rounded-sm`. Primary is `bg-cta text-cta-fg`, hover `bg-cta-hover`. Secondary is transparent with a `link` border and `link` text, hover `bg-surface`. Ghost is `fg` text with no border, hover `bg-surface`. Secondary and ghost are never placed on `panel`. `disabled` blocks clicks and shows at 50% opacity. `loading` does not use `disabled`, so the button keeps focus: it sets `aria-disabled="true"` and `aria-busy="true"`, the click handler returns early, a `Spinner` sits before the still visible label, and the width does not change. `LinkButton` renders a router `Link` with the same styles.
- **AC-9**: `TextField`, `Select` (native `<select>`), and `Checkbox` (native input) each render a visible label tied to the control. An optional hint and an error message are linked through `aria-describedby`. When an error is set, the control gets `aria-invalid="true"` and a `danger` border, and the message shows in the `danger` text color. Controls are `bg-surface` with a `fg-muted` border (6.1:1) and `fg` text, and `<option>` elements get an explicit `bg-surface text-fg`.
- **AC-10**: `formatPrice({ amount: 998, currency: "EUR" })` returns `€9.98` (integer cents in, `Intl.NumberFormat("en-IE")`, dividing by 100 only inside the formatter, never storing or adding floats). `Price` shows the current price in `price` color, `font-extrabold` (`md` size `text-base`, `lg` size `text-2xl`). Only when `discountPercent` is above 0 **and** `listPrice` is not null does it also show the list price in `<s>` (`discount` color, with sr-only text "was") and a badge reading `-${discountPercent}%` (ASCII hyphen, `bg-discount-bg text-cta-fg`). Otherwise there is no strike and no badge. When `price` is `null` it shows only "Out of stock" in `fg-muted`, with no "From" label and no badge.
- **AC-11**: `ProductCard` is one link to `/products/<slug>` and the card's only Tab stop. It shows the cover image (fixed aspect ratio, `loading="lazy"`, `alt` set to the product name), the name clamped to 2 lines, platform and region, and "From" plus `Price`. A missing or broken image shows a `bg-surface-deep` box of the same size with a `Gamepad2` icon (`fg-muted`, `aria-hidden`), so there is no layout shift. The card has `p-3` padding and no `title` attribute. A `ProductGrid` wrapper lays cards out at 2 columns by default, 3 from `md`, 4 from `lg`, and 5 from `xl`, with `gap-4`. The card sits on `surface`. Hover darkens it to `surface-deep`, never `panel`, where its muted and discount text would fail contrast.
- **AC-12**: `Skeleton` pulses (`aria-hidden="true"`), `EmptyState` shows an `<h2>` title, a message, and an optional `action: ReactNode`. `ErrorState` shows an `<h2>` "Something went wrong", a `message` (default "Please try again in a moment."), and a secondary "Try again" button that calls `onRetry`.
- **AC-13**: `Alert` has `info`, `success`, and `error` variants, all `bg-surface text-fg` with a 1px border and a lucide icon in the variant color (`info` uses `link`, `success` uses `success`, `error` uses `danger`). It takes an optional `role` prop, defaulting to `alert` for `error` and `status` for the others. `useToast().show({ message, variant })` (same three variants) returns the toast id and shows it, styled like `Alert` but with `role` omitted, inside one always mounted `aria-live="polite"` region (bottom center below `md`, bottom right from `md`, sliding up 8px). Info and success toasts close after 4 seconds, with the timer paused while hovered or focused. Error toasts stay until dismissed. Each toast has a close button with `aria-label="Dismiss"`, a dismissed toast clears its timer, and at most 3 show at once (the oldest drops).
- **AC-14**: In `npm run dev`, `/ui` shows the `<h1>` "UI Showcase (dev only)" and every component in every static state (default, disabled, loading, error, empty, out of stock, no discount, broken image, each toast variant via buttons). Hover and focus are checked by interacting, with a note saying so. `npm run build` ships no `/ui` route: the route is added only behind a direct `import.meta.env.DEV` check in `router.tsx`, `grep -r "UI Showcase" client/dist` finds nothing, and `/ui` in production renders the 404 page.
- **AC-15**: Color and background transitions run 150ms ease in out. With `prefers-reduced-motion: reduce`, one global rule in `index.css` sets animations and transitions to none (`animation: none; transition: none` on all elements), which switches off the skeleton pulse and toast slide. Components add no separate `motion-reduce:` classes.
- **AC-16**: `client/design.md` documents the tokens (with the contrast table), type scale, container and breakpoints, focus and motion rules, and every component's props, variants, and states. `client/AGENTS.md` links it.
- **AC-17**: The Vite starter is gone (`App.tsx` starter screen, `App.css`, `src/assets/*`), `index.html` has `lang="en"`, the title "Eneba Marketplace (demo)", a meta description, `<meta name="theme-color" content="#4618ac">`, and a hand written `public/favicon.svg` (a yellow "e" on a purple square) replacing the Vite one and `icons.svg`, and `format:check`, `lint`, `typecheck`, `test`, and `build` all pass.

## Decision

**Chosen option**: Option 1: Tailwind v4 theme tokens plus hand built components

You build the design system as Tailwind v4 `@theme` tokens copied from eneba.com, plus small hand built React components on native HTML elements, with React Router's layout route as the shell and a dev only `/ui` showcase.

**Implementation skills**: `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vite` (`antfu/skills`, `.claude/skills/vite/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: none. This feature is client only and touches no table. Components read the shapes the API will return (spec 0002, client `AGENTS.md` money convention).

**Token table** (observed on eneba.com on 2026-11-11; the *Adjusted* rows are changed only to pass AA):

| Token (`--color-*`) | Value | Role | Source |
|---|---|---|---|
| `bg` | `#4618ac` | page and header background | Eneba body and header |
| `surface` | `#351183` | cards, inputs, dropdowns | Eneba |
| `surface-deep` | `#1f0a4d` | footer, header bottom border | Eneba |
| `panel` | `#5825cc` | raised panels | Eneba (only `fg`, `fg-soft`, `cta`, `price` text allowed on it) |
| `fg` | `#ffffff` | primary text | Eneba |
| `fg-soft` | `#dcd8e6` | labels | Eneba |
| `fg-muted` | `#b3aac9` | secondary text, placeholders, input borders | Eneba (never on `panel`, 3.7:1) |
| `link` | `#c5b1f1` | inline links | Eneba |
| `cta` | `#fad318` | primary buttons, focus ring, cart badge | Eneba |
| `cta-hover` | `#fbdc46` | primary button hover | recommended (15% lighter `cta`) |
| `cta-fg` | `#000000` | text on `cta` | Eneba |
| `price` | `#3ddcb3` | current price | Eneba |
| `success` | `#23c299` | success alert and toast accent | Eneba |
| `warning` | `#f0a613` | warning accent (icons, borders only) | Eneba |
| `discount` | `#ed8ea8` | struck through list price text | **Adjusted** from `#e76a8c` (3.4:1 to 4.6:1) |
| `discount-bg` | `#e76a8c` | `-NN%` badge fill, with `cta-fg` black text (6.8:1) | Eneba |
| `danger` | `#f68a9f` | error text, error input border, error icons on purple | **Adjusted** from `#eb002e` (2.3:1 to 4.6:1) |
| `danger-bg` | `#eb002e` | fills only, with white text (4.6:1); never a border or text on purple (2.3 to 2.9:1) | Eneba |

Other tokens: `--font-sans: "Metropolis", Arial, Helvetica, sans-serif`. `--container-page: 77.5rem` (1240px, used as `max-w-page mx-auto px-5`, giving a 1200px content width like Eneba). The root font size stays 16px, so Tailwind's default type scale already matches Eneba's sizes (12, 14, 16, 20, 24px map to `text-xs`, `text-sm`, `text-base`, `text-xl`, `text-2xl`). Weights are `font-normal` 400, `font-semibold` 600, and `font-extrabold` 800, with headings and prices in 800. Breakpoints are Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). Radius is Tailwind `rounded-sm` (4px) for cards, buttons, inputs, and badges, and `rounded-full` for icon buttons and the cart badge.

**Component inventory and file layout** (all new; everything uses named exports):

| File | Exports | Notes |
|---|---|---|
| `src/router.tsx` | `router` | `createBrowserRouter` (from `react-router`): layout route `AppLayout` with children `/` (`HomePage`), `*` (`NotFoundPage`), plus, only when `import.meta.env.DEV` is checked directly, `{ path: "ui", lazy: async () => ({ Component: (await import("./pages/UiShowcasePage")).UiShowcasePage }) }`. `main.tsx` renders `RouterProvider` imported from `react-router/dom` (confirm both against the installed version's docs) |
| `src/components/layout/AppLayout.tsx` | `AppLayout` | skip link, `Header`, `<main id="main">` with `<Outlet/>`, `Footer`, `ToastProvider` |
| `src/components/layout/Container.tsx` | `Container` | `max-w-page mx-auto px-5` |
| `src/components/layout/Header.tsx` | `Header` | sticky `top-0 z-10 bg-bg border-b border-surface-deep`; props `cartCount = 0` |
| `src/components/layout/SearchForm.tsx` | `SearchForm` | `role="search"`, `type="search"` input with a visible or `sr-only` label "Search", placeholder "Search for games, top ups and more" |
| `src/components/layout/Wordmark.tsx` | `Wordmark` | text "eneba" in `font-extrabold`, lowercase, no Eneba logo file |
| `src/components/layout/Footer.tsx` | `Footer` | `bg-surface-deep`, links (Store, Sign in), "Demo project for an internship assignment. Not affiliated with Eneba. No real payments." |
| `src/components/ui/Button.tsx` | `Button`, `LinkButton` | shared `buttonClasses(variant, size)` |
| `src/components/ui/TextField.tsx`, `Select.tsx`, `Checkbox.tsx` | same names | `useId()` for label, hint, and error ids |
| `src/components/ui/Alert.tsx` | `Alert` | lucide icon per variant |
| `src/components/ui/Toast.tsx` | `ToastProvider`, `useToast` | React context, no library |
| `src/components/ui/Skeleton.tsx`, `EmptyState.tsx`, `ErrorState.tsx` | same names | |
| `src/components/ui/Spinner.tsx` | `Spinner` | used by `Button loading` |
| `src/components/product/Price.tsx` | `Price` | |
| `src/components/product/ProductCard.tsx` | `ProductCard`, `ProductCardSkeleton` | image aspect `aspect-[3/4]` in one constant |
| `src/components/product/ProductGrid.tsx` | `ProductGrid` | `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4` |
| `src/lib/money.ts` | `formatPrice`, type `Money` | `Money = { amount: number; currency: "EUR" }` |
| `src/pages/HomePage.tsx`, `NotFoundPage.tsx`, `UiShowcasePage.tsx` | same names | Home shows only an `<h1>` until feature 15 |

**API surface**: none. No endpoint is added or called. The shapes components accept:

| Component | Props (the inputs) |
|---|---|
| `ProductCard` | `slug: string`, `name: string`, `coverImageUrl: string \| null`, `platformName: string`, `regionName: string`, `price: Money \| null`, `listPrice: Money \| null`, `discountPercent: number \| null` |
| `Price` | `price: Money \| null`, `listPrice?: Money \| null`, `discountPercent?: number \| null`, `size?: "md" \| "lg"` |
| `Header` | `cartCount?: number` |
| `Button` | `variant?`, `size?`, `loading?`, plus native button props |
| `TextField` | `label: string`, `hint?: string`, `error?: string`, plus native input props |
| `ErrorState` | `message?: string`, `onRetry: () => void` |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Render any color | the hex value | Token table above, via `@theme` |
| Price text `€9.98` | formatted amount | derived: `formatPrice(Money)` with `Intl.NumberFormat("en-IE", { style: "currency", currency })`, dividing `amount` by 100 only inside that call |
| Price amount, currency | `Money` | prop; in later features from the API resource (`offers.price_cents`, `currency`, spec 0002) |
| List price | `Money \| null` | prop; later from `products.list_price_cents` (spec 0002) |
| Discount `-NN%` | integer percent | prop `discountPercent`, computed and rounded **on the server** (spec 0002 value sourcing; rounding pinned in feature 15). The client never computes it, so the store and the deals block cannot disagree. |
| "Out of stock" | label | derived: `price === null` (the null cheapest price suggested in spec 0002 follow up for feature 13) |
| Card link | `/products/<slug>` | prop `slug` (unique per spec 0002); feature 8 adopts this path |
| Card image | URL or placeholder | prop `coverImageUrl` (`products.cover_image_url`); placeholder when null or `onError` fires |
| Cart badge number | count | prop `cartCount`, default 0; wired in feature 9 |
| Search target | `/store?q=<term>` | input value, trimmed; feature 14 owns the results |
| Cart accessible name and badge | "Cart, 1 item" / "Cart, N items", badge hidden at 0, "99+" above 99 | derived from `cartCount` |
| Toast lifetime and cap | 4000ms for info and success (paused on hover or focus), none for error, 3 toasts | constants in `Toast.tsx` |
| 404, Home, empty, and error copy | fixed strings | AC-3 and AC-12 |

**Key invariants**:
- No raw hex colors outside `index.css`. A new color means a new token plus a contrast row in `design.md`.
- Money is only ever formatted by `formatPrice`, from integer cents.
- Every interactive element is a native `<a>`, `<button>`, `<input>`, or `<select>`. No clickable `<div>`.
- Every icon only control has an `aria-label`. Decorative icons get `aria-hidden="true"`.
- The showcase is reachable only in dev builds.

**Security model**: no data, auth, or secrets. Product names and image URLs come from the API and render as text and `src` through React (escaped), never as `dangerouslySetInnerHTML`. Using a text wordmark instead of Eneba's logo file, plus the footer note, keeps the public deploy from presenting itself as the real Eneba.

**Configuration required**: no new env variables. New client dependencies: `tailwindcss` and `@tailwindcss/vite`, `react-router`, `lucide-react`, `@fontsource/metropolis`.

**Edge cases and failure handling**:
- Long product names: clamped to 2 lines with `line-clamp-2`. Screen readers still read the full name from the link text.
- Native controls on a dark page: `:root { color-scheme: dark; }` so selects, scrollbars, and date pickers render dark.
- Missing or broken cover image: placeholder, same box size.
- `discountPercent` of 0, null, or missing: no badge and no struck through price.
- Many toasts: a cap of 3, oldest removed first. Error toasts never time out (WCAG 2.2.1 timing).
- Button double click while `loading`: ignored.
- Font fails to load: the Arial fallback with `font-display: swap` (Fontsource default), and the layout still works.
- 360px width: header icons only, search on its own row, product grid 2 columns.

**Critical test scenarios** (each maps to an acceptance criterion):
- Search: typing " witcher " and pressing Enter goes to `/store?q=witcher` with no full page reload, and an empty search stays put, verifies **AC-5**
- Happy path: on `/ui` at 1280px and at 360px, every component renders in Eneba colors with Metropolis, and the header switches layout, verifies **AC-1**, **AC-2**, **AC-4**, **AC-14**
- Keyboard: Tab from the page top hits the skip link first, then the header controls in order, each with the yellow ring, and Enter on the skip link moves focus to main, verifies **AC-3**, **AC-6**
- Unit: `formatPrice` gives `€9.98` for 998, `€0.99` for 99, and `€1,234.00` for 123400, verifies **AC-10**
- Failure case: a card with a broken image URL and `price: null` shows the placeholder and "Out of stock" with no layout shift, verifies **AC-10**, **AC-11**
- Production: `npm run build`, then `npm run preview` and open `/ui`, which shows the 404 page, and grepping `dist/` for the showcase heading finds nothing, verifies **AC-14**
- Reduced motion: with reduced motion emulated in DevTools, the skeleton does not pulse and toasts do not slide, verifies **AC-15**

## Build plan

Journey approach: this foundation sits under every journey, so you build the shell first (it is what every path walks through), then the pieces the purchase journey needs first, then the showcase and docs that prove it.

1. Install `tailwindcss` and `@tailwindcss/vite` (confirm the current v4 Vite setup in the official install guide), add the plugin to `vite.config.ts`, and replace `src/index.css` with `@import "tailwindcss"`, the `@theme` token block, base styles (`body` `bg-bg text-fg font-sans`, `color-scheme: dark`, `scroll-padding-top`), the global `focus-visible` outline, the toast slide `--animate-*` token, and the global reduced motion rule, satisfies **AC-1**, **AC-6**, **AC-15**
2. Install `@fontsource/metropolis`, confirm its 400, 600, and 800 CSS files exist in the installed package, and import them in `main.tsx`, satisfies **AC-2**
3. Remove the Vite starter (`App.tsx`, `App.css`, `src/assets/*`), set the `index.html` title and favicon, satisfies **AC-17**
4. Install `react-router` and `lucide-react`. Add `router.tsx`, `AppLayout`, `Container`, `Wordmark`, `SearchForm`, `Header`, `Footer`, `HomePage`, `NotFoundPage`, and render `<RouterProvider>` in `main.tsx`, satisfies **AC-3**, **AC-4**, **AC-5**
5. Build `Button`, `LinkButton`, `Spinner`, `TextField`, `Select`, `Checkbox`, satisfies **AC-6**, **AC-8**, **AC-9**
6. Build `money.ts` with `formatPrice` plus `money.test.ts`, then `Price`, `ProductCard`, `ProductCardSkeleton`, `ProductGrid`, satisfies **AC-10**, **AC-11**
7. Build `Skeleton`, `EmptyState`, `ErrorState`, `Alert`, `ToastProvider` and `useToast`, satisfies **AC-12**, **AC-13**, **AC-15**
8. Build `UiShowcasePage` with every component and state, wired only under `import.meta.env.DEV` with a lazy import. Check that the production bundle excludes it, satisfies **AC-14**
9. Measure every used text and background pair, write `client/design.md` (tokens, contrast table, type, layout, focus, motion, components), and link it from `client/AGENTS.md`, satisfies **AC-7**, **AC-16**
10. Run `format:check`, `lint`, `typecheck`, `test`, `build`, satisfies **AC-17**

## Consequences

**Positive**:
- Every later feature composes from ready parts in the right colors, so the Eneba look stays consistent without extra thought.
- No UI library: every line is plain React and Tailwind you can explain in the review.
- Accessibility is designed in at the token level (a contrast table) and the component level (native elements, focus ring, ARIA wiring).

**Negative / tradeoffs**:
- Hand built components lack what a headless library gives for free. The search suggestions combobox (feature 14) and any future dialog need their keyboard and ARIA logic written by hand.
- The two adjusted colors (`discount`, `danger`) are visibly lighter than Eneba's, a small fidelity cost for AA.
- Header links to `/store`, `/login`, and `/cart` show the 404 page until features 7, 9, and 13 land.
- The 3:4 card image ratio is a guess until feature 5 picks the seed images, so it may need one constant changed.

**Neutral**:
- Root font size stays 16px instead of Eneba's 10px root trick, so values convert from Eneba's rem units by multiplying by 0.625.
- Header and footer are not visually verified against a rendered eneba.com (the study read the HTML and CSS, not a screenshot). Compare by eye during `/check verify`.

## Follow-up

- [ ] Feature 8 (product page): use the `/products/<slug>` path the card links to.
- [ ] Features 13 and 15: return `discountPercent` (server rounded) and a `null` price for out of stock products, matching the `ProductCard` props.
- [ ] Feature 14 (search): build the suggestions combobox on `SearchForm`, following the WAI-ARIA combobox pattern by hand.
- [ ] Feature 5 (seed data): pick cover images that fit the 3:4 card ratio, or change the one ratio constant.
- [ ] `/sync`: add `client/design.md` and the new dependencies to `client/AGENTS.md`, and move React Router, Tailwind CSS, and lucide-react from "Planned" to installed in root `AGENTS.md`.
