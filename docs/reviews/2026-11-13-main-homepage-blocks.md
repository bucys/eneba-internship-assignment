# Review, main (commit 5b8262e), 2026-11-13

**Reviewed by**: Claude Sonnet 5.5 (author on a different session)
**Scope**: 50 files, commit 5b8262e vs its parent
**Verdict**: Approve with nits

## Summary
You added a layout endpoint, three block endpoints, two tables, two seeders and a block based homepage with per block loading, error and empty states. The code follows the spec closely and the project rules (thin controllers, actions, resources, integer money, named exports, Postgres tests). I found no blockers and no majors. The notable points are the extra request fan out on first load and a few small client details.

## Minor
### 🟡 First load now makes 5 API calls, which hurts on a slow host, `client/src/pages/HomePage.tsx:77`
**Problem**: Before this commit the home page made 1 call (`/products`). Now it makes `/home` first, and only after that answers it starts 4 more calls at once (banners, best sellers, deals, products). That is a waterfall (layout, then blocks) plus a fan out of 4.
**Why it matters**: This makes your production observation worse, not better. If Render serves requests one after another (small instance, few PHP workers, or a new Neon connection per request), the 4 parallel calls queue behind each other, so the last block can show up 4 times later than one call alone. Your numbers (about 0.9 s alone, 6 to 9 s each when concurrent) fit that. The diff itself is correct and matches the spec; the cost is the design choice in the spec (one endpoint per block, no cache). It matters most for the cold start the reviewer will see first. The 120 per minute limit is not a risk here (5 calls per visit).
**Suggested fix**: Pick the cheapest one. Check how many PHP-FPM children and what CPU the Render instance has. Add a short `Cache-Control: public, max-age=30` on the four GET endpoints (best sellers says "no server cache", but a browser cache of a few seconds does not break "moves on the next fetch" much; if you disagree, skip this). Or prefetch the block queries in the router loader, or start the `/products` request in parallel with `/home`. A combined endpoint is the biggest change and probably not worth it.

### 🟡 `ScrollRail` re-renders on every scroll event, `client/src/components/ui/ScrollRail.tsx:51`
**Problem**: `update` always calls `setEnds` with a new object, so React re-renders the rail for every scroll event even when nothing changed.
**Why it matters**: Small extra work while the user swipes a rail of 12 cards. Not a bug.
**Suggested fix**: Keep the previous state when the three booleans are equal, for example by comparing inside a functional `setEnds`.

### 🟡 Band colours can flip after a block resolves empty, `client/src/components/home/HomeQueryBlock.tsx:39`
**Problem**: While a rail loads, its skeleton is a `data-band` section and takes a colour. If the endpoint then returns an empty list, the block renders nothing and the bands after it swap colours.
**Why it matters**: A visible colour flash in the rare empty case. The final state is correct (AC-12 holds).
**Suggested fix**: Accept it, or note it in the spec as a known limit.

### 🟡 `DemoOrdersSeeder` relies on `AddCartItem` capping quantities, `server/database/seeders/DemoOrdersSeeder.php:73`
**Problem**: The seeder detects a silent cap by re-reading the stored quantity. That check is good, but it only protects the seeder.
**Why it matters**: Your second observation (a 10 unit order charged for 6) points to the cart capping to available keys without telling the caller. This diff does not change `AddCartItem`, `BuildCart` or `PlaceOrder`, so it is not caused here. The seeder only calls them. Worth a separate bug if the cart or checkout page does not show the user that the quantity was reduced.
**Suggested fix**: Handle it in its own change (return or flag the capped quantity to the client).

## Nits
- ⚪ `server/app/Actions/Home/ListDeals.php:25`, the percent expression divides by `list_price_cents`; it is safe because the `whereColumn` guard keeps it above the cheapest price, but a short comment on that would help a junior reader.
- ⚪ `client/src/components/home/ProductRailBlock.tsx:86`, `aria-expanded={false}` is a constant because the button disappears once expanded; fine, but a one line why comment would help.
- ⚪ `server/database/seeders/HomeSeeder.php:46`, reseeding overwrites a block `title` edited by hand (by design per AC-6, only `is_active` is protected).

## Strengths
- Failure isolation is built at both levels (request errors and render crashes through a keyed `ErrorBoundary`) and is tested.
- Server queries have fixed query counts that are asserted equal for 1 and 12 results; the deals SQL percent matches `Discount::percent`, so the order always matches the shown percent.
- Seeders are idempotent, go through the real checkout actions, and keep hand hidden rows hidden.
- Accessibility is thought through: `aria-disabled` arrows, inset focus rings, a single hidden `h1`, focus moved on "Show all".

## Test coverage
Good. Server: Pest feature tests for each endpoint (ordering, visibility, edge discounts, query counts, 429 limiter), both seeders (idempotency, real stock) and the rollback. Client: `HomePage.test.tsx` covers layout order, per block failure, empty and unknown blocks, layout failure, render crash with retry, mobile Show all with focus, and the desktop rail; `home.test.ts` covers keys and fetch paths. Not covered: `ScrollRail` arrow end states and scroll behaviour (jsdom has no layout, so this is reasonable to leave to the browser verify), and `BannerTile` image error fallback.
