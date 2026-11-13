# 0014. Homepage blocks: a server layout endpoint, one endpoint per block, and Eneba style bands with a hero tile strip

**Date**: 2026-11-13
**Status**: Accepted

## Summary

This spec turns the homepage into blocks the server controls. A small `GET /home` call returns which blocks to show, in what order, with their titles (from a new `home_blocks` table). Each block then loads on its own from its own endpoint: a hero strip of portrait promo tiles (a new `banners` table), Best sellers (real units sold from paid orders), Deals (biggest percent off first), and the existing "Browse games" grid. Every block has its own loading, error, and empty handling, so one failing block never breaks the page. The look follows the Eneba screenshots in `docs/reference/`: full width bands in alternating colours, sideways rails on desktop, and short vertical lists on phones. A demo seeder places real orders through the real checkout code, so Best sellers is full on the public site from day one.

## Requirements

**User stories**:
- As a visitor, I want a homepage that shows featured games, best sellers, and deals, so that I can find something worth buying without searching.
- As a visitor, I want each section to load and fail on its own, so that one broken section never hides the rest of the page.
- As a visitor, I want every tile and card to open the product page, so that I can go straight from the homepage into buying.
- As the developer, I want the layout, banners, and rankings to come from the backend, so that the frontend hardcodes no content (assignment brief).

**Acceptance criteria**:
- **AC-1**: `GET /api/v1/home` returns 200 with `{ data: { type, title }[] }`: every `home_blocks` row with `is_active = true`, ordered by `position`, then `id`. `type` is one of `banners`, `best_sellers`, `deals`, `products`; `title` is the row's text. No other fields are returned. With no active rows it returns `{ data: [] }`.
- **AC-2**: `GET /api/v1/home/banners` returns 200 with `{ data: Banner[] }`, at most 10, ordered by `banners.position`, then `banners.id`. A banner is included only when its row is active and its product is active. Each item is `{ id, title, tagline, cta_label, image_url, product }`, where `product` is the existing `ProductResource` shape (`slug`, `name`, `type`, `cover_image_url`, `platform: { slug, name }`, `region: { slug, name }`, `price`, `list_price`, `discount_percent`), with `price` computed live by the existing `withCheapestPrice` scope. A banner whose product is active but sold out is still included, with `price: null` and `discount_percent: null`.
- **AC-3**: `GET /api/v1/home/best-sellers` returns 200 with `{ data: Product[] }` (`ProductResource`), at most 12. Units sold per product is `SUM(order_items.quantity)` over order items whose order has `status = 'paid'`, over all time. Only active products with units sold above 0 and a non null cheapest in stock price are included. Order: units sold descending, then `name`, then `id`. The units count is not returned. A new paid order for a product moves it on the next fetch (no server cache).
- **AC-4**: `GET /api/v1/home/deals` returns 200 with `{ data: Product[] }` (`ProductResource`), at most 12: active products whose `discount_percent` (the existing `Discount::percent(list_price_cents, cheapest_price_cents)`, whole percent rounded down) is 1 or more. Products with no list price, no in stock offer, or a cheapest price at or above the list price are excluded. Order: discount percent descending, then `name`, then `id`. The SQL percent uses the same integer arithmetic as `Discount::percent`, so the order always matches the `discount_percent` values returned.
- **AC-5**: All four endpoints are public, read only, use the existing `catalog` limiter (120 per minute per IP, 429 with `Retry-After` beyond it), ignore every query param, and never return 404 for an empty result. They are GETs, so Vercel previews may call them. Each runs a fixed number of queries regardless of result size (no N+1: platform, region, and product are eager loaded): `/home` 1, `/home/banners` 4 (banners, products with cheapest price, platforms, regions), `/home/best-sellers` 3 and `/home/deals` 3 (main query, platforms, regions). The Pest tests assert the exact counts the build produces and that they are equal for 1 and 12 results.
- **AC-6**: `HomeSeeder` (called by `DatabaseSeeder` after `CatalogSeeder`) upserts the layout by `type`: `banners` "Featured" (1), `best_sellers` "Best sellers" (2), `deals` "Deals" (3), `products` "Browse games" (4). It upserts 8 banners by `product_id` from `server/database/data/home.php` (product slug, title, tagline, CTA label, position), with `image_url` copied from that product's `cover_image_url`. Updates change content columns only; `is_active` is set on insert only, so a row hidden by hand stays hidden after a reseed. Running the seeder twice leaves the same rows. A banner slug that does not exist, or names an inactive product, fails the seeder with a clear message.
- **AC-7**: `DemoOrdersSeeder` (called by `DatabaseSeeder` after `HomeSeeder`, in every environment including production) creates the user `demo-buyer@example.com` ("Demo Buyer") with a random 64 character password on first create only, so nobody can sign in as it. From `server/database/data/demo_orders.php` it places 15 orders, each a hardcoded UUID v4 idempotency key plus a list of `[product slug, quantity]` lines (quantity 1 to 3, one line per product per order). An order whose key already exists for the demo user is skipped before the cart is touched, so reruns create nothing. Otherwise, inside one `DB::transaction`, it deletes the demo user's `cart_items`, adds each line through `AddCartItem` using the product's cheapest active offer with an available key (ordered by `price_cents`, then `id`), reads `expectedTotal` from `BuildCart::forUser($user)->totalCents()`, and calls `PlaceOrder` with `CardDetails('4242424242424242', 12, 2099, '123', 'Demo Buyer')` (approved by the simulated gateway). Any `ValidationException` or `CartChangedException` aborts the whole seed with the order key in the message, and the transaction leaves no partial cart or order. The data file only names products whose planned stock (from `OfferPlanner`) covers their total planned units, and a comment in it lists the intended unit total per product. After seeding a fresh database, `GET /home/best-sellers` returns 12 products in exactly those totals' order, and the 12 totals are all different (a clear ranking).
- **AC-8**: The home page renders a visually hidden `<h1>` "Buy game keys at the best prices" (the page's only `<h1>`), then the blocks from `GET /home` in the order received, each block's heading being that row's `title`. Types the client does not know are skipped silently. While the layout loads, the page shows a skeleton (a strip of 6 tile placeholders and one band of 6 card placeholders) and the shared "waking up the server" notice once `useSlowPending` fires. If the layout request fails, the page shows the `<h1>` plus one `ErrorState` with the `ApiError` message and "Try again"; no block renders. If the layout has no known block types, the page shows `EmptyState` "Nothing here yet" with "Check back soon.".
- **AC-9**: Each block fetches only its own endpoint (`products` uses the existing `GET /products` page 1 query) with its own TanStack Query key under `["home", ...]` (the grid keeps its `productsQuery` key), `staleTime` 60 seconds. Each block shows its own skeleton while loading. A failed block shows its title plus an `ErrorState` with "Try again" (refetches only that block) inside its own band; the other blocks are unaffected. A block whose endpoint returns an empty list renders nothing (no heading, no band). Each block is wrapped in a small `ErrorBoundary` class component (`client/src/components/ui/ErrorBoundary.tsx`, no new package), so an exception thrown while rendering one block shows that block's error state and leaves the rest of the page working. Its "Try again" refetches that block's query and resets the boundary; the boundary is also keyed on the query's `dataUpdatedAt`, so new data clears it and the same bad data never loops on a click.
- **AC-10**: The `banners` block is a full width strip of portrait tiles (no heading shown; the layout title is its visually hidden `<h2>`): a horizontally scrolling list with scroll snap, about 2.5 tiles visible below `sm`, about 3.5 from `sm`, 5 from `md`, and 6 from `lg`, no autoplay. Each tile is one link to `/products/<slug>` with a 1:2 frame showing `image_url` (`object-cover`, lazy loaded after the first 3, decorative `alt=""`; on load failure a 1:2 `surface-deep` frame with the `Gamepad2` icon, not `CoverImage`, whose frame is 2:3), a gradient over the bottom 60% from `black/90` to transparent (the text sits on its opaque part, so its contrast rows are computed against `black/90` over the darkest band), the title (extrabold, 2 lines max), the tagline (`fg-soft`, 3 lines max), the live `Price` (or "Out of stock"), and the CTA label as a yellow `cta` pill. Its accessible name is its visible text. On hover the art zooms slightly (off under reduced motion). The strip starts flush at the left page edge. From `md` up, previous and next arrow buttons ("Scroll Featured left", "Scroll Featured right") overlay the left and right edges, vertically centred, and scroll by one visible width. At an end the matching arrow gets `aria-disabled="true"` and 40% opacity and does nothing (never the `disabled` attribute, so a focused arrow keeps focus). The end check is `scrollLeft <= 1` and `scrollLeft + clientWidth >= scrollWidth - 1`. When nothing overflows, both arrows are hidden.
- **AC-11**: The `best_sellers` and `deals` blocks are bands with the title as an `<h2>`. From `md` up they show all items in one horizontal rail of `ProductCard`s (fixed width about 200px, so the next card peeks at the right edge), with the same arrow buttons as AC-10 ("Scroll Best sellers left", and so on). Below `md` they show a vertical list of `ProductCard`s in a new horizontal layout (cover left, text right): the first 4, then a centred secondary "Show all" button (`aria-expanded="false"`, `aria-controls` the list) that reveals the rest and moves focus to the 5th card's link (a `ref` passed to `ProductCard` through the React 19 ref prop, focused in an effect after the expand); the button is not shown when there are 4 or fewer. The expanded state lives in `ProductRailBlock`, so it survives a resize across `md`. Which layout renders is chosen with the existing `useMediaQuery("(min-width: 768px)")`, so the list renders once. These blocks have no "See all" link.
- **AC-12**: Blocks with a heading sit in full width bands that alternate by their order among the bands actually rendered, starting light: `bg`, then `surface-deep`, then `bg`. Alternation is pure CSS on the band sections (odd and even of the band elements inside one wrapper), so an empty or skipped block never leaves two same colour bands side by side. Each band has the content inside the shared `Container`, vertical padding about 40px (56px from `md`), and an `<h2>` at `text-2xl` (`text-3xl` from `md`) `font-extrabold`. The `products` block is the existing grid with its "See all" link to `/store`, placed in its band, with the heading text now from the layout (seeded "Browse games", so spec 0012 AC-10 still holds). `ProductCard` hover changes everywhere from `bg-surface-deep` to a 1px `price` ring on the unchanged `surface` background, and the card gains a `layout` prop (`vertical` default, `horizontal`).
- **AC-13**: At 360px the page has no sideways page scroll (only the strip and rails scroll inside themselves). Every tile, card, arrow, and "Show all" button is keyboard reachable with the global focus ring fully visible (not clipped by the scrolling container). `client/design.md` gains rows for the new components and the card hover, and its contrast table gains every new text and background pair (tile text on the gradient, the pill, the ring against both bands), all AA. `/ui` shows the tile strip, a rail, the mobile list with "Show all", the horizontal card, and a block in its loading, error, and empty states. Client checks (`format:check`, `lint`, `typecheck`, `test`, `build`) and server checks (Pint, PHPStan, Pest) pass locally and in CI. On the public deploy, after seeding production, the homepage shows Featured, Best sellers, Deals, and Browse games, and opening any tile or card leads into the purchase journey.

## Decision

**Chosen option**: Option 2: a server layout endpoint plus one endpoint per block.

`GET /home` (from `home_blocks`) tells the client which blocks to render and in what order; each block component knows its own endpoint (`/home/banners`, `/home/best-sellers`, `/home/deals`, `/products`), fetches it independently, and owns its loading, error, and empty states.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning, options, and the screenshot findings: see [rationale.md](rationale.md).

## Feature design

**Design source**: the engineer's eneba.com screenshots, `docs/reference/desktop/homepage.png` (2880px wide, full page) and `docs/reference/mobile/homepage.png` (1320px wide, full page), plus `client/design.md` tokens. What was taken from them is listed in rationale.md, *Screenshot findings*. Out of scope here (left for the site wide polish): the category nav and icon row, Recently viewed, gift card rails, wishlist hearts, cashback, and the Eneba card restyle with Add to cart.

**Data model sketch**: two new tables, no change to existing ones.

| Table | Columns | Keys and rules |
|---|---|---|
| `home_blocks` | `id`, `type` string(32) not null, `title` string(80) not null, `position` smallint not null, `is_active` boolean not null default true, timestamps | unique `type`; check `type IN ('banners','best_sellers','deals','products')`; index (`is_active`, `position`) |
| `banners` | `id`, `product_id` foreignId not null → `products`, `title` string(80) not null, `tagline` string(160) not null, `cta_label` string(30) not null, `image_url` string(2048) not null, `position` smallint not null, `is_active` boolean not null default true, timestamps | unique `product_id` (one tile per product, the seeder's upsert key); FK restrict on delete; index (`is_active`, `position`) |

- Relationships: `products` 1 : 0..1 `banners` (`Banner belongsTo Product`, `Product hasOne Banner`). `home_blocks` stands alone.
- Best sellers and deals add no tables: they read `order_items.product_id` (indexed), `orders.status`, `offers`, and `products.list_price_cents`.
- PHP enum `App\Enums\HomeBlockType` (`Banners = 'banners'`, `BestSellers = 'best_sellers'`, `Deals = 'deals'`, `Products = 'products'`), cast on `HomeBlock::type`.
- Demo orders are ordinary `orders`, `order_items`, and sold `product_keys` rows owned by the demo user.

**State transitions**: none on the server. On the client, the layout is `loading → (blocks | error | empty)`, with `error → loading` on Try again. Each block is `loading → (content | empty | error)`, with `error → loading` on Try again; a render crash moves a block to `error` through its boundary. The mobile list is `collapsed → expanded` (one way, per page view).

**API surface** (all under `/api/v1`, public, `throttle:catalog`, GET only, query params ignored):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/home` | GET | none | `{ data: { type, title }[] }` | public | 429 |
| `/home/banners` | GET | none | `{ data: { id, title, tagline, cta_label, image_url, product: Product }[] }`, max 10 | public | 429 |
| `/home/best-sellers` | GET | none | `{ data: Product[] }`, max 12 | public | 429 |
| `/home/deals` | GET | none | `{ data: Product[] }`, max 12 | public | 429 |
| `/products` (existing) | GET | none from home | page 1, 24 items, unchanged | public | 429 |

Server shape (thin controller, actions, resources), per root `AGENTS.md`:
- `HomeController` with `layout`, `banners`, `bestSellers`, `deals`; routes named `home.layout`, `home.banners`, `home.best-sellers`, `home.deals`. No Form Request (no inputs).
- Actions in `app/Actions/Home/`: `ListHomeBlocks`, `ListBanners`, `ListBestSellers`, `ListDeals`, each with a `LIMIT` constant (10, 12, 12).
- Resources: `HomeBlockResource` (`type`, `title`), `BannerResource` (fields plus `product` as `ProductResource`); best sellers and deals reuse `ProductResource::collection`.
- `ListBestSellers`: a units subquery `order_items JOIN orders ON orders.id = order_items.order_id WHERE orders.status = 'paid' GROUP BY order_items.product_id` (`SUM(quantity) AS units_sold`), joined to `Product::active()->withCheapestPrice()` as a derived table (same pattern as `ListProducts`, since Postgres cannot filter on a select alias), `WHERE cheapest_price_cents IS NOT NULL AND units_sold > 0`, ordered `units_sold DESC, name, id`, eager loading `platform:id,slug,name` and `region:id,slug,name`.
- `ListDeals`: derived table over `Product::active()->withCheapestPrice()` adding `deal_percent = ((list_price_cents - cheapest_price_cents) * 100) / list_price_cents` (integer division on integer columns, identical to `intdiv` in `Discount::percent` for these positive values), `WHERE list_price_cents IS NOT NULL AND cheapest_price_cents IS NOT NULL AND list_price_cents > cheapest_price_cents AND deal_percent >= 1`, ordered `deal_percent DESC, name, id`.
- `ListBanners`: `Banner::where('is_active', true)->whereHas('product', active)`, eager loading `product` with `withCheapestPrice()` and its platform and region, ordered `position, id`, limit 10.

Client shape:
- `src/api/home.ts`: hand written types `HomeBlock { type: string; title: string }` and `Banner { id: number; title: string; tagline: string; cta_label: string; image_url: string; product: Product }`; query option factories `homeLayoutQuery()` (`["home", "layout"]`), `homeBannersQuery()` (`["home", "banners"]`), `bestSellersQuery()` (`["home", "best-sellers"]`), `dealsQuery()` (`["home", "deals"]`), each with `staleTime: 60_000`, all through `apiFetch`.
- `src/pages/HomePage.tsx`: the hidden `<h1>`, the layout query and its states, and a `type → component` map; unknown types return nothing.
- `src/components/home/`: `HomeSection` (`title`, `headingId`, children: the band, `Container`, and `<h2>`; tone comes from CSS by DOM order inside the bands wrapper, AC-12), `HeroBanners` and `BannerTile` (AC-10), `ProductRailBlock` (one component for best sellers and deals; props `title`, `query`; AC-11), `HomeBlockError` (title plus `ErrorState`), `HomePageSkeleton`.
- `src/components/ui/ScrollRail.tsx`: the shared horizontal list (`<ul>` with scroll snap, `label` for the arrows, `items` as children) with arrow buttons from `md` up that call `scrollBy({ left: ±clientWidth, behavior: "smooth" })` (`"auto"` under reduced motion) and disable themselves at the ends (from `scrollLeft`, `scrollWidth`, `clientWidth` on scroll and resize). Used by the tile strip and both rails.
- `src/components/ui/ErrorBoundary.tsx`: a class component with `fallback: (reset: () => void) => ReactNode`.
- `ProductCard`: `layout?: "vertical" | "horizontal"` and an optional `ref` to its link, plus the ring hover (AC-12); `ProductCardSkeleton` takes the same `layout`. Both default to `vertical`, so the store grid and its skeleton render exactly as today.
- `useMediaQuery` returns false where `matchMedia` is missing (jsdom), so the mobile list is the fallback; component tests stub `matchMedia` for the desktop case. `ProductListSection` takes `title` and renders inside `HomeSection` instead of its own heading markup.
- Focus inside scrolling containers: tiles and cards use an inset focus outline (`outline-offset` negative) so the ring is not clipped by `overflow-x: auto` (AC-13).

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| `GET /home` | which blocks, their order, their titles | `home_blocks.type`, `position`, `id`, `title`, filtered by `is_active` |
| `GET /home/banners` | tile title, tagline, CTA label, art | `banners.title`, `tagline`, `cta_label`, `image_url` |
| `GET /home/banners` | tile link | `banners.product_id` → `products.slug` |
| `GET /home/banners` | tile price, list price, discount | `withCheapestPrice` (cheapest active in stock offer), `products.list_price_cents`, `Discount::percent` (via `ProductResource`) |
| `GET /home/banners` | which tiles, order, cap | `banners.is_active`, `products.is_active`, `position`, `id`; `ListBanners::LIMIT` = 10 |
| `GET /home/best-sellers` | ranking | `SUM(order_items.quantity)` where `orders.status = 'paid'`, all time; ties by `products.name`, `products.id` |
| `GET /home/best-sellers` | in stock filter | `cheapest_price_cents IS NOT NULL` from `withCheapestPrice` |
| `GET /home/deals` | inclusion and order | `deal_percent` from `products.list_price_cents` and `cheapest_price_cents`, same arithmetic as `Discount::percent`; ≥ 1 |
| best sellers, deals | block size | `ListBestSellers::LIMIT`, `ListDeals::LIMIT` = 12 (decided in this spec) |
| Seeders | layout rows | fixed in `HomeSeeder` (AC-6) |
| Seeders | banner content and products | `server/database/data/home.php`; `image_url` from `products.cover_image_url` (Steam `library_600x900.jpg`, the host the CSP already allows, spec 0004) |
| Seeders | demo orders | `server/database/data/demo_orders.php` (fixed UUID keys, slugs, quantities); offer = cheapest active in stock offer at seed time; card = an approving test number (spec 0009 `SimulatedPaymentGateway`) |
| Seeders | demo user password | `Str::random(64)`, hashed by the model cast, set on create only |
| Home page | `<h1>` text | fixed page chrome in `HomePage` ("Buy game keys at the best prices", spec 0003 AC-3), visually hidden |
| Home page | band tone | CSS by DOM order of rendered bands (odd light, even dark) |
| Home page | mobile vs desktop layout | `useMediaQuery("(min-width: 768px)")` |
| Home page | items shown before "Show all" | constant `MOBILE_PREVIEW_COUNT = 4` in `ProductRailBlock` |
| Home page | error text | `ApiError.message` (existing `ErrorState`) |
| Home page | arrow labels | `"Scroll " + block title + " left/right"` |

**Key invariants**:
- The client renders no block content of its own: block set, order, titles, banner copy, art, prices, and rankings all come from API responses. The only fixed client text is page chrome (hidden `<h1>`, button labels, state messages).
- `home_blocks.type` is unique, so a layout never lists the same block twice; its check constraint keeps every stored value inside `HomeBlockType`, so the enum cast cannot throw on a hand edited row.
- The deals order is always consistent with the returned `discount_percent` (same integer arithmetic, AC-4).
- Best sellers counts only paid orders and only shows buyable products; it never exposes unit counts.
- Every tile and card links to `/products/<slug>` of an active product.
- `DemoOrdersSeeder` creates orders only through `AddCartItem` and `PlaceOrder` (no copied checkout logic, spec 0004 follow-up) and is idempotent per order key.
- One block's failure (request or render) never unmounts another block.

**Security model**: all four endpoints are public and read only, with the per IP `catalog` limiter; they take no input, so there is nothing to validate or inject. Inactive products and inactive banners never appear. Best sellers exposes only the ranking, not sales counts or buyers. The demo user has an unguessable random password set once, holds no real data, and its orders contain real (fake) keys that only that user could read, which nobody can. No personal data is involved, and no payment data is stored (the simulated card is used only in memory, as in spec 0009).

**Configuration required**: none. No new env vars; the tile art host is already in the CSP `img-src` (`client/vite.config.ts`).

**Critical test scenarios**:
- Happy path (Pest): seed the catalog, home, and demo orders; `/home` returns the four types in order; `/home/banners` returns 8 with live prices; `/home/best-sellers` returns 12 in strictly falling unit order; `/home/deals` returns 12 with `discount_percent` non increasing, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-7**
- Ranking from real orders (Pest): place a paid order for a product outside the top 12 with enough quantity and it enters the list on the next request; an order in another status does not count; a sold out best seller drops out, verifies **AC-3**
- Deals edges (Pest): no list price, list price equal to the cheapest, a 0% rounded discount (list 1000, cheapest 999), and a sold out product are all excluded; ties order by name, verifies **AC-4**
- Visibility (Pest): an inactive banner, a banner on an inactive product, and an inactive layout row are hidden; a sold out banner product shows `price: null`; more than 10 banners caps at 10, verifies **AC-1**, **AC-2**
- Fixed query count and limiter (Pest): query count is the same for 1 and 12 results; the 121st request in a minute returns 429, verifies **AC-5**
- Demo seed succeeds on real stock (Pest): `CatalogSeeder` then `HomeSeeder` then `DemoOrdersSeeder` on a fresh database completes, and best sellers matches the totals listed in `demo_orders.php`; a demo cart left with a stray line before a run is cleared, not bought, verifies **AC-7**
- Seeders idempotent (Pest): running `HomeSeeder` and `DemoOrdersSeeder` twice leaves the same row counts; a hidden banner stays hidden after reseed; the demo user's hash does not match `'password'` and stays unchanged on the second run, verifies **AC-6**, **AC-7**
- Failure isolation (RTL, `HomePage.test.tsx`): with `/home/deals` answering 500, best sellers and banners still render and deals shows its error with Try again; with `/home/best-sellers` returning `[]` its band is absent; with an unknown layout type nothing extra renders; with `/home` failing, only the page error shows, verifies **AC-8**, **AC-9**
- Render crash (RTL): a block whose data makes its component throw shows its error state while the others render; Try again refetches that block, verifies **AC-9**
- Mobile list (RTL with a stubbed `matchMedia`): 12 items show 4 and "Show all"; activating it shows 12, removes the button, and focuses the 5th card link, verifies **AC-11**
- Manual: 360px no sideways scroll, keyboard through tiles, arrows, and Show all with a visible ring, contrast rows present, public deploy shows all four blocks, verifies **AC-10**, **AC-12**, **AC-13**

## Build plan

Ordered as one journey (landing → product page), each block finished with all its states before the next, server and client together.

1. Migrations for `home_blocks` and `banners`, models `HomeBlock` (enum cast) and `Banner` (`belongsTo Product`), `Product::banner()`, enum `HomeBlockType`; `HomeSeeder` with the layout rows and `database/data/home.php` (8 banners: distinct titles, mixed platforms, at least 5 discounted; original taglines with no prices in the copy), called from `DatabaseSeeder` after `CatalogSeeder`, satisfies **AC-6**
2. `GET /home`: `ListHomeBlocks`, `HomeBlockResource`, `HomeController::layout`, route with `throttle:catalog`; Pest tests for order, inactive rows, and empty layout, satisfies **AC-1**, **AC-5**
3. Client frame: `api/home.ts` (layout query), `HomeSection`, `ErrorBoundary`, `HomeBlockError`, `HomePageSkeleton`; `HomePage` with the hidden `<h1>`, layout states, slow notice, and the type map; move the existing grid into a `products` block (`ProductListSection` gets `title`, renders in `HomeSection`), so the page works end to end with only the grid, satisfies **AC-8**, **AC-9**, **AC-12**
4. Banners end to end: `ListBanners`, `BannerResource`, `HomeController::banners`, Pest tests; client `homeBannersQuery`, `ScrollRail`, `BannerTile`, `HeroBanners` with skeleton, error, and empty states, satisfies **AC-2**, **AC-5**, **AC-9**, **AC-10**
5. Best sellers data: `ListBestSellers`, `HomeController::bestSellers`, Pest ranking tests; `DemoOrdersSeeder` with `database/data/demo_orders.php` (15 orders, quantities 1 to 3, only products with stock after `CatalogSeeder`, 12 distinct top totals), called from `DatabaseSeeder` after `HomeSeeder`, with idempotency tests, satisfies **AC-3**, **AC-5**, **AC-7**
6. Best sellers UI: `ProductCard` `layout` prop and ring hover (store included), `ProductCardSkeleton` layout; `ProductRailBlock` (desktop rail, mobile list with Show all and focus move), `bestSellersQuery`, satisfies **AC-9**, **AC-11**, **AC-12**
7. Deals end to end: `ListDeals`, `HomeController::deals`, Pest edge tests; `dealsQuery` reusing `ProductRailBlock`, satisfies **AC-4**, **AC-5**, **AC-9**, **AC-11**
8. `HomePage.test.tsx` failure isolation, render crash, and mobile list tests; `api/home.ts` mapping test, satisfies **AC-8**, **AC-9**, **AC-11**
9. `client/design.md` rows (`HomeSection`, `BannerTile`, `ScrollRail`, `ProductRailBlock`, `ErrorBoundary`, `ProductCard` hover and layout) and contrast rows; `/ui` entries for every new component and state; 360px, keyboard, and contrast check in a browser, satisfies **AC-12**, **AC-13**
10. Local checks green (server Pint, PHPStan, Pest; client format, lint, typecheck, Vitest, build); commit, CI green, Render and Vercel deploy; you (your machine) seed production with ` APP_ENV=production DB_URL=<neon direct url> php artisan db:seed --force` (leading space keeps it out of shell history); check the public homepage shows all four blocks and a tile and a card open their product pages, satisfies **AC-13**

## Consequences

**Positive**:
- The homepage meets the brief literally: layout, copy, art, and rankings all come from the database through separate endpoints, which is easy to show in the README and in a review.
- Failure isolation is real and tested at both levels (request and render), so a slow or broken block never blanks the landing page.
- Best sellers is honest data from the real checkout path, and it moves when anyone buys.
- `ScrollRail`, `ErrorBoundary`, `HomeSection`, and the horizontal `ProductCard` are reusable for later pages.

**Negative / tradeoffs**:
- One extra round trip: blocks start loading only after `GET /home` answers, and a layout failure shows a page error with no blocks. On a cold Render start the layout call absorbs the wake up (the page level notice covers it); the blocks then hit an awake server.
- The demo seeder uses up a few dozen keys and writes 15 orders into production; they inflate the order and key counts a reviewer might query, and the ranking is shaped by the seed until real sales outnumber it.
- Rerunning `CatalogSeeder` tops sold keys back up to each offer's stock target, so stock (and which best sellers count as in stock) can shift between seed runs. The demo data file is coupled to `OfferPlanner`'s stock output; changing the catalog data can break the demo seed, which the Pest seed test catches.
- `ProductCard` hover changes on the store and search too (a small site wide change made here).
- The `home_blocks` and `banners` tables have no admin UI; changing them means an SQL `UPDATE` or editing the seed data and reseeding.
- Any discount counts as a deal, so the Deals block shows the 12 deepest discounts, not a curated set.

**Neutral**:
- Two new tables and migrations; no change to existing tables or endpoints (`GET /products` is unchanged).
- The hidden `<h1>` replaces the visible one from spec 0003 AC-3; the text is the same.
- Production seeding stays the manual command from spec 0005; the container still never seeds on start.

## Follow-up

- [ ] Site wide visual polish (separate, before submission): the Eneba card restyle (deep card, mint border, coloured region, Add to cart, View offers), category nav, and icon row, if time allows.
- [ ] README (feature 16): explain the layout endpoint, the per block endpoints, the demo order seed and why it exists, and the deal and ranking rules.
- [ ] After building, `/sync` adds `HomeController`, `app/Actions/Home/`, the seed data files, and the `["home", ...]` query keys to the `server/` and `client/` `AGENTS.md` key file tables.
