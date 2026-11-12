---
name: eneba-marketplace-design-system
source: url:https://www.eneba.com (studied 2026-11-11, spec 0003)
character: "Eneba's saturated violet storefront: a deep purple canvas, darker purple cards, one loud yellow call to action, and mint green prices. Dense, commercial, and game store energetic, with bold 800 weight headings in Metropolis."
tokens: "Real values live in src/index.css (@theme). The table below repeats them only to record contrast; index.css wins on any mismatch."
contrast: "Every used pair passes WCAG AA; full table below."
---

# Design system (client)

Decided in [spec 0003](../docs/specs/0003-design-system-ui-foundation/index.md). You can see every component live at `/ui` in `npm run dev` (the route is not in production builds).

## Build mandate

Every page ships as a complete product surface: the shared header and footer, real product copy, a clear hierarchy, and all states (loading, empty, error). Compose pages from the components below rather than writing one off styles. A new color means a new token in `src/index.css` plus a row in the contrast table here.

## Tokens

`src/index.css` starts its `@theme` with `--color-*: initial;`, so Tailwind's default palette (`red-500` and so on) does not exist. Only these color utilities work, plus `transparent`, `current`, `black`, `white`.

| Token | Value | Use it for |
|---|---|---|
| `bg` | `#4618ac` | page and header background |
| `surface` | `#351183` | cards, inputs, alerts, toasts |
| `surface-deep` | `#1f0a4d` | footer, header border, card hover, skeleton and image placeholder |
| `panel` | `#5825cc` | raised panels. Only `fg`, `fg-soft`, `cta`, `price` text on it. No secondary or ghost buttons on it |
| `fg` | `#ffffff` | primary text |
| `fg-soft` | `#dcd8e6` | labels, supporting copy |
| `fg-muted` | `#b3aac9` | secondary text, placeholders, input borders. Never on `panel` (3.7:1) |
| `link` | `#c5b1f1` | links, secondary button, info accent |
| `cta` | `#fad318` | primary button, focus ring, cart badge |
| `cta-hover` | `#fbdc46` | primary button hover |
| `cta-fg` | `#000000` | text on `cta`, `cta-hover`, `discount-bg` |
| `price` | `#3ddcb3` | current price |
| `success` | `#23c299` | success icon and border |
| `warning` | `#f0a613` | warning icons and borders only (no text) |
| `discount` | `#ed8ea8` | struck through list price (lightened from Eneba's `#e76a8c` for AA) |
| `discount-bg` | `#e76a8c` | `-NN%` badge fill |
| `danger` | `#f68a9f` | error text, error borders, error icons (lightened from Eneba's `#eb002e` for AA) |
| `danger-bg` | `#eb002e` | fills only, with white text. Never text or border on purple |

### Contrast table

Computed with the WCAG relative luminance formula. These are the only pairs the components use. Add a row before you use a new one.

| Pair | Role | Ratio | Needs |
|---|---|---|---|
| `fg` on `bg` | text | 10.6:1 | 4.5:1 |
| `fg` on `surface` | text | 13.5:1 | 4.5:1 |
| `fg` on `surface-deep` | text | 17.4:1 | 4.5:1 |
| `fg-soft` on `bg` | text | 7.6:1 | 4.5:1 |
| `fg-soft` on `surface` | icon (toast close) | 9.6:1 | 3:1 |
| `fg-soft` on `surface` | text (buy box "Sold by", offer "Only N left") | 9.6:1 | 4.5:1 |
| `fg-muted` on `bg` | text (hints), input border | 4.8:1 | 4.5:1 |
| `fg-muted` on `surface` | text (placeholder, card meta), icon | 6.1:1 | 4.5:1 |
| `fg-muted` on `surface-deep` | text (footer, hovered card) | 7.9:1 | 4.5:1 |
| `link` on `bg` | text, secondary button border | 5.5:1 | 4.5:1 |
| `link` on `surface-deep` | text (footer links) | 9.0:1 | 4.5:1 |
| `link` on `surface` | info icon and border | 7.0:1 | 3:1 |
| `cta-fg` on `cta` | text (primary button, cart badge) | 14.4:1 | 4.5:1 |
| `cta-fg` on `cta-hover` | text | 15.4:1 | 4.5:1 |
| `cta` on `bg` | focus ring | 7.2:1 | 3:1 |
| `cta` on `surface` | focus ring | 9.2:1 | 3:1 |
| `price` on `bg` | text | 6.1:1 | 4.5:1 |
| `price` on `surface` | text | 7.8:1 | 4.5:1 |
| `price` on `surface-deep` | text | 10.0:1 | 4.5:1 |
| `discount` on `bg` | text | 4.5:1 | 4.5:1 (just passes; prefer cards on `surface`) |
| `discount` on `surface` | text | 5.8:1 | 4.5:1 |
| `discount` on `surface-deep` | text | 7.5:1 | 4.5:1 |
| `cta-fg` on `discount-bg` | text (badge) | 6.8:1 | 4.5:1 |
| `danger` on `bg` | error text, error border | 4.6:1 | 4.5:1 |
| `danger` on `surface` | error icon and border | 5.8:1 | 3:1 |
| `success` on `surface` | success icon and border | 5.9:1 | 3:1 |

Disabled controls (50% opacity) are exempt from contrast under WCAG.

## Type

- Font: Metropolis 400, 600, 800, self hosted through `@fontsource/metropolis` (imported in `main.tsx`), with `Arial, Helvetica, sans-serif` as fallback.
- Root size stays 16px, so Tailwind's scale matches Eneba: `text-xs` 12, `text-sm` 14, `text-base` 16, `text-xl` 20, `text-2xl` 24 (and `md:text-3xl` for page titles).
- Weights: `font-normal` body, `font-semibold` labels and nav, `font-extrabold` headings, buttons, and prices.
- One `<h1>` per page, written by the page. Components never render an `<h1>`. Section headings are `<h2>` in `text-xl font-extrabold`.

## Layout

- `Container`: `mx-auto w-full max-w-page px-5` (1240px max, 1200px content).
- Breakpoints are Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Build mobile first.
- Radius: `rounded-sm` (4px) for cards, buttons, inputs, and badges. `rounded-full` for icon buttons and the cart badge.
- Touch targets: interactive elements are at least 44px (`min-h-11` or `size-11`).
- At 360px no page scrolls sideways.

## Focus and motion

- A global `:focus-visible` rule draws a 2px `cta` outline with a 2px offset. Do not remove it. Do not add `focus:` rings by hand. Mouse clicks show no ring.
- `html` has `scroll-padding-top` (8rem below `md`, 5rem from `md`) so focused elements never hide under the sticky header.
- Color transitions: `transition-colors` (150ms ease in out, set as the theme default).
- `prefers-reduced-motion: reduce` turns every animation and transition off with one global rule in `index.css`. Components add no `motion-reduce:` classes.

## Components

### Layout (`src/components/layout/`)

| Component | Props | Notes |
|---|---|---|
| `AppLayout` | none | Router layout route: skip link, `Header`, `<main id="main" tabIndex={-1}>` with `<Outlet/>`, `Footer`, `ToastProvider` |
| `Header` | `cartCount?: number` (default 0) | Sticky. One row from `md`. Below `md`, row one is wordmark, Store, cart, Sign in icon, and row two is the full width search (same `SearchForm`, moved with `order-last w-full`). Cart name "Cart, N items", badge hidden at 0, "99+" above 99 |
| `SearchForm` | `className?` | `role="search"`, trims the term, navigates to `/store?q=...`, ignores an empty term |
| `Wordmark` | none | Text "eneba" linking home, named "Eneba marketplace home". No Eneba logo file |
| `Footer` | none | `surface-deep`, footer nav, the "not affiliated" note |
| `Container` | `children`, `className?` | Page width wrapper |

### UI (`src/components/ui/`)

| Component | Props | Variants and states |
|---|---|---|
| `Button` | `variant?`, `size?`, `loading?`, native button props | `primary` (yellow), `secondary` (link outline), `ghost`. Sizes `md` (44px) and `lg` (56px). `disabled`: 50% opacity, no clicks. `loading`: spinner before the label, `aria-busy` and `aria-disabled`, clicks ignored, keeps focus and width. Secondary and ghost never on `panel` |
| `LinkButton` | `variant?`, `size?`, router `Link` props | Same looks as `Button`, for navigation |
| `Spinner` | `className?` | Decorative, `aria-hidden` |
| `TextField` | `label`, `hint?`, `error?`, native input props | Visible label, hint and error tied through `aria-describedby`. Error sets `aria-invalid` and a `danger` border |
| `Select` | `label`, `hint?`, `error?`, native select props, `<option>` children | Native `<select>`, options get `bg-surface text-fg` |
| `Checkbox` | `label`, `hint?`, `error?`, native input props | Native checkbox with a `cta` accent. Error shows as a `danger` outline, because native checkboxes have no stylable border |
| `Skeleton` | `className?` | Pulsing `surface-deep` block, `aria-hidden` |
| `EmptyState` | `title`, `message`, `action?: ReactNode` | `<h2>` title |
| `ErrorState` | `message?`, `onRetry` | `<h2>` "Something went wrong", secondary "Try again" |
| `Alert` | `variant?` (`info`, `success`, `error`), `role?`, `children` | `surface` box with a variant border and icon. Role defaults to `alert` for errors, `status` otherwise |
| `ToastProvider` / `useToast` | `useToast().show({ message, variant })` returns an id. `dismiss(id)` | One `aria-live="polite"` region, bottom center on mobile, bottom right from `md`. Info and success close after 4s (paused on hover or focus), errors stay. Max 3, oldest drops. `useToast` lives in `toastContext.ts` |

### Product (`src/components/product/`)

| Component | Props | Notes |
|---|---|---|
| `Price` | `price: Money \| null`, `listPrice?`, `discountPercent?`, `size?` (`md`, `lg`) | Price in `price` color. Strike plus `-NN%` badge only when `discountPercent > 0` and `listPrice` is set. `null` price shows "Out of stock" |
| `ProductCard` | `slug`, `name`, `coverImageUrl`, `platformName`, `regionName`, `price`, `listPrice`, `discountPercent` | One link to `/products/<slug>`. 2:3 cover (`COVER_ASPECT_CLASS`, matches Steam portrait art), lazy image, `Gamepad2` placeholder when missing or broken. Name clamped to 2 lines. Sits on `surface`, hover `surface-deep` |
| `ProductCardSkeleton` | none | Loading stand in with the same shape |
| `ProductGrid` | `children` (cards) | `<ul>` grid: 2, 3 (`md`), 4 (`lg`), 5 (`xl`) columns, `gap-4` |

Money is always integer cents (`Money` in `src/lib/money.ts`) and is only ever shown through `formatPrice`.

## Do's and don'ts

- Do use token utilities only. No hex values or `[#...]` in components or pages.
- Do use native `<a>`, `<button>`, `<input>`, `<select>`. No clickable `<div>`.
- Do give every icon only control an `aria-label`, and every decorative icon `aria-hidden="true"`.
- Don't put `fg-muted` or `discount` text on `panel`.
- Don't use `danger-bg` as text or a border on purple.
