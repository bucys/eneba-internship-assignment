# Session 066: Eneba homepage Feature 15 spec

- Session ID: `264e2b95-b4aa-4925-949e-27d414e3ef4d`
- Source: `264e2b95-b4aa-4925-949e-27d414e3ef4d.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-13 19:20 UTC → 2026-11-13 19:52 UTC
- Prompts: 2
- Full technical transcript: [full/session-066.md](../full/session-066.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-13 19:20 UTC · [open in full transcript](../full/session-066.md#prompt-1) · record `16ac1617-6d07-4c2b-b658-808b021e7d57`</sub>

`/architect`

homepage blocks

## CLAUDE · 1

I'll start with pre-flight checks: freshness, existing specs, and the scope row.

*[2 tool calls: Bash, Read]*

Now the scope header, related specs, and the current home page code.

*[2 tool calls: Bash ×2]*

Earlier specs left several decisions owed to this feature. Let me read those spots plus the current home page and discount code.

*[5 tool calls: Bash ×4, Read]*

Framing is clear. One last check on images (cover URL pattern and CSP) since the banner needs artwork.

*[1 tool call: Bash]*

**Claude asked — Blocks** (select one):

> Which blocks should the homepage show? (Each block gets its own endpoint, per your scope.)
> - **Hero, Best sellers, Deals, grid (recommended)** — The three blocks the assignment names, then keep today's 'Browse games' grid (GET /products) last as an always full fallback with See all. Covers the brief without padding.
> - **Hero, Best sellers, Deals only** — Drop the grid. Leaner page, but if best sellers and deals are both thin the page looks empty.
> - **Add a New releases block** — Hero, Best sellers, Deals, New releases (by release_date), then the grid. One more endpoint to show the pattern scales; more build time.

**USER answered:**

Hero, Best sellers, Deals, grid (recommended)

**Claude asked — Layout** (select one):

> Who decides which blocks appear, and in what order?
> - **Server layout endpoint (recommended)** — GET /home returns the ordered list of block types and titles; the client maps each type to a component that fetches its own endpoint. Strongest reading of 'nothing is hardcoded'. Cost: one small extra request before blocks start loading.
> - **Client fixed order** — HomePage renders the blocks in code order; only each block's content comes from the API. Simplest, no waterfall, but layout and titles live in the frontend.

**USER answered:**

Server layout endpoint (recommended)

**Claude asked — Design src** (select one):

> How should I get the design for the homepage blocks?
> - **From a design tool** — A connected Figma file: tell me the file and frames.
> - **Screenshots I'll give you** — You share eneba.com homepage screenshots to match.
> - **Existing design.md / current UI** — Build from client/design.md tokens and the existing ProductCard, Price, and badge components.
> - **No design yet, suggest one** — I propose a direction for the hero and the block rails.

**USER answered:**

Screenshots I'll give you

**Claude asked — Hero** (select one):

> What should the hero banner be?
> - **Carousel of 3 to 5 slides (recommended)** — Matches eneba.com. Manual prev/next and dots, no autoplay (avoids a WCAG pause control and motion issues). Each slide links to a product.
> - **Single banner** — One featured slide from the API. Simplest, least Eneba like.
> - **Autoplay carousel** — Closest to eneba.com, but needs a pause button, reduced motion handling, and focus care.

**USER answered:**

Carousel of 3 to 5 slides (recommended)

Good picks. Now the data behind the layout and the banner.

**Claude asked — Layout src** (select one):

> Where should the homepage layout (block list, order, titles) live on the server?
> - **home_blocks table (recommended)** — Rows: type, title, position, is_active, seeded. A real database source you can reorder or hide with one UPDATE, and easy to defend in the README.
> - **Config file** — config/home.php returns the list. Fewer moving parts, but changing it means a deploy.

**USER answered:**

home_blocks table (recommended)

**Claude asked — Banner link** (select one):

> What does a banner slide point at?
> - **A product, via FK (recommended)** — banners.product_id; the CTA opens /products/{slug}, and price and discount come live from that product's cheapest offer, so the banner never shows a stale price.
> - **Any URL** — banners.link_url (product, store filter, anything). Flexible, but price would have to be typed in or omitted, and links can break.
> - **Product or URL** — Nullable product_id plus nullable link_url, exactly one set. Most flexible, more validation and states.

**USER answered:**

A product, via FK (recommended)

**Claude asked — Copy** (select one):

> What text does each slide carry from the banners row?
> - **Title, tagline, CTA label (recommended)** — e.g. 'Elden Ring', 'Rise, Tarnished. Now 45% off.', 'Buy now'. Price and discount stay live from offers, not typed in.
> - **Title and CTA only** — Shorter slides, less copy to seed.
> - **Title only, CTA fixed** — Minimal row; 'Buy now' is the same everywhere (but then it is hardcoded in the client).

**USER answered:**

Title, tagline, CTA label (recommended)

**Claude asked — Visibility** (select one):

> Which banner rows show, and how are they ordered?
> - **is_active + position (recommended)** — Show active rows by position, capped at 5. Hide a slide whose product is inactive. No dates to reason about.
> - **Add a starts_at / ends_at window** — Scheduled campaigns like the real site. Adds time logic and tests for little demo value.

**USER answered:**

is_active + position (recommended)

Now the banner art and best sellers.

**Claude asked — Banner art** (select one):

> Where does each banner slide's wide image come from?
> - **banners.image_url, Steam hero art (recommended)** — Seed it with the product's Steam library_hero.jpg (wide, high res) on shared.steamstatic.com, the host your CSP already allows. Own column, so a slide can use any art later.
> - **Reuse the product cover** — No new column; the portrait 600x900 cover sits beside the text. Cheaper, less hero like.
> - **Steam header.jpg** — Wide but only 460x215, blurry at hero size.

**USER answered:**

banners.image_url, Steam hero art (recommended)

**Claude asked — BS window** (select one):

> Best sellers ranks products by units sold in paid orders. Over what window?
> - **All time (recommended)** — SUM(order_items.quantity) over every order. Demo volume is tiny, so a window would empty the block within weeks.
> - **Last 30 days** — Closer to a real store's trending list; needs fresh orders to stay full.

**USER answered:**

All time (recommended)

**Claude asked — BS empty** (select one):

> Production has almost no orders yet. How should best sellers get real data?
> - **Seed demo orders via PlaceOrder (recommended)** — A DemoOrdersSeeder buys a fixed basket for a demo user through the real checkout action (as spec 0004 asked), once only. Real order rows, real keys used, block is full on day one.
> - **No seed, empty state until sales** — Purest data, but the block shows 'No sales yet' on the public URL until you or a reviewer buys something.
> - **Fill gaps with another list** — Top up with e.g. newest products when sales are thin. Always full, but then it is not really 'best sellers'.

**USER answered:**

Seed demo orders via PlaceOrder (recommended)

**Claude asked — Block size** (select one):

> How many products should the Best sellers and Deals blocks each return?
> - **12 each (recommended)** — Divides evenly into 2, 3, 4, and 6 columns, so a row never ends ragged at any breakpoint; still one small query.
> - **8 each** — Shorter page, two rows of four on desktop.
> - **Per block, from home_blocks.limit** — A limit column on the layout row so each block's size is data too. Most flexible, one more field to validate.

**USER answered:**

12 each (recommended)

Next, the deal rules. Let me check the seeded discount spread locally so the threshold pick is grounded.

*[1 tool call: Bash]*

Locally 48 of 81 products are discounted, all at 29% or more (46 at 30%+, 31 at 50%+), so any threshold up to 50% still fills 12 slots.

**Claude asked — Threshold** (select one):

> What is the minimum discount for a product to count as a deal? (Discount = list price vs cheapest in stock offer, whole percent rounded down, already in Discount::percent.)
> - **At least 30% (recommended)** — 46 local products qualify, so 12 is easy to fill, and 'deal' still means something. Kept as one constant on the server.
> - **Any discount** — Every product with a list price above its cheapest offer. Simplest rule, weakest meaning.
> - **At least 50%** — 31 local products qualify. Punchier block, closer to the edge if prices change.

**USER answered:**

Any discount

**Claude asked — Deal order** (select one):

> How should deals be ordered?
> - **Biggest percent off first (recommended)** — Matches the -NN% badge the buyer sees; tie break by name, then id, so the order is stable.
> - **Biggest saving in euros first** — Favours expensive games; the badge order would look random.
> - **Cheapest price first** — A bargain bin feel; ignores how big the discount is.

**USER answered:**

Biggest percent off first (recommended)

**Claude asked — Sold out** (select one):

> Should a best seller that is currently sold out still appear?
> - **Hide it (recommended)** — Only products with an in stock offer, so every card leads to something you can buy (your 'every card links into the purchase journey' rule). Deals already skip sold out, since no price means no discount.
> - **Show it as Out of stock** — Honest ranking, but a card on the landing page that cannot be bought.

**USER answered:**

Hide it (recommended)

**Claude asked — See all** (select one):

> Should Best sellers and Deals have a 'See all' link into the store?
> - **No, only the grid keeps it (recommended)** — The store has no 'discount' or 'best selling' sort, and adding one is outside scope. The grid's See all still goes to /store.
> - **Yes, add store sorts for them** — Adds discount and best selling sorts to GET /products and the store UI. Real scope creep into feature 13.

**USER answered:**

No, only the grid keeps it (recommended)

Let me check how the cheapest price scope and checkout replay work, since the deals query and demo seeder build on them.

*[1 tool call: Bash]*

Checkout is idempotent per key, so a demo seeder with fixed keys can run again safely. Now the API surface.

**Claude asked — Endpoints** (select one):

> Which endpoints should the homepage use? (All public, GET, under /api/v1, throttle:catalog.)
> - **/home + /home/{block} (recommended)** — GET /home (layout), /home/banners, /home/best-sellers, /home/deals; the grid keeps GET /products. One controller action each, one Action class each. Easy to read and to name in the README.
> - **Generic /blocks/{type}** — One route and a type switch on the server. Less routing, but one class owns every data source, which blurs 'each block has its own source'.

**USER answered:**

/home + /home/{block} (recommended)

**Claude asked — Layout row** (select one):

> What does each entry in the GET /home layout carry?
> - **type and title (recommended)** — { type: 'banners'|'best_sellers'|'deals'|'products', title }. The client maps type to a component that knows its endpoint and skips unknown types. No URLs passed around, so nothing to validate.
> - **type, title, and endpoint path** — The server also names the endpoint each block fetches. More server driven, but the client then fetches a path it was handed.

**USER answered:**

type and title (recommended)

**Claude asked — Layout fail** (select one):

> The layout loads first. If GET /home itself fails, what does the page show?
> - **h1 + one page level error with Try again (recommended)** — Without the layout there are no blocks to place; say so honestly. Block failures after that stay isolated to their block. The cold start 'waking up' notice covers the slow case.
> - **Fall back to a built in layout** — Page always renders blocks, but that fallback is a hardcoded layout in the client, which the brief says to avoid.

**USER answered:**

h1 + one page level error with Try again (recommended)

**Claude asked — Caching** (select one):

> Should the block endpoints cache results on the server?
> - **No server cache; client staleTime 60 s (recommended)** — Each query is one small indexed aggregate on ~100 products; caching adds invalidation questions (a purchase should move best sellers) for no visible gain.
> - **Cache::remember 5 minutes** — Cheaper under load, but best sellers lags a fresh purchase and tests must flush the cache.
> - **HTTP Cache-Control public, max-age=60** — Lets the browser and CDN reuse answers. Fine for public data; one more header to test.

**USER answered:**

No server cache; client staleTime 60 s (recommended)

Next, the page states and edge cases.

**Claude asked — h1** (select one):

> What happens to the page's single <h1> ('Buy game keys at the best prices')?
> - **Keep it, visually hidden (recommended)** — Screen readers and SEO still get one h1; the hero carousel leads visually, like eneba.com. It is page chrome, not block content, so it can stay in the client.
> - **Keep it visible above the hero** — What the page shows today. Pushes the hero down.
> - **Take it from GET /home** — Fully data driven, but the h1 then waits on a request and is missing when the layout fails.

**USER answered:**

Keep it, visually hidden (recommended)

**Claude asked — Empty block** (select one):

> A block endpoint succeeds but returns no items (no banners, no deals, no sales). What shows?
> - **Hide that block (recommended)** — No dead sections on a landing page; the other blocks close the gap. Tests cover that it renders nothing.
> - **Show its heading with an empty message** — e.g. 'No deals right now'. Honest, but looks broken on a homepage.

**USER answered:**

Hide that block (recommended)

**Claude asked — Slide stock** (select one):

> A banner's product is active but every offer is sold out. What does the slide show?
> - **Keep the slide, show Out of stock (recommended)** — The banner is curated content; the slide still links to the product page, which already handles sold out. Uses the existing Price component's null state.
> - **Drop the slide** — Only buyable slides show; the carousel can shrink or vanish without anyone editing banners.

**USER answered:**

Keep the slide, show Out of stock (recommended)

**Claude asked — Boundary** (select one):

> Each block already has its own query, loading, and error state. Should a render crash in one block also be contained?
> - **Yes, small ErrorBoundary per block (recommended)** — A tiny class component in components/ui (no new package) shows the same block ErrorState. Covers bad data from one endpoint, not just failed requests.
> - **No, query errors are enough** — Less code; a thrown render error in one block would take down the route (the router's error page).
> - **Use react-error-boundary** — Well known package with reset helpers; one more dependency to approve.

**USER answered:**

Yes, small ErrorBoundary per block (recommended)

**Claude asked — Data model** (select one):

> Does this data model (home_blocks and banners, as shown above) match what you want?
> - **Matches, go on (recommended)** — Two small tables, seeded by a HomeSeeder that upserts by type and product_id.
> - **Change a field or table** — Tell me what to add, remove, or rename.
> - **A relationship is wrong** — e.g. allow several slides per product.

**USER answered:**

Matches, go on (recommended)

**Claude asked — Demo buyer** (select one):

> Demo orders: which demo buyer and how much volume?
> - **One demo user, ~15 orders, fixed basket (recommended)** — demo-buyer@example.com with a random unusable password (nobody can sign in as it). A data file lists ~15 orders over ~14 products with varied quantities, so the top 12 has a clear order. Fixed idempotency keys make reruns no ops. Runs in production too.
> - **Several demo users** — Looks more organic in the DB; same block result, more seed code.
> - **Local only, not production** — Production best sellers then stays empty (hidden) until real purchases.

**USER answered:**

One demo user, ~15 orders, fixed basket (recommended)

Data model confirmed. One quick check on how seeding runs in production, since demo orders must land there.

*[2 tool calls: Bash ×2]*

The data side is settled. Production seeding is the manual `db:seed --force` step from spec 0005, so `DatabaseSeeder` just calls the new `HomeSeeder` and `DemoOrdersSeeder` too. Nothing changes on deploy.

**What's settled so far:**
- Layout comes from `GET /home` (a `home_blocks` table). It returns `{type, title}`, and the client skips any type it doesn't know.
- Blocks in order: hero carousel (3 to 5 manual slides), Best sellers (12), Deals (12, any discount, biggest percent off first), then the existing grid.
- Banners are a `banners` table pointing at a product. The art is Steam `library_hero.jpg`. The price stays live.
- Best sellers counts units sold over all time and hides sold out products. Demo orders are created through the real `PlaceOrder`, so the ranking is real order data.
- If a block comes back empty, it's hidden. Each block has its own query and its own error state, and an `ErrorBoundary` contains a crash. If the layout fails, the page shows one error.

**Next step: you said you'd share screenshots for the design.** Please paste eneba.com homepage screenshots, ideally:
1. The hero carousel, on desktop and on mobile
2. A product rail such as Best sellers or Deals, with its heading

Once I have them, I'll ask the last design questions: rail vs grid on mobile, carousel controls, and the card variant. Then I'll write the spec.

---

## USER · 2

<sub>2026-11-13 19:36 UTC · [open in full transcript](../full/session-066.md#prompt-2) · record `98b6bbaf-8d24-46e1-8e83-f100426de83a`</sub>

The Eneba homepage reference screenshots are located at:

- Desktop: `references/desktop`
- Mobile: `references/mobile`

Use these as the primary visual references for Feature 15. You may also inspect https://www.eneba.com/ for additional context.

Analyze the hero carousel, product rails, spacing, typography, responsive layouts, and reusable components before writing the spec.

Ask only the remaining design questions that cannot be resolved from the screenshots.

Prioritize visual fidelity to Eneba. Keep Feature 15 scoped to homepage blocks; site-wide visual polish will be handled separately before submission.

## CLAUDE · 2

*[3 tool calls: Bash ×3]*

These are full page captures (very tall), so I'll slice them into readable pieces in the scratchpad.

*[4 tool calls: Bash, Read ×3]*

The slices came out in the wrong order (sips ignored the offset). Let me redo them with a tool that crops exactly.

*[15 tool calls: Bash ×3, Read ×12]*

**Claude asked — Hero** (select one):

> The screenshots show Eneba's hero as a strip of portrait tiles, not a wide carousel. Which hero should we build?
> - **Portrait tile strip (recommended)** — Full bleed row of portrait tiles (about 1:2), scroll snap, no autoplay; ~2.5 visible on phones, ~6 on desktop, so up to 10 banners. Each tile is one link: art, dark gradient, title, tagline, yellow CTA pill.
> - **Keep the wide carousel** — One wide slide at a time with prev/next and dots, as picked before. Reads well, but it isn't what Eneba shows.

**USER answered:**

Portrait tile strip (recommended)

**Claude asked — Tile art** (select one):

> Where does each hero tile's art come from? (Portrait tiles fit the Steam 600x900 cover art, not the wide hero art picked earlier.)
> - **banners.image_url, seeded with portrait art (recommended)** — Keep the column so the art stays banner data. Seed it with the product's Steam library_600x900.jpg, the same host the CSP allows. Swap in custom art later with no code change.
> - **Drop the column, use the product cover** — One less column. But the art can never differ from the product card's art.

**USER answered:**

banners.image_url, seeded with portrait art (recommended)

**Claude asked — Mobile list** (select one):

> On mobile, Eneba stacks a block as a vertical list of horizontal cards. With 12 items per block, how should mobile behave?
> - **Vertical list, first 4, then Show all expands (recommended)** — Matches Eneba's look and its centered button, and keeps the page short. The button expands in place (no store link needed). Desktop shows the rail with all 12.
> - **Vertical list of all 12** — Exact Eneba layout with no extra state, but about 24 tall cards across two blocks.
> - **Sideways rail on mobile too** — One layout everywhere and the shortest page, but less faithful to Eneba.

**USER answered:**

Vertical list, first 4, then Show all expands (recommended)

**Claude asked — Card** (select one):

> Which card should Best sellers and Deals use?
> - **Existing ProductCard, layout only (recommended)** — Reuse today's card in the desktop rail; add one horizontal layout prop for mobile. The Eneba card restyle (mint border, colored region, Add to cart) goes in the separate site wide polish, so store and home change together.
> - **Eneba rail card with Add to cart, home only** — Closest look now: Add to cart (cheapest in stock offer) and View offers. Needs cheapest_offer_id in the block responses, and makes the home cards differ from the store's.

**USER answered:**

Existing ProductCard, layout only (recommended)

That settles the design. One last question before I write, since no web research ran in this session:

**Claude asked — References** (select one):

> Add a References section to the spec (where the recommendations come from)? The full reasoning stays in rationale.md either way.
> - **No references, keep it clean (recommended)** — Rationale only. Every decision here builds on your own specs and screenshots.
> - **Sources only** — Name the sources (your specs 0002, 0004, 0009, the screenshots, WAI carousel guidance) with no links fetched.

**USER answered:**

No references, keep it clean (recommended)

*[1 tool call: Bash]*

All the inputs are in. Reading the spec writing guides now.

*[3 tool calls: Read ×3]*

I'll look at a recent spec for this project's house format before writing.

*[1 tool call: Bash]*

**Claude asked — Bands** (select one):

> How should the alternating dark bands work with today's ProductCard (bg surface, hover surface-deep)?
> - **Dark band = surface-deep, card hover → panel (recommended)** — Eneba's alternation now. The one shared change: card hover moves from surface-deep to panel (#5825cc) everywhere (store too), which reads well on both bands. Needs a contrast row for text on panel.
> - **One band colour, spacing only** — No card change at all; blocks are separated by padding. Alternation waits for the site wide polish. Less Eneba like.
> - **New `band` token for dark bands** — A dedicated darker colour between bg and surface-deep. Exact match is possible, but it's one more token, and the card still needs a hover check on it.

**USER answered:**

Dark band = surface-deep, card hover → panel (recommended)

Let me check that the card text colors still pass AA on `panel` before I commit to it.

*[1 tool call: Bash]*

**Claude asked — Hover** (select one):

> Panel hover fails AA (fg-muted 3.73:1 on panel). Which card hover should we use instead, keeping dark bands = surface-deep?
> - **Keep surface, add a 1px mint ring on hover (recommended)** — Card stays bg surface (all text passes); hover adds ring 1px in `price` mint, which is 10:1 on surface-deep and 6:1 on bg. Echoes Eneba's mint card borders. Applies everywhere ProductCard is used.
> - **Bands only, card unchanged on dark bands** — Keep hover = surface-deep and accept that hover is invisible on the dark bands. Simplest, but a lost hover state.
> - **One band colour after all** — Fall back to spacing only; no card change.

**USER answered:**

Keep surface, add a 1px mint ring on hover (recommended)

Last code checks before writing: the order idempotency key format, `CardDetails`, and key pool size (demo orders use up keys).

*[2 tool calls: Bash ×2]*

Everything needed is gathered. One quick look at the layout shell and shared hooks so the spec names real props.

*[1 tool call: Bash]*

Writing the spec now: `docs/specs/0014-homepage-blocks/index.md` and `rationale.md`.

*[3 tool calls: Bash, Write ×2]*

Two small corrections to the spec text, then the completion steps.

*[3 tool calls: Edit ×2, Read]*

The spec is written and self checked. Every required section is present, and every AC traces to at least one build task. Feature 15 is on the Alpha tier.

**Claude asked — Cross check** (select one):

> Cross check this spec before you review it? (Recommended: Another model. It's Alpha tier, but the spec writes demo orders into production and changes ProductCard site wide, so a second read is cheap insurance.)
> - **Another model (recommended)** — A read only critique on a different capable model, focused on undecided values and missed failure modes.
> - **Same model** — A fresh eyes read only critique on this same model.
> - **I'll review it myself** — No AI critique; read docs/specs/0014-homepage-blocks/index.md yourself.
> - **Skip** — Go straight to accept.

**USER answered:**

Another model (recommended)

*[1 tool call: Agent · 1 subagent]*

I've written the draft spec to `docs/specs/0014-homepage-blocks/index.md`, with the reasoning in `rationale.md`. A read only cross check is running on a different model (Sonnet). I'll show you what it finds before you decide whether to accept.

- **Decision:** `GET /home` returns the block layout from a `home_blocks` table. Each block then loads from its own endpoint: `/home/banners`, `/home/best-sellers` and `/home/deals`, plus the existing `/products` grid.
- **Key tradeoff:** blocks only start loading after the layout call answers. That costs one extra round trip, and if the layout call fails, no blocks show.

Two things changed after reading the screenshots:
- **Hero:** it's now a strip of portrait tiles, not a wide carousel. That matches Eneba, and the Steam portrait art fits it better.
- **Card hover:** your `panel` pick fails AA contrast (3.73:1 for the platform and region line), so it's a 1px mint ring instead.

_⚙ Automated `peer` message (not written by the developer; content is in the full transcript)._

## CLAUDE · 2 (continued)

The cross check is back. Let me check two of its claims against the code before I summarize.

*[2 tool calls: Bash ×2]*

The cross check found real gaps. I checked the main claims against the code, and they hold: `PlaceOrder` needs the cart total, stock per offer can be 0 to 2, and line caps apply. Existing tests only seed `CatalogSeeder`, so adding demo orders to `DatabaseSeeder` won't break them.

**Decision gaps, each with my recommended fix:**

1. **Demo checkout inputs not named.** Get `expectedTotal` from `BuildCart::forUser()->totalCents()` just before `PlaceOrder`. Use card `4242424242424242`, expiry 12/2099, CVC `123`, name "Demo Buyer".
2. **Leftover cart lines can corrupt a rerun.** For each order: clear the demo cart, add the lines, then call `PlaceOrder`, all in one `DB::transaction`.
3. **Stock and offer choice undefined.** Pick the cheapest active offer with available keys, ordered by `price_cents`, then `id`. The data file only uses products whose planned stock covers their total planned units. A Pest test seeds catalog plus demo orders and asserts the seed succeeds.
4. **Ranking totals not pinned.** The demo orders file comments the intended per product totals (12 distinct values), and the happy path test asserts them.
5. **Reseeding restocks keys.** Note in Consequences that rerunning `CatalogSeeder` tops sold keys back up, so stock shifts between runs.
6. **Wrong field name.** AC-2 says `cover`; the real field is `cover_image_url`. `HomeSeeder` also fails if any of the 8 banner products is inactive.
7. **Band tone ambiguity.** Compute tone in CSS by DOM order (odd and even band sections), so hidden or empty blocks never put two same colour bands side by side.
8. **ErrorBoundary retry loop.** "Try again" also refetches that block's query, and the boundary is keyed on `dataUpdatedAt`.
9. **"Focus the 5th card" has no mechanism.** `ProductCard` forwards a `ref` (React 19 ref prop), and an effect after expanding focuses it. Expanded state survives a breakpoint change.
10. **ScrollRail details.** Use `aria-disabled` (not `disabled`) at the ends, so focus isn't dropped. End check is `scrollLeft + clientWidth >= scrollWidth - 1`. Hide both arrows when nothing overflows. Arrows overlay the left and right edges, vertically centred. The strip starts flush at the left edge.
11. **Tile text contrast and fallback.** The gradient covers the bottom 60%, from `black/90` to transparent, so text gets an AA row. Tiles use their own 1:2 placeholder, not `CoverImage`'s 2:3 one.
12. **Wrong cold start note.** Blocks start after `/home` answers, when the server is already awake. The real cost is just the serial round trip; I'll fix the Consequences text.
13. **Query counts.** State the exact expected counts (layout 1, banners 3, best sellers and deals 3 each) so the Pest test asserts them.

Small fixes I'll apply directly: hard coded UUID v4 keys, tests stub `matchMedia`, store skeleton default unchanged, and a note that the DB check constraint guards the enum cast.

**Claude asked — Gaps** (select one):

> How should I handle the 13 cross check gaps?
> - **Apply the recommended fixes (recommended)** — Targeted edits to index.md (ACs, Feature design, tests, Consequences) using the resolutions listed above.
> - **Let me answer each one** — Walk through the gaps one at a time.
> - **Leave them, I'll decide later** — Keep the spec as is; the builder will hit these.

**USER answered:**

Apply the recommended fixes (recommended)

Applying the fixes as targeted edits.

*[16 tool calls: Edit ×16]*

One cleanup: the query count line I just wrote for banners contradicts itself.

*[1 tool call: Edit]*

**Claude asked — Spec** (select one):

> All 13 cross check fixes are applied to docs/specs/0014-homepage-blocks/index.md. Accept this spec, or change it?
> - **Accept, looks solid (recommended)** — Spec stays Proposed; I tick 'Design it' in the scope, link the spec, and add the build milestones plus a Verify box.
> - **Change something, I'll tell you what** — Targeted edits to the sections you name.
> - **Rethink the approach** — Revisit a stage or option.

**USER answered:**

Accept, looks solid (recommended)

Accepted. Now I'll link it in the scope: tick the decision, add milestones and a Verify box (Alpha tier), and set the feature to in-progress.

*[2 tool calls: Edit ×2]*

The spec is accepted and linked in the scope: [0014-homepage-blocks/index.md](docs/specs/0014-homepage-blocks/index.md), with the reasoning and screenshot findings in [rationale.md](docs/specs/0014-homepage-blocks/rationale.md). Its status stays `Proposed` until `/develop` starts building it.

**What we decided:**
- A `GET /home` call tells the page which blocks to show, in what order, and with what titles.
- Each block then loads from its own endpoint: a hero strip of portrait tiles, Best sellers, Deals, and the existing Browse games grid.
- Every block has its own loading, error and empty states, so one broken block never takes down the page.

**Why:** it's the only shape that meets both halves of the brief. Nothing is hardcoded in the frontend, and every block has its own data source.

**Scope:** feature 15 is now `in-progress`, with the design box ticked, the spec linked, 4 build milestones and a Verify box.

**Before you build:**
- The `ProductCard` hover changes everywhere, not just on the homepage, because the `panel` hover failed contrast. It becomes a 1px mint ring.
- The demo seeder places 15 real orders in production when you run the manual `db:seed --force`. That's how Best sellers shows real order data on day one.
- I didn't add the Eneba card restyle (Add to cart, View offers, mint borders) to the scope, since you said site wide polish is handled separately. It's listed in the spec's Follow-up.

**Next:** run `/clear` for a fresh session (the spec is on disk, so nothing is lost), then `/develop homepage blocks`.
