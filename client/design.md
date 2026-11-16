---
name: eneba-marketplace-design-system
source: url:https://www.eneba.com (studied 2026-11-11, spec 0003)
character: "Eneba's saturated violet storefront: a deep purple canvas, darker purple cards, one loud yellow call to action, white prices with a lime green saving, and a mint accent for regions and hover rings. Dense, commercial, and game store energetic, with bold 800 weight headings in Metropolis."
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
| `surface-deep` | `#1f0a4d` | footer, header border, dark homepage bands, skeleton and image placeholder |
| `panel` | `#5825cc` | raised panels. Only `fg`, `fg-soft`, `cta`, `accent`, `saving` text on it. No secondary or ghost buttons on it |
| `fg` | `#ffffff` | primary text |
| `fg-soft` | `#dcd8e6` | labels, supporting copy |
| `fg-muted` | `#b3aac9` | secondary text, placeholders, input borders. Never on `panel` (3.7:1) |
| `link` | `#c5b1f1` | links, secondary button, info accent |
| `cta` | `#fad318` | primary button, focus ring, cart badge |
| `cta-hover` | `#fbdc46` | primary button hover |
| `cta-fg` | `#000000` | text on `cta`, `cta-hover` |
| `accent` | `#3ddcb3` | card region label, card hover ring (was `price`, spec 0015) |
| `saving` | `#9be15d` | `-NN%` saving text next to the struck list price |
| `success` | `#23c299` | success icon and border |
| `warning` | `#f0a613` | warning icons and borders only (no text) |
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
| `cta` on `bg` | text (store sort trigger) | 7.2:1 | 4.5:1 |
| `cta-hover` on `bg` | text (store sort trigger, hover) | 7.8:1 | 4.5:1 |
| `surface-deep` on `white` | text (store sort options) | 17.4:1 | 4.5:1 |
| `surface-deep` on `fg-soft` | text (highlighted sort option) | 12.4:1 | 4.5:1 |
| `bg` on `fg-soft` | text and check icon (selected sort option, highlighted) | 7.6:1 | 4.5:1 |
| `bg` on `white` | text and check icon (selected sort option) | 10.6:1 | 4.5:1 |
| `cta` on `surface` | focus ring | 9.2:1 | 3:1 |
| `accent` on `bg` | text | 6.1:1 | 4.5:1 |
| `accent` on `surface` | text | 7.8:1 | 4.5:1 |
| `accent` on `surface-deep` | text | 10.0:1 | 4.5:1 |
| `saving` on `bg` | text (`-NN%`) | 6.7:1 | 4.5:1 |
| `saving` on `surface` | text (`-NN%`) | 8.5:1 | 4.5:1 |
| `saving` on `surface-deep` | text (`-NN%`) | 11.0:1 | 4.5:1 |
| `saving` on `panel` | text (`-NN%`) | 5.2:1 | 4.5:1 |
| `fg-muted` on `surface` | text (struck list price) | 6.1:1 | 4.5:1 |
| `cta` on `bg` | text (header Store link, current) | 7.2:1 | 4.5:1 |
| `fg` on `black/70` | text (card platform strip, worst case over white art) | 8.5:1 | 4.5:1 |
| `success` on `bg` | icon and border (stepper completed step) | 4.7:1 | 3:1 |
| `fg-muted` on `bg` | text and border (stepper later step) | 4.8:1 | 4.5:1 |
| `accent` on `bg` | icon (product info rows), text (title block platform · region) | 6.1:1 | 4.5:1 |
| `fg`, `fg-soft`, `fg-muted`, `saving` on `surface-deep/95` | text (featured hero and compact featured banner from `sm`, left edge of the gradient, worst case over white art; `FeaturedBanner` adds a `surface-deep/70` stop at 45% and fades out at 70%, so its tagline from `xl` measured no letter pixel under 6.8:1 at 1280 and 1440 px, spec 0016) | 15.6:1, 11.1:1, 7.1:1, 9.9:1 | 4.5:1 |
| `fg`, `fg-soft`, `fg-muted`, `saving` on `surface-deep` | text (hero side tile, compact featured banner text strip below `sm`) | 17.4:1, 12.4:1, 7.9:1, 11.0:1 | 4.5:1 |
| `danger` on `bg` | error text, error border | 4.6:1 | 4.5:1 |
| `danger` on `surface` | error icon and border | 5.8:1 | 3:1 |
| `success` on `surface` | success icon and border | 5.9:1 | 3:1 |
| `danger` on `surface-deep` | text (key slot error) | 7.5:1 | 4.5:1 |
| `fg-soft` on `surface-deep` | text (key slot copy hint) | 12.4:1 | 4.5:1 |
| `success` on `surface-deep` | icon (key slot "Copied" check) | 7.7:1 | 3:1 |
| `link` on `surface` | text (secondary button hover inside a key slot) | 7.0:1 | 4.5:1 |
| `success` on `surface` | text and border (order "Paid" badge) | 5.9:1 | 4.5:1 |
| `success` on `surface-deep` | text and border ("Paid" badge on a hovered order row) | 7.7:1 | 4.5:1 |
| `link` on `bg` | text ("Back to my orders" link) | 5.5:1 | 4.5:1 |
| `cta` on `bg` | text (header Store and Sign in link hover from `md`) | 7.2:1 | 4.5:1 |
| `fg` on `surface` | text (store filter chip) | 13.5:1 | 4.5:1 |
| `fg` on `surface-deep` | text (hovered store filter chip) | 17.4:1 | 4.5:1 |
| `fg-soft` on `surface` | icon (chip remove "x") | 9.6:1 | 3:1 |
| `fg-muted` on `bg` | chip border | 4.8:1 | 3:1 |
| `cta-fg` on `cta` | text (Filters count badge) | 14.4:1 | 4.5:1 |
| `link` on `bg` | text ("See all" link, Filters button) | 5.5:1 | 4.5:1 |
| `cta` on `surface-deep` | active search suggestion bar (non text) | 11.9:1 | 3:1 |
| `fg-muted` on `surface` | text (suggestion platform, "Searching…", "No games match") | 6.1:1 | 4.5:1 |
| `accent` on `surface` | product card hover ring (non text, 1px inset) | 7.8:1 | 3:1 |
| `fg` on `surface` | icon (rail arrow chevron) | 13.5:1 | 3:1 |
| `cta-fg` on `cta` | text (hero CTA button and side tile CTA pill) | 14.4:1 | 4.5:1 |

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
- `:root` sets `--header-h`, the sticky header height: 7.5625rem (121px) below `md`, where the search wraps onto its own line, and 4.3125rem (69px) from `md`, where the header is one row. On `/cart` and `/checkout`, `CheckoutHeader` is one 69px row at every width, so `:root:has([data-header="checkout"])` sets `--header-h` to 4.3125rem there, and leaving those routes restores the normal values. All values come from `py-3`, 44px controls, the `gap-y-2` wrap gap below `md`, and the 1px bottom border. `html` uses it for `scroll-padding-top`, and every sticky offset uses `calc(var(--header-h) + 1rem)`, so focused elements never hide under the header. Do not add `scroll-mt` to jump targets such as `#offers`: scroll margin adds to the `html` padding and doubles the gap. Change these values whenever the header's padding, control size, or search height changes.
- Color transitions: `transition-colors` (150ms ease in out, set as the theme default).
- `prefers-reduced-motion: reduce` turns every animation and transition off with one global rule in `index.css`. Components add no `motion-reduce:` classes.

## Components

### Layout (`src/components/layout/`)

| Component | Props | Notes |
|---|---|---|
| `AppLayout` | none | Router layout route: skip link, then `Header` (gets `useCartCount()`), or `CheckoutHeader` when the deepest route's `handle.checkoutStep` is set (`/cart` 1, `/checkout` 2), `<main id="main" tabIndex={-1}>` with `<Outlet/>`, `Footer`, `ToastProvider` |
| `Header` | `cartCount?: number` (default 0) | Sticky, one row from `md` (`--header-h` 4.3125rem). Wordmark, search, then a group of Store, cart, and account. Store is a `LayoutGrid` icon link (name "Store") below `md`, icon plus "Store" label from `md`; it is current (`cta`, `aria-current="page"`) on `/store` with any params. Below `md` the search wraps under the row (`order-last w-full`, `--header-h` 7.5625rem). Platform links live only in the homepage shortcuts. Cart name "Cart, N items", badge hidden at 0, "99+" above 99 |
| `CheckoutHeader` | `step` (1, 2) | Focused header for cart and checkout: wordmark and `Stepper` only, no search, Store link, cart, or account. One 69px row at every width; its `data-header="checkout"` sets `--header-h` to 4.3125rem |
| `SearchForm` | `className?` | `role="search"`, `maxLength` 100, trims the term and starts a fresh search at `/store?q=...` (other store params dropped; an empty term goes to `/store`; the URL already shown adds no history entry). On `/store` the field follows the URL's `q`. Combobox with a listbox popup ([spec 0013](../docs/specs/0013-search-typo-tolerance/index.md)): opens only on the visitor's typing, focus, or ArrowDown with 2+ characters, never from the URL sync; 250 ms debounce; arrows wrap, Enter picks the active option or submits, Escape closes then clears, Tab, outside blur, submit, selection, and route change close it; a hidden polite live region announces the count |
| `SearchSuggestions` | `listboxId`, `optionId(index)`, `view` (`searching`, `unavailable`, or `results` with `isStale`), `term`, `activeIndex`, `onSelect(index)` | Absolute under the search form on `surface`, `max-h-[min(24rem,60dvh)]`, scrolls inside. Rows: 40px cover (`alt=""`), name clamped to 2 lines with typed words in bold `<mark>`, `fg-muted` platform, `Price`. Last option "See all results for \"term\"" only when there are suggestions. Active row: `surface-deep` plus a 4px `cta` left bar. Stale results at 60% opacity with `aria-busy`. Status rows "Searching…", "No games match \"term\"", "Suggestions are unavailable right now." are not options. `mousedown` is prevented so focus stays in the input |
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
| `ErrorState` | `title?`, `message?`, and either `onRetry` or `action: ReactNode` | `<h2>` title (default "Something went wrong"); secondary "Try again" for `onRetry`, or `action` in its place (store 422 "Clear filters") |
| `Pagination` | `page`, `lastPage`, `hrefFor(page)`, `label`, `onNavigate?` (runs on a page link click, for example to scroll to the top) | `<nav>` named by `label`: secondary Previous and Next links around a `fg-soft` "Page X of Y". At the first or last page the end is an `aria-disabled` span at 50% opacity, not a link. Renders nothing when `lastPage` is 1 |
| `ScrollRail` | `label`, `children` (`<li>` items that set their own width), `listClassName?` | Positioned `<ul>` that scrolls sideways with scroll snap and a hidden scrollbar. From `md`, round `surface` arrow buttons "Scroll {label} left/right" overlay the edges, vertically centred, and scroll one visible width (instant under reduced motion). At an end the arrow gets `aria-disabled` and 40% opacity (never `disabled`, so focus stays). Both arrows hidden when nothing overflows |
| `ErrorBoundary` | `children`, `fallback(reset)` | Class component. A render error in its children shows `fallback`; key it on new data to clear it |
| `Alert` | `variant?` (`info`, `success`, `error`), `role?`, `children` | `surface` box with a variant border and icon. Role defaults to `alert` for errors, `status` otherwise |
| `ToastProvider` / `useToast` | `useToast().show({ message, variant, action? })` returns an id. `action: { label, to }`. `dismiss(id)` | One `aria-live="polite"` region, bottom center on mobile, bottom right from `md`. Info and success close after 4s (paused on hover or focus), errors stay. Max 3, oldest drops. `action` renders a normal focusable router link after the message (44px tall, underlined, `cta` on hover) that closes the toast when clicked, for example "View cart". `useToast` lives in `toastContext.ts` |

### Product (`src/components/product/`)

| Component | Props | Notes |
|---|---|---|
| `Price` | `price: Money \| null`, `listPrice?`, `discountPercent?`, `size?` (`md`, `lg`), `className?` | A column. When discounted (`discountPercent > 0` and `listPrice` set), line 1 is the struck list price in `fg-muted` plus `-NN%` in extrabold `saving`, no pill. Line 2 is the price in extrabold `fg` (`md` `text-lg`, `lg` `text-3xl`). `null` price shows "Out of stock" |
| `ProductCard` | `slug`, `name`, `coverImageUrl`, `platformName`, `regionName`, `price`, `listPrice`, `discountPercent`, `layout?` (`vertical` default, `horizontal`), `ref?` (to the link) | One link to `/products/<slug>`. 2:3 cover (`COVER_ASPECT_CLASS`, matches Steam portrait art), lazy image, `Gamepad2` placeholder when missing or broken. A `black/70` platform strip overlays the cover's bottom edge. Name clamped to 2 lines, then the region in extrabold `accent`, uppercased by CSS. Sits on `surface`; hover and keyboard focus add a 1px inset `accent` ring (background unchanged). `horizontal`: 80px cover on the left, text on the right (homepage mobile lists). Inset focus outline (`-outline-offset-2`), so a scrolling rail never clips it |
| `ProductCardSkeleton` | `layout?` | Loading stand in with the same shape as the matching layout |
| `ProductGrid` | `children` (cards) | `<ul>` grid: 2, 3 (`md`), 4 (`xl`) columns, `gap-4` |
| `ProductBreadcrumb` | `name` | `<nav aria-label="Breadcrumb">`: Home › Store › name (`aria-current="page"`), links 44px tall |
| `ProductTitleBlock` | `product`, `heading` | Cover (`w-28`, `md:w-44`) beside type, the page's `<h1>`, and platform · region in `accent` |
| `ProductInfoRows` | `product` | Three icon rows from real data only: platform ("Activate on X"), region ("X key"), Digital key |
| `BuyBox` | `product` | On `surface`: "Best offer", `Price` `lg`, "Sold by", full width add to cart, and "+N offers from €X" (`otherOffersSummary`: in stock non best offers, lowest price) linking to `#offers`, hidden at 0. No best offer: only "Out of stock". Sticky in a 20rem right column from `lg` |

### Home (`src/components/home/`)

Decided in [spec 0014](../docs/specs/0014-homepage-blocks/index.md). The home page renders a hidden `<h1>`, then the blocks `GET /home` lists, in order, inside one `.home-bands` wrapper.

| Component | Props | Notes |
|---|---|---|
| `HomeSection` | `title`, `action?`, `children` | Full width `<section data-band>` named by its `<h2>` (`text-2xl`, `md:text-3xl`, extrabold), content in `Container`, `py-10` (`md:py-14`). Colour comes from `index.css`: bands alternate `bg`, `surface-deep`, `bg` by the bands actually rendered |
| `HomeQueryBlock` | `title`, `query`, `skeleton`, `children(items)` | One block's states: `skeleton` while loading, `HomeBlockError` on a failed request, nothing for an empty list, else the content inside an `ErrorBoundary` keyed on `dataUpdatedAt` |
| `HomeBlockError` | `title`, `message?`, `onRetry` | The block's band with its title and an `ErrorState` whose Try again refetches only that block |
| `HeroBanners`, `HeroSplit`, `HeroCompact`, `HeroSkeleton` | `title`; `title`, `banners` | Mounts one layout, chosen by `useMediaQuery(SPLIT_HERO_QUERY)` (`64rem`). From `lg`, `HeroSplit`: a 22.5rem grid in `Container` (`pt-6`), `FeaturedBanner` (first banner, 2 parts) and up to two `BannerSideTile`s (1 part, stacked; one tile spans both rows; no tiles makes the featured slot full width). Below `lg`, `HeroCompact`: one `CompactFeaturedBanner` from the first banner in `Container` (`pt-4`); no carousel, no rail, no other banners. Loading shows `HeroSplitSkeleton` or `HeroCompactSkeleton` by the same query (`HeroSkeleton` picks one for the page skeleton). Title is a visually hidden `<h2>`. Not a band |
| `FeaturedBanner` | `banner`, `className?` | One link. `image_url` art (`object-right`, eager, high priority, `alt=""`) under a gradient from `surface-deep/95` through `surface-deep/70` at 45% to transparent at 70%; title, tagline (only from `xl`; hidden from `lg` to just under `xl`, where it would run over the art's subject), `Price` `lg`, and the CTA as yellow button text, all DOM text. Broken art drops out, text stays |
| `BannerSideTile` | `banner`, `className?` | One link on `surface-deep`: title, `Price`, CTA pill on the left, the 2:3 product cover on the right |
| `CompactFeaturedBanner` | `banner` | Below `lg` only. One link to the product, named by its visible text: title (extrabold, `text-xl`, `sm:text-3xl`), `Price` (`md`), and the CTA as a `primary` `md` button label; no tagline. Same `image_url` art as `FeaturedBanner` (eager, high priority, `alt=""`, hover zoom `motion-safe`). Below `sm`: a 2:1 art band cropped towards the subject (`object-[85%_50%]`) with a bottom fade to `surface-deep`, then a text strip pulled up over the fade (`-mt-8`): title and price left, CTA right. From `sm`: `h-64`, art fills the frame (`object-right`) under the `surface-deep/95` left gradient, text in a left column of at most 45%. Broken art: below `sm` the band is removed, from `sm` the gradient stays; text and link stay |
| `PlatformShortcuts` | none | `<nav aria-label="Shop by platform">` under the hero: All games and the four platforms, generic lucide icons (never brand logos), scrolls inside itself on phones |
| `ProductRailBlock` | `title`, `query` | Best sellers and Deals. From `md` a `ScrollRail` of 200px `ProductCard`s; below `md` a list of horizontal cards: the first 4, then a centred secondary "Show all" (`aria-expanded="false"`, `aria-controls` the list) that reveals the rest and focuses the 5th card. Expanded state survives a resize |
| `HomePageSkeleton` | none | `HeroSkeleton` (split or compact, by viewport) and one band of 6 card placeholders while the layout loads |

### Store (`src/components/store/`)

| Component | Props | Notes |
|---|---|---|
| `StoreFilterPanel` | `params`, `options` (`loading`, `error` with `onRetry`, `ready` with the catalog filters), `onChange(next)` | Three `<fieldset>`s with a `font-extrabold` `<legend>`, each in its own `surface` panel from `lg`: Platform and Region (one `Checkbox` per option; ticking appends to the list), Price (EUR). Loading shows skeleton rows; error replaces only Platform and Region with "Filters could not load." and a secondary Try again |
| `PriceRangeFields` | `min`, `max` (whole euros or null), `onApply(min, max)` | Two `TextField`s, "Min" and "Max", `inputMode="numeric"`. Apply on blur or Enter; empty removes the bound. Inline errors "Enter a whole number from 0 to 10000" and "Min must not exceed max" (on Min) apply nothing. Drafts reset whenever the URL bounds change |
| `ActiveFilterChips` | `params`, `options?`, `onChange(next)` | One chip button per platform, region, price range, and search, named "Remove filter: <label>": `surface` with an `fg-muted` border, hover `surface-deep`, label truncated by CSS. Ghost "Clear all" when platform, region, price, or a non default sort is set (keeps `q`). Renders nothing with nothing to show |
| `FiltersButton` | `count`, `onClick?`, `ref?`, `expanded?` | Rounded pill on `surface-deep`, "Filters" with a `cta` count badge above 0, named "Filters, N active" |
| `SortSelect` | `value`, `query`, `onChange(sort)` | Select only combobox (WAI-ARIA APG). Trigger: `<button role="combobox">` named "Sort by" plus the current label, `ArrowDownWideNarrow` icon, label in extrabold `cta` (hover `cta-hover`), chevron that turns when open, 44px tall. Popup: `role="listbox"` below the trigger, right aligned, on `white` with `shadow-lg`, options at least 40px tall in `surface-deep` text, highlighted row on `fg-soft`, selected row in extrabold `bg` with a check icon. Options from `sortOptions(query)` (Relevance only with a search). Focus stays on the trigger (`aria-activedescendant`; the list prevents `mousedown`). Closed: ArrowDown, ArrowUp, Enter, Space open at the selected option, Home and End at the first and last. Open: arrows move without wrapping, Home and End jump, Enter and Space pick, Escape closes, Tab or a click outside closes with no change. Re picking the current sort calls nothing |
| `FiltersDialog` | `activeCount`, `total`, `children` (the panel) | Below `lg` only. Native `<dialog>` with `showModal()`, full height on `bg`, `black/60` backdrop (right sheet from `sm`), header "Filters" with an icon close button, footer primary "Show N results". Every close goes through the native `close` event, which returns focus to the Filters button. Page scroll is locked while open |

The store page shows the panel in a left sidebar from `lg` and in the dialog below it, picked by `matchMedia("(min-width: 1024px)")`, so the fields exist only once. Above the results, one toolbar row holds the result count (`resultCountLabel`: "1 result" / "N results", polite live region) on the left from `lg`, or the Filters button below `lg`, and the single `SortSelect` on the right at every width. Below `lg` the count sits on its own line under the chips.

### Checkout progress (`src/components/checkout/Stepper.tsx`)

`Stepper` (`current` 1, 2, 3) is an `<ol aria-label="Checkout progress">`: Cart, Payment, Done. The current step has `aria-current="step"` and a `cta` circle; completed steps show a `success` check and hidden ", completed"; later steps are `fg-muted`. Below `sm` only the current label shows. On step 2 the completed Cart step links to `/cart`. Used by `CheckoutHeader` and on the order page right after paying (step 3).

### Cart (`src/components/cart/`)

| Component | Props | Notes |
|---|---|---|
| `AddToCartButton` | `offerId`, `stock`, `context?`, `size?` (`md`, `lg`), `className?` | Primary `Button`. `context` is screen reader only text ("from Loot Lane") so each offer's button has its own name. Signed in, only the clicked button shows `loading`. Success toast "Added to cart." with a "View cart" action; a 422 shows the server message as an error toast, anything else "Could not add to cart. Please try again." Never rendered for an out of stock offer |
| `QuantityStepper` | `value`, `max`, `itemName`, `disabled?`, `onChange` | Bordered group named "Quantity for {item}". Minus and plus are 44px, named "Decrease/Increase quantity of {item}", and use `aria-disabled` (not `disabled`) at 1 and at `max` so focus stays put. The value is an `aria-live="polite"` span |
| `CartLineRow` | `line`, `onRemoveStart`, `onRemoveFail` | `<li>` on `surface`: cover, name link, platform and region, "Sold by {seller}", stepper, line total as `Price` plus unit price, Remove icon button ("Remove {name}", toast "Removed from cart."). Reduced line: `fg-soft` note "Only N available, so we lowered the quantity." Unavailable line: name in `fg-muted`, "No longer available", Remove only, no line total. Controls are locked while that line's request runs |
| `CartSummary` | `cart` | `<section>` on `surface`, sticky from `md` (at `--header-h`): item count, Total, `lg` Checkout link. When `can_checkout` is false, a disabled Checkout `Button` described by the note "Remove unavailable items to continue." |
| `CartPageSkeleton` | none | Loading stand in for the lines and the summary |

The cart page is one column below `md`, lines and summary side by side from `md`. After a Remove, focus moves to the next row's Remove button, or to the `<h1>` once the cart is empty (`src/lib/cartFocus.ts`).

Money is always integer cents (`Money` in `src/lib/money.ts`) and is only ever shown through `formatPrice`.

### Orders (`src/components/orders/`)

| Component | Props | Notes |
|---|---|---|
| `OrderItemRow` | `item`, `children?` | `<li>` on `surface`: cover, name link, platform and region, seller, quantity × unit price, line total. `children` (the key slots) render under the details |
| `OrderKeys` | `item`, `keys` (from `useOrderKeys`) | `<ul>` named "Keys for {product}" with one `KeySlot` per unit, then the `fg-soft` line "Redeem this key on {platform}." ("these keys" above 1) |
| `OrderSummaryRow` | `order` (`OrderSummary`), `fromPage` | `<li>` holding one link to `/orders/{ulid}` (router state `{ fromPage }`) on `surface`, hover `surface-deep`: first cover (`alt=""`), first product name plus `fg-soft` "and N more products", `fg-muted` "N items · date · #ABCD1234", a `success` outline "Paid" badge, and the total `Price` |
| `OrderListSkeleton` | none | Three rows with the summary row's shape |
| `KeySlot` | `label`, `code?`, `state` (`masked`, `pending`, `revealed`), `error?`, `onToggle`, `onRetry`, `onCopied` | `<li>` on `surface-deep`. Masked: fixed `•••••-•••••-•••••` in `fg-muted` mono, named "Key hidden". One secondary toggle (Reveal key, Revealing… as `loading`, Hide key) that keeps focus; accessible names like "Reveal key 2 of 3 for Hades". Revealed: the code in a mono `<code>` (`text-sm`, `text-base` from `sm`; one line, never wraps, selectable) and an icon only ghost Copy button (clipboard icon, check icon for 2 s; the accessible name carries "Copy" or "Copied"). A code wider than its box scrolls inside itself: it then becomes focusable (`tabIndex` 0, so arrow keys scroll it) and fades at the right edge (`mask-r-from-75%`) until scrolled to the end. The Copy button has a small `aria-hidden` tooltip above it (`white` with `surface-deep` text) reading "Copy" on hover or keyboard focus and "Copied" for the 2 s after a copy (visible without hover, so touch gets it too); Escape hides it until the pointer leaves or focus moves. Copy failure selects the code and shows an `fg-soft` hint. Error: `danger` text with `role="alert"` and a ghost "Try again" |

## Do's and don'ts

- Do use token utilities only. No hex values or `[#...]` in components or pages.
- Do use native `<a>`, `<button>`, `<input>`, `<select>`. No clickable `<div>`.
- Do give every icon only control an `aria-label`, and every decorative icon `aria-hidden="true"`.
- Don't put `fg-muted` text on `panel`.
- Don't use `danger-bg` as text or a border on purple.
