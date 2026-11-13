# 0007. Product page: one detail endpoint with sorted seller offers, rendered with useQuery

**Date**: 2026-11-12
**Status**: Accepted

## Summary

This spec builds the page for a single game at `/products/<slug>`, where a buyer compares offers from several sellers. One new API call, `GET /api/v1/products/{slug}`, returns the game's details plus its active offers, already sorted by the server (in stock first, cheapest first). The page shows a top area with the cover and a buy box for the best price, then the full offer list, then an "About" section. There is no buy button yet: the cart feature (9) adds it, so nothing fake ships, and no database change is needed.

## Requirements

**User stories**:
- As a buyer, I want to see every seller's offer for a game, sorted by price, so that I can pick the best deal.
- As a buyer, I want the cheapest available offer called out so that I don't have to scan the list.
- As a buyer, I want out of stock offers clearly marked so that I never try to buy something that isn't there.
- As a buyer, I want the game's description, developer, publisher, and release date so that I know what I'm buying.
- As a visitor with a broken or old link, I want a clear "not found" page so that I can get back to the store.

**Acceptance criteria** (the contract):
- **AC-1**: `GET /api/v1/products/{slug}` for an active product returns 200 with `{ data }` holding: `slug`, `name`, `type`, `cover_image_url`, `description`, `developer`, `publisher`, `release_date` (`YYYY-MM-DD` or null), `platform { slug, name }`, `region { slug, name }`, `price`, `list_price`, `discount_percent`, `best_offer_id`, and `offers`. Nullable columns come back as `null`, never as missing keys.
- **AC-2**: `offers` holds only active offers (`offers.is_active = true`). Each item is `{ id, price: Money, stock: int, seller: { name, rating_basis_points, rating_count } }` and nothing else (no key codes, no other key data). Order: offers with `stock > 0` first, then offers with `stock = 0`. Inside each group: `price` ascending, then seller rating descending (a seller with `rating_count = 0` ranks below every rated seller), then seller name ascending, then offer `id` ascending.
- **AC-3**: `best_offer_id` is the `id` of the first offer with `stock > 0` in that order, and `price` is that offer's price as Money. `discount_percent` is `Discount::percent(list_price_cents, best price)`. When no offer has stock (or there are no offers), `best_offer_id`, `price`, and `discount_percent` are `null`, while `list_price` still returns as stored. For the same product and unchanged data, `price` and `discount_percent` here equal that product's `price` and `discount_percent` in `GET /api/v1/products`.
- **AC-4**: An unknown slug, an inactive product's slug, or a slug that doesn't match `[a-z0-9-]+` returns 404 in Laravel's default JSON error shape. The endpoint uses the existing `catalog` rate limiter (120 per minute per IP), so request 121 inside a minute gets 429 with `Retry-After`.
- **AC-5**: The client route `/products/:slug` renders a top area: the cover (2:3, placeholder when missing or broken), the product name as the page's only `<h1>`, a type label (Game, DLC, Gift card, Subscription), platform, and region. Beside it (below it on mobile) a buy box shows the best price at `Price` size `lg` with the struck list price and `-NN%` badge when `discount_percent` is set, the best offer's seller name, and a "Best price" label. With no in stock offer, the buy box shows "Out of stock".
- **AC-6**: An "All offers" section (`<h2>`) renders one row card per offer in API order, inside a `<ul>`. Each row shows the seller name, the rating as a percent with one decimal plus the rating count (for example "98.5% · 1,204 ratings"), or "New seller" when `rating_count` is 0, and the price. A row with stock 1 to 5 shows "Only N left". A row with stock 0 shows the text "Out of stock" and muted styling (still meeting AA contrast). The row whose `id` equals `best_offer_id` carries a "Best price" badge. No row has a buy or add to cart control. With an empty `offers` array, the section shows the empty state "No sellers offer this game right now."
- **AC-7**: An "About" section (`<h2>`) shows the description and a facts list (developer, publisher, release date formatted like "18 May 2015"). Each fact hides when its value is null; the description paragraph hides when null; the whole section hides when all four are null.
- **AC-8**: While loading, the page shows a skeleton with the same layout, and the "Waking up the server" notice after 3 seconds (the home grid's `useSlowPending` behavior). A 404 shows a not found state in place (`<h1>` "Game not found", text "This game does not exist or is no longer sold.", a link to the homepage). Any other error shows `ErrorState` with a working "Try again". The browser tab title is `{name} | Eneba Marketplace (demo)` when loaded and `Game not found | Eneba Marketplace (demo)` on 404.
- **AC-9**: At 360px the page is one column with no sideways scroll; from `md` the cover and the details plus buy box sit side by side. Every interactive element is keyboard reachable with the global focus ring, and every text and background pair used is in the `client/design.md` contrast table (AA).
- **AC-10**: `CoverImage` moves out of `ProductCard.tsx` into its own file and is used by both the card and the page, with no visible change to the card. Client checks (`format:check`, `lint`, `typecheck`, `test`, `build`) and server checks (Pint, PHPStan, Pest) pass locally and in CI, and the page works on the public deploy.

## Decision

**Chosen option**: Option 1: One detail endpoint with offers embedded and sorted on the server, fetched with `useQuery` in the page

You add `GET /api/v1/products/{slug}` (thin controller → `ShowProduct` action → `ProductDetailResource` with `OfferResource`), and a `ProductPage` that reads it through a TanStack Query `queryOptions` helper, matching the home grid's loading, slow notice, and error pattern.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Page composition** (design source: `client/design.md` tokens and the existing components, laid out after Eneba's product page; no Figma or screenshots):

1. **Hero**: `CoverImage` on the left from `md` (top on mobile); on the right the type label, `<h1>` name, platform and region line, then the **buy box** (`panel` style surface: "Best price" label, `Price size="lg"`, "Sold by {seller}"; or "Out of stock").
2. **All offers** (`<section aria-labelledby>`, `<h2>`): `<ul>` of `OfferRow` cards. Below `md` each card stacks (seller and rating on top, stock note and price below); from `md` it is one row: seller and rating left, stock note middle, price right.
3. **About** (`<section>`, `<h2>`): description paragraph, then a `<dl>` with Developer, Publisher, Release date.

**Component inventory**:

| Component | New or existing | Notes |
|---|---|---|
| `CoverImage` | extracted from `ProductCard.tsx` into `components/product/CoverImage.tsx` | Props `url`, `alt`, `className?`; keeps `COVER_ASPECT_CLASS`, `onError` placeholder; `loading="lazy"` stays for cards, the page passes `loading="eager"` (it is above the fold) |
| `Price`, `Skeleton`, `EmptyState`, `ErrorState`, `Alert`, `LinkButton`, `Container` | existing | used as is |
| `ProductPage` | new, `pages/ProductPage.tsx` | reads `slug` with `useParams`, owns the query and the page states |
| `ProductHero`, `BuyBox`, `OfferList`, `OfferRow`, `ProductAbout`, `ProductPageSkeleton`, `ProductNotFound` | new, `components/product/` (page pieces) | small focused components; no data fetching inside them |

**Asset strategy**: covers come from `products.cover_image_url` (seeded Steam portrait art, spec 0004); missing or broken images show the existing `Gamepad2` placeholder. No new assets.

**Data model sketch**: no schema change. The feature reads tables from spec 0002:

| Table | Read | Filter |
|---|---|---|
| `products` | all detail columns | `is_active = true`, `slug = ?` |
| `platforms`, `regions` | `slug`, `name` | via `products.platform_id`, `region_id` |
| `offers` | `id`, `price_cents`, `currency`, `seller_id` | `product_id = ?`, `is_active = true` |
| `sellers` | `name`, `rating_basis_points`, `rating_count` | via `offers.seller_id` |
| `product_keys` | count only, never `code` | `withCount('availableKeys')` (unsold keys) |

Query (one product, 2 to 5 offers): `Product::query()->active()->where('slug', $slug)->with(['platform:id,slug,name', 'region:id,slug,name', 'offers' => fn ($q) => $q->active()->with('seller:id,name,rating_basis_points,rating_count')->withCount('availableKeys')])->firstOrFail()`. Sorting happens in PHP on the loaded collection (see the sort rule in AC-2).

**State transitions**: none. This feature only reads.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/products/{slug}` | GET | `slug` path param (`[a-z0-9-]+`, route `where` constraint) | `{ data: ProductDetail }` per AC-1 to AC-3 | public, `throttle:catalog` | 404 (unknown, inactive, bad format), 429 (`Retry-After`) |

Route: `Route::get('/products/{slug}', [ProductController::class, 'show'])->where('slug', '[a-z0-9-]+')->middleware('throttle:catalog')->name('products.show')`.

Response example:

```json
{
  "data": {
    "slug": "the-witcher-3-wild-hunt-pc-europe",
    "name": "The Witcher 3: Wild Hunt",
    "type": "game",
    "cover_image_url": "https://…",
    "description": "Hunt monsters for coin…",
    "developer": "CD PROJEKT RED",
    "publisher": "CD PROJEKT RED",
    "release_date": "2015-05-18",
    "platform": { "slug": "pc", "name": "PC" },
    "region": { "slug": "europe", "name": "Europe" },
    "price": { "amount": 998, "currency": "EUR" },
    "list_price": { "amount": 2999, "currency": "EUR" },
    "discount_percent": 66,
    "best_offer_id": 41,
    "offers": [
      { "id": 41, "price": { "amount": 998, "currency": "EUR" }, "stock": 3,
        "seller": { "name": "KeyHub", "rating_basis_points": 9850, "rating_count": 1204 } }
    ]
  }
}
```

Client types live in `client/src/api/products.ts` next to `Product` (`ProductDetail`, `Offer`), with `getProduct(slug, signal)` and `productQuery(slug)` (`queryKey: ["products", "detail", slug]`). The slug goes through `encodeURIComponent` in the path.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Show endpoint | product fields, platform, region | `products`, `platforms`, `regions` columns |
| Show endpoint | `release_date` string | `products.release_date` cast `date`, serialized `->format('Y-m-d')` or null |
| Show endpoint | offer `stock` | derived: `available_keys_count` from `withCount('availableKeys')` (spec 0002) |
| Show endpoint | offer `price` | `Money::eur(offers.price_cents)` |
| Show endpoint | offer order | derived: sort rule in AC-2, applied in `ShowProduct` on the loaded collection |
| Show endpoint | `best_offer_id`, `price` | derived: first sorted offer with `stock > 0` |
| Show endpoint | `discount_percent` | derived: `Discount::percent(list_price_cents, best price cents)` (same helper as the list, so card and page agree) |
| Show endpoint | `list_price` | `Money::eur(products.list_price_cents)` |
| Page | which slug to load | `useParams().slug` from `/products/:slug` (the card already links there, spec 0003) |
| Page | type label | client map in `api/products.ts`: `game` → Game, `dlc` → DLC, `gift_card` → Gift card, `subscription` → Subscription |
| Page | release date text | `formatReleaseDate("YYYY-MM-DD")` in `lib/`: `Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" })` on `Date.UTC(...)`, so no time zone shifts the day |
| Page | rating text | `formatRating(basisPoints)` in `lib/`: `basisPoints / 10000` through `Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 })`; count through `Intl.NumberFormat("en-GB")`; "New seller" when `rating_count === 0` |
| Page | "Only N left" | derived: `1 <= stock <= LOW_STOCK_THRESHOLD`, constant `5` in `OfferRow.tsx` |
| Page | "Out of stock" row | derived: `stock === 0` |
| Page | "Best price" badge row | `offer.id === best_offer_id` |
| Page | buy box seller name | the offer whose `id` is `best_offer_id` |
| Page | price text | `Price` → `formatPrice(Money)` (spec 0003) |
| Page | tab title | React 19 `<title>` element rendered in the page: `` `${name} | Eneba Marketplace (demo)` `` |
| Page | not found vs error | `ApiError` with `kind === "http"` and `status === 404` → not found; anything else → `ErrorState` |
| Page | slow notice | `useSlowPending(query.isFetching && !query.data)` (3 s), same copy as the home grid |

**Key invariants**:
- The client never sorts offers or computes the best offer, the price, or the discount. The server is the one source, so the store, cards, and this page cannot disagree.
- `best_offer_id` is null exactly when no offer has `stock > 0`, and then `price` and `discount_percent` are null too.
- No API response ever contains a key `code` or any `product_keys` row; stock is a count only.
- Inactive products and inactive offers are never exposed by this endpoint.
- Offer order is fully deterministic (offer `id` is the final tie break), so tests and repeated loads match.
- EUR only. Every offer price, list price, and best price is EUR (`currency` is always `"EUR"`, enforced by the `currency = 'EUR'` check from spec 0002 and `Money::eur`). This demo has no currency conversion and no multi currency support is planned; the client formats whatever `Money` it receives and never converts.

**Security model**: public read, no auth, no personal data. Catalog tables are public (spec 0002). Only active rows are returned; key codes stay on the server. The slug is constrained by the route regex and bound as a query parameter (no raw SQL). Abuse is capped by the existing `catalog` limiter. Text from the API renders through React (escaped), never `dangerouslySetInnerHTML`; the description is plain text, so line breaks render with `whitespace-pre-line`, not HTML.

**Configuration required**: none. No new env variables or dependencies.

**Edge cases and failure handling**:
- Cold start on Render (up to a minute): skeleton, then the slow notice after 3 s; the request timeout and single retry come from the existing `apiFetch` and `shouldRetryQuery` (4xx is never retried, so a 404 shows at once).
- Navigating between two product pages: the query key changes per slug, so the old product never flashes under the new URL (no `placeholderData`).
- All offers out of stock: buy box "Out of stock", list shows every row muted, no "Best price" badge.
- No active offers at all: buy box "Out of stock", offers section shows the empty state.
- Seller with no ratings: "New seller"; ranks below rated sellers on equal price.
- Very long names: the `<h1>` wraps (no clamp on the page).
- Missing or broken cover: placeholder in the same 2:3 box, no layout shift.
- Stock goes stale after someone else buys: shown stock can be up to 60 s old (global `staleTime`). The cart and checkout recheck stock on the server, so a stale number never sells a missing key.
- 429: `ErrorState`; "Try again" works once the limit resets.

**Critical test scenarios**:
- Happy path (Pest): a product with four offers (two in stock at different prices, one in stock tied on price with a better rated seller, one with no keys) returns the documented shape and order, `best_offer_id` of the cheapest best rated in stock offer, and the right `discount_percent`, verifies **AC-1**, **AC-2**, **AC-3**
- Tie break (Pest dataset): equal price with a `rating_count = 0` seller vs a rated seller, then equal rating by name, then equal name by id, verifies **AC-2**
- Filtering (Pest): an inactive offer is absent; the JSON contains no key `code` anywhere (assert on the raw body), verifies **AC-2**
- No stock (Pest): all offers without keys, and a product with no offers, both return `best_offer_id`, `price`, `discount_percent` null and `list_price` set, verifies **AC-3**
- Regression (Pest): for the same seeded product with unchanged data (in stock offers, some at a lower price with no keys, an inactive cheaper offer, and a `list_price_cents` set), the `price` and `discount_percent` from `GET /api/v1/products` match the ones from `GET /api/v1/products/{slug}`; also when no offer has stock (both `null`). Guards against the list's `withCheapestPrice()` scope and `ShowProduct` drifting apart, verifies **AC-3**
- Failure case (Pest): unknown slug, inactive product slug, and `Bad_Slug` each return 404 JSON, verifies **AC-4**
- Rate limit (Pest): with the `catalog` limiter hit 120 times, the next call returns 429 with `Retry-After`, verifies **AC-4**
- Unit (Vitest): `formatRating(9850)` → "98.5%", `formatRating(10000)` → "100%", `formatReleaseDate("2015-05-18")` → "18 May 2015", type label map covers all four types, verifies **AC-6**, **AC-7**, **AC-5**
- Manual in browser (`/check verify`): load a seeded product at 1280px and 360px, check the buy box, badge, "Only N left", muted out of stock rows, About facts, tab title, keyboard Tab order; then an unknown slug shows "Game not found"; then stop the API and see `ErrorState` with a working retry, verifies **AC-5** to **AC-9**
- Auth/permission: not applicable; the endpoint is public, and the no key code assertion above covers the only sensitive data.

## Build plan

Approach: Journey. This page is the second step of the purchase path (home → product page → cart), so you finish the whole page with every state before the cart starts. The server endpoint comes first because every state on the page depends on its exact shape.

1. Add the route with its slug constraint and `throttle:catalog`, `ProductController::show`, the `App\Actions\Catalog\ShowProduct` action (query, PHP sort, best offer), and `ProductDetailResource` plus `OfferResource`, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**
2. Write the Pest tests from *Critical test scenarios* (server ones) in `tests/Feature/Catalog/`, including the list versus detail price and discount regression test, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**
3. Client data layer: `ProductDetail` and `Offer` types, `getProduct`, `productQuery`, the type label map, plus `formatRating` and `formatReleaseDate` in `lib/` with Vitest tests, satisfies **AC-5**, **AC-6**, **AC-7**
4. Extract `CoverImage` from `ProductCard.tsx` with an optional `className` and `loading` prop; check the home grid looks the same, satisfies **AC-10**
5. Build `ProductHero` with `BuyBox`, `OfferList` with `OfferRow`, and `ProductAbout`, then `ProductPage` and the `products/:slug` route in `router.tsx`, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-9**
6. Add the page states: `ProductPageSkeleton` with the slow notice, `ProductNotFound` on 404, `ErrorState` with retry, and the `<title>` for loaded and not found, satisfies **AC-8**
7. Run every client and server check, push, confirm CI is green and the deploy works, then check 360px and keyboard use by hand, satisfies **AC-9**, **AC-10**

## Consequences

**Positive**:
- One request and one loading state per page; the 404 comes from the same call.
- Sorting, best offer, and discount live on the server, next to the list endpoint's discount logic, so nothing can disagree.
- `stock` as an exact number is ready for the cart's quantity cap (feature 9) with no API change.
- No schema change, no new dependency, no new env variable.

**Negative / tradeoffs**:
- The page is unusable for buying until feature 9 lands; a reviewer clicking around in between sees offers with no way to act on them.
- Exact stock counts are public. Fine for a demo; a real marketplace might hide them to avoid tipping off competing sellers.
- Shown stock can be up to 60 s stale until checkout (feature 10) invalidates the product queries.
- Sorting in PHP means the order rule is not reusable in SQL; if a later feature needs offers sorted inside a query (for example a seller page), the rule must be written again there.
- A client side SPA page has no server rendered HTML, so search engines see little until the deferred SEO feature; the tab title only helps a little.
- No React Testing Library yet, so component states are checked by hand in `/check verify`, not by automated tests.

**Neutral**:
- `CoverImage` becomes a shared component; `client/design.md` needs a row for it and the new page pieces.
- Laravel's default 404 message names the model ("No query results for model …"). The client ignores the message and branches only on the status.

## Follow-up

- [ ] Cart (feature 9): add the "Add to cart" button to each in stock `OfferRow` (and the buy box) using `offer.id`, cap quantity by `offer.stock`, and keep out of stock rows without a button.
- [ ] Checkout (feature 10): after a paid order, invalidate `["products"]` queries so stock and best price refresh.
- [ ] Store catalog (feature 13): reuse this sort rule if the store ever sorts offers, or move it to a shared helper.
- [ ] `/sync`: add `CoverImage` and the product page pieces to `client/design.md`, and `GET /products/{slug}` plus `ShowProduct` to `server/AGENTS.md` key files.
- [ ] Submission README (feature 18): mention public stock counts and server owned sorting as conscious choices.
