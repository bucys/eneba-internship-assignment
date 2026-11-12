# Review, main (product page, feature 8), 2026-11-12

**Reviewed by**: Claude Sonnet 5.5 (author on same family; fresh context)
**Scope**: 28 files, commit range 2eca479..1d4f4f6 on main
**Verdict**: Approve with nits

## Summary
Adds `GET /api/v1/products/{slug}` (route regex, `throttle:catalog`, thin controller, `ShowProduct` action, two Resources) and the `/products/:slug` page with hero, buy box, offer list, About, skeleton, 404 and error states, plus `CoverImage` extraction. The code matches spec 0007 AC-1 to AC-10 closely: server-side sort and best offer, money as cents, no key codes exposed, fixed query count. Only minor robustness and polish issues found.

## Minor
### 🟡 Background refetch error replaces already-loaded page, `client/src/pages/ProductPage.tsx:46`
**Problem**: The error branch is `query.isError && !query.isFetching` with no `!query.data` guard. If data is cached and a later refetch fails (remount after the 60 s stale time, 429, network blip), TanStack keeps `data` but sets `isError`, so the whole page is swapped for `ErrorState` or "Game not found".
**Why it matters**: A buyer who is looking at a good page loses it because of a transient failure of a background refresh. `refetchOnWindowFocus` is off, which limits exposure, but remounts and future invalidation (cart/checkout, spec follow-up) will hit this.
**Suggested fix**: Only take the error branch when there is no data (`!query.data`), or keep showing the data and surface the error as a toast/alert. A 404 on refetch with cached data is the one case worth treating as not found.

### 🟡 Page states and rows have no component-level coverage, `client/src/pages/ProductPage.tsx`
**Problem**: Branching UI logic (404 vs error vs loading vs loaded, "Only N left", out-of-stock row, About fact hiding, "New seller"/plural rating text, empty offers) is verified only by hand. Spec accepts this (no RTL yet), so not blocking.
**Suggested fix**: When React Testing Library lands, cover `ratingText`, `ProductAbout` hiding rules and the `isNotFound` branch first. Extracting `ratingText` into `lib/format.ts` would allow a plain Vitest unit test now.

### 🟡 Missing title outside loaded/404 states, `client/src/pages/ProductPage.tsx:55,64`
**Problem**: Loading and generic-error states set no `<title>`, so the tab keeps the previous page's title (e.g. the previous game) while loading another slug.
**Why it matters**: Misleading tab/history titles and screen reader announcements; spec only mandates loaded and 404, so this is a gap beyond the AC.
**Suggested fix**: Render the site-title `<title>` in the loading and error branches.

## Nits
- ⚪ `client/src/pages/ProductPage.tsx:22`, `ProductNotFound` is defined inline; spec's component inventory puts it in `components/product/`.
- ⚪ `client/src/components/product/OfferRow.tsx:48`, empty `<span>` for non-low-stock rows is intentional spacing but unexplained; a one-line WHY comment would help.
- ⚪ `client/src/api/products.ts:11`, `Product.cover_image_url` is typed `string` while `CoverImage` accepts `string | null`; harmless (column is NOT NULL), just inconsistent.
- ⚪ `server/app/Actions/Catalog/ShowProduct.php:63`, seller name tie-break uses binary `<=>` (case-sensitive); fine for seeded data, differs from a case-insensitive "name ascending" reading.
- ⚪ `client/design.md`, component table does not yet list `CoverImage`, `BuyBox`, `OfferRow` etc.; spec already schedules this for `/sync`.

## Strengths
- Server owns sorting, best offer, price and discount; resource reuses `Discount::percent` and a regression test pins list vs detail agreement.
- OfferResource exposes stock as a count only; a test asserts no `code` anywhere in the raw body. Comprehensive Pest coverage: tie-break dataset, nulls, inactive, 404 variants, 429 + Retry-After, fixed query count (5).
- Clean client structure: small presentational components, `key={slug}` resets slow-notice timer, UTC-safe date formatting, accessible headings (one `<h1>` in every state), `<ul>` semantics, `sr-only` "was" on struck price, contrast choices documented in design.md.

## Test coverage
Server: AC-1 to AC-4 thoroughly covered (shape, order, ties, filtering, no-stock, regression vs list, 404s, rate limit, query count). Client: `formatRating`/`formatReleaseDate`, type label map and query key are unit tested; page states, OfferRow and ProductAbout logic are untested (accepted per spec, no RTL).
