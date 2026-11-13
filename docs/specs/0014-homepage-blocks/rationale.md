# 0014. Homepage blocks: rationale

Decision record for [index.md](index.md). `/develop` does not need this file.

## Context

The brief says the landing page "is assembled from several different blocks, such as a banner, best sellers or deals. Each block gets its content from its own backend service or database, so the frontend only displays what it receives and nothing is hardcoded there." The scope (feature 15) adds: each block loads independently with its own loading and error state, one failing block does not break the page, best sellers reflect real order data, and every card leads into the purchase journey. Homepage blocks are one of the three areas the scope chose to go deep on.

Earlier specs left decisions owed here: the `banners` table (spec 0002), the deal threshold, block size, and best sellers with no orders (spec 0002), and whether to seed demo orders through the real checkout code (spec 0004). Discount rounding is already pinned in `Discount::percent` (whole percent, rounded down) and must not drift between the store and the deals block (spec 0003).

Forces: the API runs on a free Render instance that sleeps, so the first visit is slow and several requests share one wake up. Production has almost no orders, so a pure sales ranking starts empty. The catalog is small (81 products, 48 discounted locally, every discount at 29% or more), so performance is not a concern, and correctness and clarity are. The UI must match the Eneba screenshots while leaving the site wide polish to a later step.

## Options considered

### Option 1: Per block endpoints, client fixed layout

`HomePage` renders the blocks in code order; each block fetches its own endpoint.

**Pros**: no waterfall; simplest code.
**Cons**: block list, order, and titles are hardcoded in the frontend, the exact thing the brief asks to avoid.

### Option 2: Layout endpoint plus per block endpoints (chosen)

`GET /home` returns `{ type, title }[]` from a `home_blocks` table; each block component fetches its own endpoint.

**Pros**: nothing about content or layout lives in the client; each block keeps its own source and failure boundary; easy to explain.
**Cons**: one extra round trip before blocks start; a layout failure blanks the blocks.

### Option 3: One aggregate `GET /home` with every block's data

A single response carries layout and content.

**Pros**: one request, best for a cold start.
**Cons**: one failure takes every block down, and blocks no longer have their own source, which breaks both the brief and the scope's isolation rule.

### Option 4: Generic `GET /blocks/{type}`

One route with a type switch.

**Pros**: less routing.
**Cons**: one class ends up owning every data source, which blurs "each block has its own source" and grows a switch statement.

## Rationale

Option 2 is the only one that satisfies both halves of the brief: nothing hardcoded (rules out Option 1) and an independent source per block (rules out Option 3). The extra round trip is small next to the cold start the page already has, and the layout call is a trivial indexed read. Explicit routes and one Action class per block (over Option 4) match the project's thin controller, Action, Resource shape and read clearly in a review. The layout payload carries only `type` and `title`, with no endpoint URLs, so the client never fetches a path it was handed.

Sub decisions made in the conversation:
- **Hero as a portrait tile strip**, not a wide carousel: the screenshots show Eneba's hero as a row of portrait promo tiles. No autoplay avoids a WCAG pause control. Arrow buttons from `md` up exist because a mouse without a trackpad cannot scroll sideways.
- **Banner art in `banners.image_url`**, seeded with the product's Steam portrait art: it fits the 1:2 tile far better than wide art, stays on the host the CSP already allows, and can be swapped per banner with no code change.
- **Banners point at a product by FK**, so the price is live and the link can never break; copy (title, tagline, CTA) is banner data.
- **Best sellers from all time paid orders, sold out hidden, seeded with demo orders through `PlaceOrder`**: a time window would empty the block with demo volume; seeding through the real checkout keeps "real order data" true and follows spec 0004's instruction not to copy checkout logic. Filling gaps with another list was rejected because it would no longer be best sellers.
- **Deals = any discount of 1% or more, biggest first**: the engineer chose any discount over the suggested 30% floor. In the seeded data the outcome is the same (every discount is 29% or more), and the rule stays the simplest to explain. The SQL reuses `Discount::percent`'s integer arithmetic so the order and the badges agree.
- **12 items per rail**, divisible by 2, 3, 4, and 6; **mobile shows 4 then Show all** to match Eneba's vertical lists without a 24 card scroll.
- **Empty blocks hide**; **render crashes are contained** by a small class `ErrorBoundary` (no new package).
- **No server cache**: each query is one small aggregate, and a cache would make best sellers lag a purchase and complicate tests.
- **Card hover becomes a mint ring**: dark bands use `surface-deep`, where the old `surface-deep` hover would vanish. A `panel` hover was considered and rejected on contrast (see below). The ring keeps every text pair on `surface` and echoes Eneba's mint card borders.

## Screenshot findings

From `docs/reference/desktop/homepage.png` and `docs/reference/mobile/homepage.png`:

- **Bands**: each block is a full width band; bands alternate the light violet (`#4618ac`, our `bg`) and a darker violet, with content in a centred container (about 1170px).
- **Headings**: white, extrabold, about 32px on desktop and 28px on mobile, left aligned; an info icon follows (not built).
- **Hero**: full bleed strip of portrait tiles (about 1:2), art with heavy baked in text and a small CTA label; about 4 visible on mobile. The desktop capture caught the strip part way through loading, so its exact desktop count is unknown; 6 visible is our choice.
- **Desktop rails**: one row of about 5.5 cards (the last one cut off as a scroll hint), gap about 20px, then a centred outline "Show all" button.
- **Mobile blocks**: a vertical list of horizontal cards (cover left about 40% of the card, text right), then a centred outline "Show all" or "See all" button.
- **Eneba card** (deferred to the polish step): deep purple card, 1px mint border, coloured region in caps, "From €x" with strike and a green percent, a yellow Add to cart, an outline View offers, a heart, a cashback badge.

## Contrast evidence for the card hover

Computed with the WCAG relative luminance formula against the tokens in `client/src/index.css`:

| Text token | on `panel` #5825cc | on `surface` #351183 |
|---|---|---|
| `fg` | 8.23 | 13.47 |
| `fg-muted` | **3.73 (fails 4.5)** | 6.10 |
| `price` | 4.74 | 7.75 |
| `discount` | **3.54 (fails 4.5)** | 5.79 |

`price` as a 1px ring (non text, needs 3:1): 10.0 on `surface-deep`, 6.08 on `bg`.
