# 0015. Visual fidelity and polish against the Eneba references

**Date**: 2026-11-14
**Status**: Accepted

## Summary

This spec brings the existing client close to the Eneba desktop and mobile screenshots in `docs/reference/`, without changing any behaviour, route, or API shape. It changes one shared price style and one shared product card (used on every page), tidies the header into one row from `md` up, adds a homepage row of platform shortcuts, and replaces the homepage hero with a split layout: one wide featured slot plus two side tiles on desktop, and one compact featured banner with the same art below `lg`. The featured slot uses a new text free Cyberpunk 2077 image that the backend seeds into the existing banner `image_url`, while every word, price, and button stays real React text. Cart and checkout get Eneba's focused header with a three step progress bar.

## Requirements

**User stories**:
- As a shopper, I want the store to look and feel like Eneba, so that it reads as a real, trustworthy marketplace.
- As a shopper on a 360px phone, I want every page to fit the screen and every control to be easy to tap, so that I can buy without zooming.
- As the reviewer of this assignment, I want recognizable Eneba styling on the full purchase journey, so that the brief's styling requirement is clearly met.
- As the developer, I want one shared price style and one shared card, so that the look stays consistent and is changed in one place.

**Acceptance criteria**:

Shared visual system

- **AC-1**: In `client/src/index.css`, the `price` token is renamed `accent` (value stays `#3ddcb3`) and a new `saving` token is added (`#9be15d`). `discount` and `discount-bg` are deleted once nothing uses them. `client/design.md` lists both tokens and adds a contrast row for every new text pair: `saving` on `bg` 6.7:1, on `surface` 8.5:1, on `surface-deep` 11.0:1, on `panel` 5.2:1; `accent` rows keep their current numbers under the new name. The table also gains `cta` on `surface` (nav current link) and `fg-muted` on `surface` (struck price). Every text pair is at least 4.5:1. Every use of `text-price` and `ring-price` moves to the new tokens, including `CartLineRow`, `CheckoutLineRow`, and `OrderItemRow`.
- **AC-2**: `Price` becomes a column (`inline-flex flex-col`). When discounted, its first line shows the struck list price in `fg-muted` (`md` = `text-xs`, `lg` = `text-sm`, with the existing visually hidden "was ") followed by `-NN%` as plain extrabold `saving` text, with no pill. The second line is the current price in `fg`, extrabold (`md` = `text-lg`, `lg` = `text-3xl`). `price: null` still renders "Out of stock". Every existing caller keeps working without prop changes.
- **AC-3**: `ProductCard` (vertical) shows, top to bottom: the cover (2:3, as today) with a platform strip overlaid on its bottom edge (an absolutely positioned `black/70` band, `py-1`, platform name in `text-xs` semibold `fg`, centred), the name (2 lines max), the region name in extrabold `text-xs` `accent` uppercased by CSS (`uppercase`, so the DOM text keeps its case), "From" (only when priced), and `Price`. The card is one link to `/products/<slug>` as today. On hover and on keyboard focus it shows a 1px inset `accent` ring (replacing today's `hover:ring-price`). Its accessible name still contains the product name.
- **AC-4**: `ProductCard` (horizontal, used in mobile lists) shows the same parts: the 2:3 thumbnail at `w-20` with the platform strip on it, then name, region, "From", `Price`. No action buttons are added to any card. Both skeletons match the new heights.

Header and navigation

- **AC-5** (amended 2026-11-14): From `md` (48rem) up, the header is a single row: wordmark, search (`flex-1`), Store link (`LayoutGrid` icon plus the visible label "Store"), cart link with badge, and account ("Sign in" text when signed out, else the account menu). There is no second navigation row and no `<nav aria-label="Primary">`; platform links live only in the homepage shortcuts (AC-7). The Store link has the accessible name "Store" and is current (yellow `cta` text, `aria-current="page"`) whenever the path is `/store`, whatever the query; on any other path it is not current. Every header control is at least 44px tall.
- **AC-6** (amended 2026-11-14, 2026-11-15): Below `md`, the header keeps two lines: line 1 holds the wordmark and an `ml-auto` group of three icon links of at least 44 by 44px in this order: Store (`LayoutGrid` icon, accessible name "Store", label hidden), cart (unchanged name such as "Cart, 1 item"), account (unchanged); line 2 is the search field at full width (`order-last w-full`). Line 1 never wraps at 360px. The whole header stays sticky. Its height is exposed as one CSS variable `--header-h` on `:root`, with one value below `md` (both lines, today `7.5625rem`) and one from `md` (the single row, today `4.3125rem`). On `/cart` and `/checkout`, `AppLayout` renders `CheckoutHeader` (AC-18) instead, which is one row at a fixed 69px at every width and carries `data-header="checkout"`; the rule `:root:has([data-header="checkout"])` sets `--header-h` to `4.3125rem` at every width there, so the sticky offsets and scroll padding follow the header actually shown. The shop header values above are unchanged. Every sticky offset in this spec, the `CartSummary` and `CheckoutSummary` sticky tops, and `html` `scroll-padding-top` read it. The `html` `scroll-padding-top` is the only offset for in page jump targets such as `#offers` (AC-16); targets add no `scroll-mt` of their own. Whenever the header's padding, control size, or search height changes, both values are updated in the same change.
- **AC-7**: On the homepage, directly below the hero, a `<nav aria-label="Shop by platform">` shows a plain list (not `ScrollRail`) of five icon plus label links: All games `Gamepad2` (`/store`), Steam `Monitor` (`/store?platform=steam`), PlayStation `Gamepad` (`/store?platform=playstation`), Xbox `Joystick` (`/store?platform=xbox`), Nintendo `Puzzle` (`/store?platform=nintendo`), built from the shared `PLATFORM_LINKS` list in `lib/platformLinks.ts`. Icons are `lucide-react`, never brand logos. At 360px the list scrolls sideways inside itself (`overflow-x-auto`) and the page does not. Each link is at least 44px tall.

Homepage hero

- **AC-8**: From `lg` up, the `banners` block renders a split hero inside the page `Container`: a grid with a featured slot (2 parts wide) and a side column (1 part) holding two stacked tiles, total height 22.5rem. The featured slot uses the **first** banner, the tiles the second and third. Banners after the third are not shown on desktop. The visually hidden `<h2>` with the layout title stays. While loading, `lg` and up shows a matching split skeleton (one 22.5rem block, 2:1 grid), and below `lg` a compact skeleton matching AC-11 (a 2:1 art block plus a text strip below `sm`, one `h-64` block from `sm`), chosen by the same hook as AC-11, so nothing jumps when data arrives. The first paint of the art still waits on the banners API call; this is accepted.
- **AC-9** (amended 2026-11-15): The featured slot (`FeaturedBanner`) is one link to `/products/<slug>` whose accessible name is its visible text. It shows `banner.image_url` as `object-cover object-right` art with `alt=""`, `loading="eager"` and `fetchPriority="high"`, under a left to right gradient from `surface-deep/95` to transparent at 60%. On the left, in a text column of at most 26rem: the banner title (extrabold, `text-3xl`, `text-4xl` from `xl`), the tagline (`fg-soft`, 2 lines max, shown only from `xl` (1280px) and hidden from 1024px to 1279px, where the narrower slot puts it over the art's subject), `Price` at size `lg`, and the CTA label rendered as real text styled as the yellow `cta` button. No text is baked into the art. On an image error, `FeaturedBanner` drops the `<img>` (local state) and keeps the gradient on a `surface-deep` background, so the text stays readable.
- **AC-10**: Each side tile (`BannerSideTile`) is one link to its product with its visible text as its name: a `surface-deep` panel with the product cover (`banner.product.cover_image_url`, 2:3, right side, decorative), and on the left the title (2 lines max), `Price`, and the CTA as a yellow pill. With 2 banners the single tile spans both rows (`row-span-2`); with 1 banner the featured slot spans the full width; with 0 the existing empty handling applies (spec 0014).
- **AC-11** (amended 2026-11-14): Below `lg` (1024px), the block renders one compact featured banner (`CompactFeaturedBanner`) from the **first** banner only, using the same `banner.image_url` art and the same banner data as the desktop featured slot. It is one link to `/products/<slug>` named by its visible text: the title, `Price` (default size), and the CTA label as real text styled as the yellow `cta` button. The tagline is not shown at these widths. The art is `alt=""`, `loading="eager"`, `fetchPriority="high"`. Below `sm` (640px) the art is a 2:1 band cropped towards the subject (`object-[85%_50%]`), under a bottom to top fade, with the text in a compact strip below it (title and price on the left, CTA on the right). From `sm` to just under `lg` the banner is `h-64`, the art fills it (`object-right`), and the text sits in a left column of at most 45% over the same left to right gradient as AC-9. There is no carousel, no scroll controls, no portrait rail, and no extra art; banners after the first are not shown below `lg`. Loading shows the compact skeleton (AC-8); error and empty use the existing block handling (spec 0014); on an image error the art is dropped (the band disappears below `sm`, the gradient stays on `surface-deep` from `sm`) and the text and link stay. At 1024px and up the split hero (AC-8 to AC-10) is unchanged. Only one of the two layouts is mounted at a time, chosen by `useMediaQuery("(min-width: 64rem)")`; tests stub `matchMedia` to reach the desktop branch.
- **AC-12** (amended 2026-11-14): `server/database/data/home.php` puts the `cyberpunk-2077-xbox-europe` banner at position 1 (the other banners keep their relative order after it) and gives it `'image' => 'images/banners/cyberpunk-2077-featured.webp'`. `HomeSeeder` checks `public_path($image)` exists before it writes anything, failing with a clear message naming the path when it is missing; it then sets `image_url` to `url($image)` (built from `config('app.url')`) when `image` is present, else to the product's `cover_image_url`. `HomeSeedersTest` keeps its intent: the other banners still equal their cover URL, and the featured one equals `url('images/banners/cyberpunk-2077-featured.webp')`. The `/home/banners` response shape is unchanged. The asset is committed, text free, exactly 3:1, WebP, at most 300 KB, with the subject in the right 55% of the frame. The committed file is 2172 by 724px and 249 KB; this is an approved deviation from the original 2400 by 800 minimum, so 2172 by 724 is the accepted minimum for this asset. `docs/reference/desktop/main_hero.png` is not used or committed.

Store and search

- **AC-13** (amended 2026-11-14): From `lg` up, each filter group (Platform, Region, Price) sits in its own `surface` panel with its heading. Above the grid, one toolbar row shows the existing result count copy from `resultCountLabel` ("1 result", else "N results", N from the response `meta.total`; empty while loading; "0 results" with the existing empty state) in a polite live region on the left, and the sort control on the right. Below `lg` the same toolbar row holds the Filters pill (AC-14) on the left and the sort control on the right, and the count shows on its own line under the chips. There is only one sort control in the DOM at any width. The sort control replaces spec 0012 AC-6's native "Sort by" `Select` with a custom `SortSelect`, a select only combobox following the WAI-ARIA APG pattern: a `<button role="combobox">` named "Sort by" plus the current label, with an `ArrowDownWideNarrow` icon, the current label in yellow `cta` extrabold text, and a chevron that turns when open; it controls a `role="listbox"` popup of `role="option"` rows (white panel, `surface-deep` text, the highlighted row on `fg-soft`, the selected row in `bg` extrabold with a check icon). Focus stays on the trigger while open (`aria-activedescendant`, and the list prevents `mousedown`). ArrowDown, ArrowUp, Enter, and Space open it at the selected option; Home and End open at the first and last; while open, the arrows move (no wrap), Home and End jump, Enter and Space pick, Escape closes, and Tab or a click outside closes without a change. Picking the current sort again reports no change. The options and their order are unchanged (spec 0012 AC-6, spec 0013 AC-11: Relevance only with a search). Every colour pair it uses is in the `design.md` contrast table. `ProductGrid` shows 2 columns, then 3 from `md`, then 4 from `xl` (the 5 column step is removed). Filter, sort, search, pagination, and URL behaviour are unchanged.
- **AC-14**: Below `lg`, the Filters button becomes a rounded pill on `surface-deep`; its visible count stays the existing `activeFilterCount` badge, and its accessible name is unchanged, so existing tests still find it. The sort control (AC-13) sits in the same toolbar row as the pill, on the right. The filters dialog is unchanged.

Product page

- **AC-15**: From `lg` up, the product page has two columns: the main column (a breadcrumb `<nav aria-label="Breadcrumb">` Home › Store › product name with the last item `aria-current="page"`; the cover beside the title block; info rows; All offers; About) and a right column of 20rem holding the buy box, sticky at `top: calc(var(--header-h) + 1rem)`. Below `lg` the order is breadcrumb, cover and title, buy box, info rows, offers, About. The breadcrumb's Store link is plain `/store`, and the breadcrumb renders only once the product has loaded. The `<h1>` and the loading, error, and not found states stay as they are; `ProductPageSkeleton` matches the two column layout. The current `ProductHero` is split into the title block and the buy box; it is not kept as one component.
- **AC-16** (amended 2026-11-15): The buy box (on `surface`) shows "Best offer", `Price` at size `lg`, "Sold by <seller>" (the offer whose `id` equals `best_offer_id`), the existing add to cart control, and, when at least one other offer is in stock, a link "+N offers from €X" (at least 44px tall) that jumps to the All offers section. N is the number of offers other than `best_offer_id` with `stock > 0`; X is the lowest price among them: offers are compared by their numeric `price.amount` (integer cents), and the winner is formatted with the existing `lib/money` `formatPrice` helper (the `lib/money` helpers format; they do not compare). The link is hidden when N is 0. When `best_offer_id` is null, the box shows "Out of stock" and hides "Sold by", the add to cart control, and the link. The offers section gets `id="offers"` and no `scroll-mt` of its own: the `html` `scroll-padding-top` (AC-6) already sets the jump offset, and a scroll margin would add to it and double the gap. After the jump, the section lands visibly below the sticky header.
- **AC-17**: The title block shows three info rows for every product type, built only from real data, each an icon plus two lines: Platform ("Activate on <platform>"), Region ("<region> key"), and Digital key ("Revealed on your order page right after payment"). No other claims (no refunds, no ratings, no watchers).

Purchase journey

- **AC-18**: The router gives `/cart` `handle: { checkoutStep: 1 }` and `/checkout` `handle: { checkoutStep: 2 }` (merged with its existing `requiresAuth`). `AppLayout` reads the deepest match's `checkoutStep` with `useMatches()` and, when set, renders a new `CheckoutHeader` instead of `Header`, in every state of those routes (loading, error, ready). `CheckoutHeader` holds the wordmark (a link home) and a `Stepper` (`<ol>`, props `current`) with three steps, Cart, Payment, Done. The current step has `aria-current="step"`; completed steps show a check icon in `success` plus visually hidden text ", completed"; later steps are muted. On `/checkout` the completed Cart step is a link to `/cart`. At 360px every step shows its number or icon, and only the current step shows its label. Search, the Store link, cart link, and account are not shown on these two routes. The skip link and footer are unchanged.
- **AC-19**: `useArrival` in `OrderConfirmationPage` also returns its existing `justPaid` value (destructured, not spread into `PageShell`). When it is true, the loaded order view opens with the same `Stepper` at `current={3}` (Cart and Payment completed, Done current), under the normal shop header. While loading, on error, and when opened any other way, no stepper shows.
- **AC-20**: The hand written price spans in `CartLineRow`, `CheckoutLineRow`, and `OrderItemRow` are replaced by `<Price>`; the cart summary, checkout summary, and order rows use the shared `surface` panel style. Their controls and copy are unchanged, and at 360px no row's controls wrap below the taller price block.

Auth and orders

- **AC-21**: The auth page and the orders list change only through the shared tokens, `Price`, and panel style. Their layout and copy are unchanged. The orders page does not adopt Eneba's light account theme.

Guards

- **AC-22**: No route, loader, action, API call, query key, or form behaviour changes. All existing Vitest and Pest tests pass. The only test edits allowed are for seeded banner order and `image_url` (AC-12), for the hero layout below `lg` (AC-11), and for driving the custom sort control by clicking its option instead of `selectOptions` on a native select (AC-13), and each such edit keeps the original assertion's intent (the same sort values, URLs, and history pushes). (No header test exists today; new tests cover the new header behaviour.)
- **AC-23**: At 360px wide, `document.documentElement.scrollWidth` is at most 360 on home, store, search, product, cart, checkout, confirmation, login, and orders. Every new link or control (including breadcrumb links and the "+N offers" link) is reachable with Tab in visual order, shows the visible focus ring, and is at least 44px tall on touch layouts. Any new transition is off under `prefers-reduced-motion`; the existing banner hover zoom keeps its `motion-safe` guard.
- **AC-24**: `docs/reference/` screenshots, `main_hero.png`, and the new comparison screenshots stay out of git: `.gitignore` keeps its existing `docs/reference/desktop/` and `mobile/` rules and adds `docs/reference/current/`, and `git check-ignore` reports every file under all three.
- **AC-25**: `docs/specs/0015-visual-fidelity-polish/verify.md` holds a checklist pairing each reference screenshot with a current screenshot at 1440 by 900 and 360 by 780 for every page in AC-23, saved under `docs/reference/current/`, with each AC marked pass or fail. Fidelity means "close, not pixel perfect": same structure, colours, type weight, and states.

## Decision

**Chosen option**: Option 2: Split featured hero with text free generated art, plus shared component polish.

Polish in place through the shared tokens, `Price`, `ProductCard`, and header, and replace the hero's desktop layout with a split featured hero fed by the existing banners endpoint, using a new text free Cyberpunk 2077 image seeded into `image_url`.

**Implementation skills**: `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`)

## Rationale

Reasoning, options, the reference inventory, the full audit, and the hero evaluation: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no schema change. `banners.image_url` (string 2048, existing) now holds either a product cover URL or an absolute URL to a file in `server/public/images/banners/`. `home.php` banner entries gain an optional `image` key (path relative to `server/public/`).

**API surface**: unchanged. `GET /api/v1/home/banners` still returns `{ data: { id, title, tagline, cta_label, image_url, product }[] }`; only the seeded values and order change.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Featured slot, compact featured banner | art | `banner.image_url` of the first banner (seeded, AC-12) |
| Featured slot, side tiles | title, tagline, CTA text | `banner.title`, `banner.tagline`, `banner.cta_label` |
| Compact featured banner | title, CTA text (no tagline) | `banner.title`, `banner.cta_label` of the first banner |
| Featured slot, compact banner, tiles, cards | price, list price, percent off | `product.price`, `product.list_price`, `product.discount_percent` |
| Side tiles | art | `banner.product.cover_image_url` (non null) |
| Store toolbar | "1 result" / "N results" | `resultCountLabel(meta.total)` |
| Store sort control | options, current label | `sortOptions(q)` and `STORE_SORTS` in `lib/storeParams.ts` |
| Store Filters pill | count | existing `activeFilterCount(params)` |
| Buy box | seller name | the offer whose `id` equals `best_offer_id` |
| Sticky offsets, `html` `scroll-padding-top` | header height | CSS variable `--header-h` (AC-6) |
| Which banner is featured | first item | response order (`banners.position`, then `id`, spec 0014) |
| Product card | platform strip, region label | `product.platform.name`, `product.region.name` |
| Shortcut links | platform slugs | `PLATFORM_LINKS` (`steam`, `playstation`, `xbox`, `nintendo`), matching the seeded `platforms` (spec 0004) and the store `platform` param (spec 0012) |
| Header Store link current state | current or not | `useLocation().pathname === "/store"` |
| Buy box | "+N offers" count | offers with `id !== best_offer_id` and `stock > 0` |
| Buy box | "from €X" | lowest `price` among those offers, formatted by `formatPrice` |
| Info rows | platform, region | `product.platform.name`, `product.region.name` |
| Stepper | current step | route handle `checkoutStep` read with `useMatches()` (1 on `/cart`, 2 on `/checkout`); on `/orders/:ulid`, `justPaid` returned by `useArrival` |
| Featured art URL | absolute URL | `url()` in `HomeSeeder`, from `APP_URL` |

**Key invariants**:
- Every word a user reads in the hero is DOM text, never part of an image.
- Each banner, card, and shortcut is exactly one link; no link nests another interactive element.
- Only one hero layout is mounted at a time (`useMediaQuery("(min-width: 64rem)")`, the existing hook), so the accessibility tree never lists a banner twice.
- No colour outside the `@theme` tokens; every new text pair is in the `design.md` contrast table.
- Platform links only point at platforms that exist in the seed.

**Security model**: no change. All new links are public pages; the focused checkout header does not change any auth guard (`requireAuth` on `/checkout` and `/orders/:ulid` stays).

**Configuration required**:
- `APP_URL` (existing, server): must be the public API origin in Render, because the featured art URL is built from it at seed time.

**Critical test scenarios**:
- Discounted price shows struck list price and `-NN%` above the current price; undiscounted shows only the price; null shows "Out of stock", verifies **AC-2**
- Card link name contains the product name and the region text renders uppercase, verifies **AC-3**
- Header has no second navigation row; Store link is current on `/store` and not elsewhere; cart name unchanged, verifies **AC-5**
- Split hero renders featured plus two tiles from 3+ banners, featured plus one from 2, featured only from 1, verifies **AC-8**, **AC-10**
- Featured art load error keeps the text, verifies **AC-9**
- Featured tagline carries `hidden xl:line-clamp-2`, verifies **AC-9**
- The `#offers` section has no scroll margin class, verifies **AC-16**
- Below `lg` only the first banner shows, as one link with the featured art, no tagline, no carousel controls, price with discount, and art error keeps text and link; from `lg` only the split hero mounts, verifies **AC-11**
- Sort control: named "Sort by" plus value, Relevance only with a search, click and keyboard picking, no change on re pick, Escape, Tab, and outside click, verifies **AC-13**
- `HomeSeeder` puts Cyberpunk first with an absolute `image_url`, and fails clearly when the file is missing, verifies **AC-12**
- "+N offers from €X" counts only in stock non best offers and hides at 0, verifies **AC-16**
- `/cart` shows step 1 current and no search box; `/checkout` step 2 with Cart linking back; confirmation with `justPaid` shows step 3 once loaded, without it no stepper, verifies **AC-18**, **AC-19**
- Buy box with `best_offer_id: null` shows "Out of stock" and no seller, add control, or offers link, verifies **AC-16**
- Full existing suites green, verifies **AC-22**
- Playwright MCP pass at 360px: no sideways scroll, Tab order, focus ring, verifies **AC-23**

## Build plan

The project builds by **Journey**. Shared parts every journey depends on come first, then each user path is finished, with all its states, before the next one starts.

0. Before starting: resolve the uncommitted `ScrollRail.tsx` edit (`[scrollbar-none]` is not a valid arbitrary property). The hero no longer uses `ScrollRail` (AC-11 amended), but product rails do.
1. Rename `price` to `accent` in `index.css` and every `text-price`/`ring-price` use (including `CartLineRow`, `CheckoutLineRow`, `OrderItemRow`), add `saving`, delete `discount` and `discount-bg`, update `design.md` tokens and contrast rows; add `docs/reference/current/` to `.gitignore`, satisfies **AC-1**, **AC-24**
2. Restyle `Price` as a two line column with unit tests for the three states, satisfies **AC-2**
3. Restyle `ProductCard` vertical and horizontal plus their skeletons, satisfies **AC-3**, **AC-4**
4. Journey 1, browse from home. Single row header from `md`, Store link current state, mobile icon line with search below, `--header-h` values matching both header heights, with new header tests, satisfies **AC-5**, **AC-6**
5. Split hero (`FeaturedBanner`, `BannerSideTile`, split skeleton), the `lg` switch in `HeroBanners`, `CompactFeaturedBanner` and its skeleton below `lg`, tests for 1 to 3 banners, the compact layout, and image errors (with `matchMedia` stubbed). This works on today's seed data, so it does not wait for the art, satisfies **AC-8**, **AC-9**, **AC-10**, **AC-11**
6. Platform shortcut row under the hero, satisfies **AC-7**
7. Once the developer supplies it, commit `server/public/images/banners/cyberpunk-2077-featured.webp`, then update `home.php` and `HomeSeeder` plus `HomeSeedersTest` and `BannersTest`. The build pauses here if the file is not there yet, satisfies **AC-12**
8. Journey 2, find and compare. Store panels, toolbar with the result count and one custom `SortSelect` combobox (with its own tests and contrast rows), grid columns, mobile filter pill, satisfies **AC-13**, **AC-14**
9. Product page two column layout, breadcrumb, info rows, split of `ProductHero`, sticky buy box with "+N offers from €X" and its out of stock state, `id="offers"`, skeleton, satisfies **AC-15**, **AC-16**, **AC-17**
10. Journey 3, buy. Route handles, `CheckoutHeader` chosen in `AppLayout`, `Stepper`, `justPaid` from `useArrival` with the confirmation stepper, `<Price>` in the three row components and the panel style, sticky summaries on `--header-h`, satisfies **AC-18**, **AC-19**, **AC-20**
11. Journey 4, account. Auth and orders token and panel pass, satisfies **AC-21**
12. Run all client and server checks; Playwright MCP pass at 1440 and 360 for every page; write `verify.md` with paired screenshots, satisfies **AC-22**, **AC-23**, **AC-25**

## Migration plan

**Strategy**: no schema migration; one production reseed of home banners.
**Phases**:
1. Merge with the committed art; Render and Vercel deploy from `main`.
2. Run the home seeder on production (`php artisan db:seed --class=HomeSeeder`), which reorders banners and sets the featured `image_url`.
**Rollback**: revert the merge commit and run the home seeder again; the old seed data restores the previous order and cover URLs.
**Risks**: between deploy and reseed, desktop shows the old banner 1 (Elden Ring) in the featured slot with its portrait cover cropped wide; keep that window short.

## Consequences

**Positive**:
- The purchase journey reads as Eneba from the first screen, which is what the brief grades.
- Price and card styling live in one place each, so later tweaks touch one file.
- The hero stays fully data driven and accessible; the art can be swapped by changing one seed entry.

**Negative / tradeoffs**:
- Banners after the third are not shown at any width, and below `lg` only the first banner shows. They stay in the seed and the API, so a later layout can bring them back.
- Below `lg` the tagline is dropped to keep the compact banner short; the title, price, and CTA carry the message.
- The header no longer links to each platform; shoppers reach a platform through the homepage shortcuts or the store filters.
- Replacing the mint price with white loses the "price pops in colour" cue that spec 0003 chose; `saving` green now carries that signal only for discounts.
- The featured art is a committed binary (up to 300 KB) that someone must regenerate if the featured product changes.
- Hiding search and account on cart and checkout means a shopper must click the wordmark to leave the checkout flow.
- The featured art URL depends on `APP_URL` at seed time; a wrong value gives a broken image (the text still shows).

**Neutral**:
- Spec 0003's `price` token, spec 0014 AC-10's portrait rail, and spec 0012 AC-6's native sort `Select` are partly replaced by this spec.
- Render serves the art from `public/` through the existing NGINX image; no new hosting.

## Follow-up

- [x] Developer supplies `cyberpunk-2077-featured.webp` (text free, 3:1, subject on the right, at most 300 KB); supplied at 2172 by 724 and 249 KB, accepted on 2026-11-14 (AC-12).
- [ ] After merge, reseed production home banners and confirm Render `APP_URL` is the public API origin.
- [x] `/sync`: flag spec 0003 (token `price` renamed), spec 0014 AC-10 (portrait rail replaced by the split hero and the compact featured banner), and spec 0012 AC-6 (native sort `Select` replaced by `SortSelect`) as partly replaced by this spec. Done on 2026-11-15: each of the three specs now opens with a "Partly superseded by spec 0015" note.
- [x] `/scope`: feature 16 still says "two row header" and asks for art "at least 2400 by 800"; reconcile with the amended AC-5 and AC-12. Done on 2026-11-15: the milestone names the single row header, and the art line records the supplied 2172 by 724 WebP.
