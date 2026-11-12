# 0007. Rationale: product page with seller offers

Decision record for [index.md](index.md). `/develop` builds from `index.md` and can skip this file.

## Context

The assignment asks for "the page for a single product, showing its details and the offers from several sellers, so a buyer can compare and choose." It is the second step of the purchase journey (home or search → product page → cart → checkout), and every product card already links to `/products/<slug>` (spec 0003), which today shows the 404 page.

The data is already in place. Spec 0002 models one product per listing (game, platform, region), one offer per seller on it, and stock as a count of unsold keys, never a stored column. The seed (spec 0004) gives each product 2 to 5 offers, some with no keys, so out of stock offers really exist. The list endpoint (spec 0005) already computes the cheapest in stock price and the discount on the server, with `Discount::percent`.

The forces here: the client runs on Vercel and the API on a Render free plan, so the first request after a quiet spell can take up to a minute; the home grid already handles that with a skeleton and a "waking up the server" notice. The cart (feature 9) does not exist yet, and the project rule is never to ship fake features. The comparison itself must be trustworthy: a buyer must see the same best price on the card and the page, and must never be offered a key that isn't there. There is no React Testing Library yet, so UI states are verified by hand.

Without this page the purchase journey is broken at its second step, and the cart has nothing to add from.

## Options considered

### Option 1: One detail endpoint, offers embedded and sorted on the server, `useQuery` in the page

`GET /api/v1/products/{slug}` returns details plus active offers, sorted, with `best_offer_id` and the discount computed on the server. The page reads it with `useQuery`, like the home grid.

**Pros**:
- One request, one loading state, one 404 for the whole page.
- Sorting and best offer logic sit next to the list endpoint's discount logic, so the card and page cannot disagree, and Pest can test the rule directly.
- Instant navigation; the cold start skeleton and slow notice match the home page.

**Cons**:
- Offers can't refresh on their own without refetching the details (small payload, so it barely matters).
- The 404 is handled inside the page, not by the router's error boundary.

### Option 2: Two endpoints, details and offers

`GET /products/{slug}` and `GET /products/{slug}/offers`, fetched in parallel.

**Pros**:
- Offers could refresh on a short timer while details stay cached.
- Each response is simpler.

**Cons**:
- Two loading and error states on one page, plus the "details loaded, offers failed" partial state.
- The buy box needs the best offer, which lives in the second call, so the hero can't render fully from the first.
- Two rate limit hits per page view.

### Option 3: Same endpoint, but loaded in a route loader

The `/products/:slug` route's loader calls `queryClient.ensureQueryData` and throws a 404 response to an `ErrorBoundary`.

**Pros**:
- Clean router level 404 handling, and data arrives before render.
- Matches how auth guards already use loaders.

**Cons**:
- Navigation freezes on the old page until data arrives, which on a Render cold start can be a minute with no feedback beyond the router's pending state.
- Different loading pattern from the home grid, so two patterns to explain.

## Rationale

Option 1 wins on the forces that matter most here. A buyer comparing offers needs the whole page at once, and the buy box depends on the best offer, so splitting the data (Option 2) adds a partial state that has no real benefit at 2 to 5 offers per product. Keeping the sort, best offer, and discount on the server follows the rule spec 0003 set for the discount badge: the client only displays, so the store, the home blocks, and this page always agree.

Option 3's router level 404 is tidy, but the Render cold start makes a blocking loader a bad experience, and the home grid already solved this exact problem with `useQuery`, a skeleton, and the slow notice. Reusing that pattern means one way to load data in the app, which is easier to explain in the review.

Smaller calls made while writing (each with its runner up):
- **Sort in PHP, not SQL.** At 2 to 5 offers a collection sort is clearer and easy to test; the runner up, an SQL `ORDER BY` with a `CASE` for unrated sellers, only pays off for long lists.
- **`best_offer_id` from the server**, rather than the client picking the first in stock row: it keeps the "client never decides" invariant and makes the rule testable in Pest.
- **Rating sent as basis points**, formatted by a small client helper; the runner up, a preformatted string from the server, would make sorting and future reuse harder.
- **`release_date` as `YYYY-MM-DD`**, formatted in UTC on the client, so no visitor time zone shifts the day.
- **Exact `stock` integer**, chosen by you, because the cart needs it for its quantity cap; flags only would have forced a second source later.
- **No buy button yet**, chosen by you: the cart spec owns adding to the cart, and a disabled or dead button would be a fake feature.
- **Separate `ProductDetailResource`**, not a bigger `ProductResource`, so the list response stays lean.
- **Slug route constraint `[a-z0-9-]+`**, matching how the seeder builds slugs (`Str::slug`), so junk paths 404 before any query runs.
