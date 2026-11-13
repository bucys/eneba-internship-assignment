# 0012. Store catalog: rationale

## Context

The assignment asks for a Store: "a catalog where visitors can browse every product in the marketplace", narrowed "with filters (for example platform, region or price)", reordered, and searchable by name. The scope commits to going deep on search and store, and feature 13's done line asks that filters and sort combine correctly on the server, that state lives in the URL, that result counts and the no results state render, and that the layout works on mobile.

What exists today: `GET /products` lists active products, 24 per page, in one fixed order (in stock first, then name), with the cheapest in stock price computed per product by a subquery. The homepage calls it for page 1. The header search already navigates to `/store?q=<term>`, a route that does not exist yet. The seed has 81 products across 4 platforms and 3 regions, priced from the cheapest offer that still has a key; a product with no key in stock has no price.

The forces: a 3 to 4 day budget with features 14 and 15 still ahead, so the store must reuse what is built (card, grid, pagination, select, checkbox, query setup) and must not make feature 14 redo it. Money must stay integer cents. The data is small enough that Postgres handles every filter without new indexes, but the design must stay correct (stable paging, honest counts) as data grows. The developer must be able to explain every line, which argues against new libraries.

If this is not decided up front, the risk is a client side filter over one big list (wrong counts, no paging, breaks with growth) or a page whose state lives in component state (no shareable link, a broken back button), both of which fail the done line.

## Options considered

### Option 1: Load the whole catalog once and filter and sort in the browser

`GET /products?per_page=all` returns every product; the client filters, sorts, and pages in memory.

**Pros**:
- Instant filter changes with no request per click.
- Per option counts are trivial to compute.

**Cons**:
- Fails the done line: filters and sort must combine on the server.
- Breaks the "pagination is not optional" rule; payload grows with the catalog.
- Duplicates the price and stock rules in TypeScript, so the server and the client can disagree.

### Option 2: Extend `GET /products` with validated query params, add `GET /catalog/filters`, URL driven page (chosen)

`ListProducts` takes a validated filter object and builds one query; a small endpoint serves the filter option lists; `/store` maps the URL to the API call one to one.

**Pros**:
- One endpoint, one card shape, one price rule for the homepage, the store, and search.
- The URL format equals the API format, so the client is a thin mapper and links are shareable.
- Fits the project's controller, Form Request, action, resource shape.

**Cons**:
- One request per applied change.
- The no param behaviour must be kept exactly, or the homepage changes.

### Option 3: A dedicated `GET /store` endpoint with facet counts in `meta`

A new endpoint returns the filtered page plus per option counts (each computed with the other filters applied).

**Pros**:
- Eneba like counts next to each option; fewer zero result dead ends.
- Leaves `GET /products` untouched.

**Cons**:
- Two list endpoints to keep in sync, or a refactor to share them.
- One extra aggregate query per facet, and the hardest tests in the feature, for a 81 product catalog.

### Option 4: Option 2, but filter options in every `/products` `meta`

Same as Option 2 without the second endpoint; the lists ride along on every response.

**Pros**:
- One request on first load instead of two.

**Cons**:
- Repeats static data on every page, sort, and filter change.
- Mixes two caching lifetimes in one response.

## Rationale

Option 2 is the smallest design that meets every line of the done criteria. Filtering and sorting on the server is required by the scope, and putting it in the existing `ListProducts` action keeps the homepage, the store, and feature 14 on one list query, one `ProductResource`, and one definition of "cheapest in stock price". Using the same param format in the page URL and the API call makes the client a thin, testable mapper (`storeParams.ts`), which is what makes the URL the source of truth and the back button correct.

The engineer chose strict validation (422 for unknown slugs, min above max, a bad sort) over silently ignoring bad input. That costs a small error state but never shows results that do not match the chips on screen, and it follows the Form Request convention the rest of the API uses. Whole euro bounds keep the URL readable while the server keeps integer cents (`× 100`), in line with the money rule.

Per option counts (Option 3) were declined for this feature: the done line asks only for the total, and the facet queries would be the most expensive part to build and test with little value at 81 products. Filter options get their own endpoint (Option 2 over Option 4) because they change far less often than results and can be cached for an hour on the client. Plain `ILIKE` for `q` keeps the store complete now; feature 14 replaces only the matcher. Keeping previous results dimmed during a change, native `<dialog>` for the mobile drawer, and reusing `Pagination` (including the order history overflow rule of replacing the URL with the last page) all reuse what the project already has instead of adding libraries or new patterns.
