# 0012. Store catalog: server side filters, sort, and name match on GET /products, and a URL driven /store page

**Date**: 2026-11-13
**Status**: Accepted

> **Partly superseded by [spec 0013](../0013-search-typo-tolerance/index.md)** (search with typo tolerance, 2026-11-13). The `q` name match in AC-1 (one `ILIKE` contains check) and the sort rules in AC-2 and AC-5 to AC-7 (three sort values, `name` always the default) no longer describe current behaviour: spec 0013 replaced the matcher with its word and trigram rules, added a `relevance` sort, and made the default sort `relevance` whenever `q` is set. For search and sort behaviour, read spec 0013 AC-1 to AC-3 and AC-11. Everything else in this spec still holds. The original text below is kept unchanged as history.

> **Partly superseded by [spec 0015](../0015-visual-fidelity-polish/index.md)** (visual fidelity and polish, 2026-11-14). The native "Sort by" `Select` in AC-6 is replaced by the custom `SortSelect` combobox in a toolbar row with the result count, and each filter group sits in its own panel from `lg` (spec 0015 AC-13, AC-14). The sort options, filter behaviour, and URL handling are unchanged. Everything else in this spec still holds.

## Summary

This spec builds the Store: a `/store` page where a visitor browses every product, ticks platforms and regions, sets a price range in euros, picks a sort order, searches by name, and pages through 24 results at a time. All filtering and sorting happens on the server, in the existing `GET /products` endpoint, which learns new query params (`q`, `platform`, `region`, `price_min`, `price_max`, `sort`). The page keeps its whole state in the URL, so a link can be shared and the back button undoes each change. A small new endpoint, `GET /catalog/filters`, gives the client the platform and region lists, so nothing is hardcoded. There is no schema change; typo tolerant search stays with feature 14, which will swap the name matcher behind the same `q` param.

## Requirements

**User stories**:
- As a visitor, I want to see every product in the marketplace, so that I can browse what is on sale.
- As a visitor, I want to narrow the list by platform, region, and price, so that I only see keys I can use and afford.
- As a visitor, I want to sort by price or name, so that I can find the cheapest key or a title I know.
- As a visitor, I want to search by name from the header and land on the store, so that I can jump straight to a game.
- As a visitor, I want the URL to hold my filters, so that I can share a link and use the back button.

**Acceptance criteria**:
- **AC-1**: `GET /api/v1/products` accepts optional query params `q`, `platform`, `region`, `price_min`, `price_max`, `sort`, and `page`, and returns the same `{ data: Product[], links, meta }` shape as today, 24 per page, active products only. `platform` and `region` are comma separated slug lists (`platform=steam,xbox`); values inside one param combine with OR, and different params combine with AND. `q` is trimmed; when it is not empty, it keeps products whose `name` contains it, ignoring case, with `%`, `_`, and `\` matched literally. `price_min` and `price_max` are whole euros and inclusive: a product passes when its cheapest in stock price (`cheapest_price_cents`, the existing `withCheapestPrice` scope) is at least `price_min × 100` and at most `price_max × 100`. When either price bound is set, products with no in stock offer (`cheapest_price_cents` null) are excluded. A call with no params returns exactly what it returns today, so the homepage list is unchanged. `meta.total` is the number of products matching all filters. The query count does not grow with the page size.
- **AC-2**: `sort` is one of `name` (default), `price_asc`, `price_desc`. Every sort has the shape `ORDER BY cheapest_price_cents IS NULL, <key>, name, id`, so products with no in stock offer come last in every sort (the leading `IS NULL` term is required, because Postgres puts nulls first in a descending order). `name` has no extra key (it is today's `orderBy('name')`, same collation, so the no param baseline holds). `price_asc` uses `cheapest_price_cents` ascending as the key; `price_desc` uses it descending. The order is stable across pages (no product appears on two pages or on none).
- **AC-3**: Invalid input returns 422 in Laravel's default error shape, keyed by the param name itself (`platform`, never `platform.0`): a `platform` or `region` slug that does not exist in the `platforms` or `regions` table (case sensitive; a slug that exists but has no active product is valid and simply gives 0 results); more than 10 values in one list, counted after empty items and duplicates are dropped; `price_min` or `price_max` that does not match `^(0|[1-9]\d{0,4})$` or is above 10000 (so `007`, `+5`, `1e3`, `5.0`, ` 5`, and `-0` are rejected); `price_min` greater than `price_max`, checked only when both are present; a `sort` outside the three values; `q` longer than 100 characters after trimming; any of these params sent as an array (`platform[]=steam`, `q[]=x`) instead of a string. Empty list items and duplicates are dropped before validation (`platform=steam,,steam` reads as `steam`; `platform=` reads as no platform filter), and a `q` that is empty or only whitespace after trimming reads as no `q`. Params not listed in AC-1 (for example `per_page`) are ignored. `page` keeps Laravel's paginator rule (missing, not an integer, or below 1 reads as page 1) and is capped at `ListProducts::MAX_PAGE` (100000), so a page near `PHP_INT_MAX` never overflows into page 1's rows. A page beyond the last returns 200 with `data: []` and the real `meta.last_page`. The endpoint is public, writes nothing, and keeps the `catalog` limiter (120 per minute per IP), so going over returns 429 with `Retry-After`.
- **AC-4**: `GET /api/v1/catalog/filters` (public, `catalog` limiter) returns 200 with `{ data: { platforms: { slug, name }[], regions: { slug, name }[] } }`, listing only platforms and regions that at least one active product uses, each ordered by `name`. It writes nothing.
- **AC-5**: `/store` reads its whole state from the URL params `q`, `platform`, `region`, `price_min`, `price_max`, `sort`, `page`, and sends them to `GET /products` unchanged. URLs are canonical: params with their default value (`sort=name`, `page=1`, empty lists, empty `q`) are left out, list values keep the order the visitor ticked them with commas written as a plain `,` (not `%2C`), and the params appear in that fixed order. A `page` that is not a whole number of 1 or more, a `sort` outside the three values, or a price that fails the AC-3 pattern is dropped. The route `loader` parses the params, and when the canonical search differs from the current one (compared as parsed values, never as raw strings) it returns `redirect()` to the canonical URL, which replaces the history entry. Unknown platform or region slugs are left in the URL and sent to the server (AC-3, AC-9). Every applied change (a checkbox, a price bound, the sort, a chip, Clear all, a page link) pushes one history entry, so the back button undoes it; a change that leaves the canonical search unchanged (Enter then blur on the same price, choosing the current sort) pushes nothing. Each change builds on the latest URL, not on the last render, so two changes made before the page re-renders both apply; such rapid changes may share one history entry (the second navigation replaces the first before it commits), provided no change is lost and back and forward still land on a correct state. Any change other than a page link removes `page`. A page link scrolls the window to the top (through a new optional `onNavigate` prop on `Pagination`); every other store navigation passes `preventScrollReset`. Back and forward restore the page the visitor was on, scroll included, through the router's normal scroll restoration. `price_min=0` is a real filter (it hides out of stock products, AC-1) and stays in the URL.
- **AC-6**: The page has a filter panel with three groups, each a `<fieldset>` with a `<legend>`: "Platform" and "Region" (one existing `Checkbox` per option from `GET /catalog/filters`, in the order it returns), and "Price (EUR)" (two labelled number fields, "Min" and "Max", `inputMode="numeric"`). A checkbox applies as soon as it changes. A price field applies on blur or Enter. An empty field removes that bound. The fields hold a typed draft in component state, and the draft and any inline error reset to the URL values whenever the URL's `price_min` or `price_max` changes (back, forward, a chip, Clear all). A value that is not a whole number from 0 to 10000 shows the inline error "Enter a whole number from 0 to 10000", and min above max shows "Min must not exceed max" on the Min field; in both cases nothing is applied. A "Sort by" `Select` above the results offers "Name: A to Z", "Price: low to high", "Price: high to low". From the `lg` breakpoint the panel is a left sidebar. Below `lg` it is hidden behind a "Filters" button (showing the number of active filter values when above 0) that opens the same panel in a native `<dialog>` with `showModal()`, titled "Filters", with a close button, Escape to close, and a footer button "Show N results" (N from the latest `meta.total`) that closes it. Changes inside the dialog apply live, as on desktop. Closing returns focus to the "Filters" button. The panel is rendered once, either in the sidebar or in the dialog, chosen by `matchMedia("(min-width: 1024px)")`, so the page never holds two copies of the same fields. The dialog's open state follows its native `close` event (Escape, the close button, and "Show N results" all go through it); the page behind it does not scroll while it is open; and if the viewport widens past `lg` while it is open, it closes and the sidebar takes over.
- **AC-7**: Above the results, each active filter shows as a removable chip: one per platform and per region (the option name from `GET /catalog/filters`, or the slug while those are loading), one for the price range ("€10 to €30", "From €10" including "From €0", "Up to €30", and "€10" when min equals max), and one for the search ("Search: witcher", truncated with an ellipsis by CSS when long). Sort has no chip. Each chip is a button with the accessible name "Remove filter: <label>" that removes just that filter. A "Clear all" button, shown when platform, region, a price bound, or a non default sort is set, removes platform, region, price, sort, and page and keeps `q`. With a non empty `q`, the `<h1>` reads `Results for "<q>"` (long text wraps) and the tab title `Results for "<q>" | Eneba Marketplace (demo)`; otherwise `<h1>` "Store" and the tab title "Store | Eneba Marketplace (demo)". The title uses a React 19 `<title>` element, as `CheckoutPage` does.
- **AC-8**: The results area shows "N results" ("1 result" for one) from `meta.total` inside a polite live region that is always mounted; the text shows only when data with `meta.total` above 0 is on screen (none while first loading, on error, or in the empty state). Below it come the existing `ProductGrid` of `ProductCard`s (products with no in stock offer show the existing "Out of stock" price) and the existing `Pagination` (`<nav aria-label="Store pages">`, "Page X of Y", hidden when there is one page). Its `hrefFor` builds each link with `toStoreSearch` and only `page` changed (no `page` param for page 1), so every other param is kept. When the API answers with `meta.total` above 0 and `meta.current_page` above `meta.last_page`, the page calls `navigate(<last page URL>, { replace: true })` (no `page` param when that is page 1), and the empty state never shows for that answer. With `meta.total` 0 the empty state shows (AC-9).
- **AC-9**: The first load shows a skeleton grid of 12 cards plus the shared slow notice once `useSlowPending` fires. Later changes keep the previous results on screen, dimmed, with `aria-busy="true"` on the results region, until the new page arrives (no skeleton flash). When `meta.total` is 0, the page shows `EmptyState` titled "No products match" with the message "Try removing a filter or searching for something else." and a "Clear filters" button (removes everything, `q` included, and goes to `/store`). A 422 answer shows, in the results area, an `ErrorState` styled message "Some filters in this link are not valid." with the same "Clear filters" button and no Try again; the filter panel, sort, and chips stay on screen, so the visitor can also remove the bad value with its chip. Any other failure replaces the results (the previous ones included) with the existing `ErrorState` showing the `ApiError` message (a 429 includes the seconds) and "Try again". The slow notice shows only on the first load; a later change that stalls keeps the dimmed grid. `productsQuery` sets a `staleTime` of 30 seconds, so refocusing the window does not spend the `catalog` budget. If `GET /catalog/filters` fails, only the Platform and Region groups are replaced by "Filters could not load." with a "Try again" button; the price fields, sort, results, chips (with slugs as labels), and pagination still work.
- **AC-10**: The header shows a "Store" `NavLink` to `/store` on every page, with `aria-current="page"` and the active text colour while on `/store`. The homepage "Browse games" section gets a "See all" link to `/store` next to its heading and otherwise stays as it is. The header search field keeps its own typed draft, and on `/store` the draft resets to the URL's `q` whenever that `q` changes (submit, back, forward, removing the chip); elsewhere it keeps its current behaviour. The input has `maxLength={100}`, so the form cannot send a `q` the server rejects. Submitting goes to `/store?q=<term>`, a fresh search that drops every other param (platform, region, price, sort, page); an empty term goes to `/store`; submitting the URL already shown adds no history entry.
- **AC-11**: Everything works at 360px with no sideways scroll; every checkbox, price field, the sort select, every chip, Clear all, the Filters button, the dialog and its buttons, and every pagination link are keyboard reachable with the global focus ring; every new text and background pair (the Filters count badge and chips included) is in the `client/design.md` contrast table (AA). `/ui` shows the filter panel (loaded, loading, error), the chips row, and the Filters button with and without a count. Client checks (`format:check`, `lint`, `typecheck`, `test`, `build`) and server checks (Pint, PHPStan, Pest) pass locally and in CI, and on the public deploy `/store?platform=steam&price_max=20&sort=price_asc` lists only Steam products of €20 or less, cheapest first, and opening one leads into the purchase journey.

## Decision

**Chosen option**: Option 2: extend `GET /products` with validated query params, add `GET /catalog/filters`, and build a URL driven `/store` page on TanStack Query.

All filtering, the name match, and sorting run in Postgres inside the existing `ListProducts` action, behind a new `ListProductsRequest` Form Request; the client only turns the URL into a request and renders what comes back.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no schema change, no migration. This feature only reads.

| Table | Read | Notes |
|---|---|---|
| `products` | `id`, `slug`, `name`, `platform_id`, `region_id`, `is_active`, plus the card fields `ProductResource` already reads | `active()` scope; filtered by `platform_id`, `region_id` (both indexed) and `name` (ILIKE, no index: 81 rows; trigram indexes belong to feature 14) |
| `offers` | `product_id`, `price_cents`, `is_active` | through `withCheapestPrice()`; the `(product_id, price_cents)` index serves the MIN subquery |
| `product_keys` | available keys per offer | through `availableKeys`, so the price means "cheapest you can buy now" |
| `platforms`, `regions` | `id`, `slug`, `name` | slugs map to ids for the filters; names feed `GET /catalog/filters` and the cards |

The price filter and price sort read `cheapest_price_cents` on the derived table that `ListProducts` already builds (`fromSub`), because Postgres cannot use a select alias inside `WHERE` or `ORDER BY` expressions.

**State transitions**: none on the server. On the client the results are `loading → (results | empty | invalid | error)`; a URL change moves `results → results` with the previous page kept and dimmed; `error → loading` on Try again; `invalid` (422) and `empty` leave only through "Clear filters" or another URL change. The mobile dialog is `closed ⇄ open`.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/products` | GET | `q`: string ≤100 (opt) · `platform`, `region`: comma slug list ≤10 (opt) · `price_min`, `price_max`: int 0 to 10000 euros (opt) · `sort`: `name`\|`price_asc`\|`price_desc` (opt, default `name`) · `page`: int (opt) | 200 `{ data: Product[], links, meta }`, `Product` unchanged | public, `throttle:catalog` | 422 (keyed by param), 429 |
| `/catalog/filters` | GET | none | 200 `{ data: { platforms: {slug,name}[], regions: {slug,name}[] } }` | public, `throttle:catalog` | 429 |
| `/products/{slug}` | GET | unchanged | unchanged | unchanged | unchanged |

Server shape: `ProductController::index(ListProductsRequest $request, ListProducts $action)` passes a validated `ProductFilters` value object (readonly: `?string $q`, `list<int> $platformIds`, `list<int> $regionIds`, `?int $minCents`, `?int $maxCents`, `ProductSort $sort`, `int $page`) to `ListProducts::handle()`. `ListProductsRequest::prepareForValidation()` leaves any non string value as is (so the `string` rule rejects it with 422 instead of a 500), and otherwise splits, trims, and dedupes the comma lists, trims `q`, and turns empty strings into null. The slug check is one `whereIn('slug', …)->pluck('id', 'slug')` per list in an `after()` validation hook, which adds the error under `platform` or `region` and hands the same map to `ProductFilters` for the ids (no `exists` per item). The `lte:price_max` rule is added only when `price_max` is filled. `ProductSort` is a string backed enum. In `ListProducts`, the name, platform, and region filters go on the inner `Product::query()->active()` query (so the cheapest price subquery runs on fewer rows); only the price filter and the sort run on the outer `fromSub` table. `CatalogFilterController` (invokable) calls a `ListCatalogFilters` action and returns a `CatalogFiltersResource`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| `GET /products` | which products match | `q`, `platform`, `region`, `price_min`, `price_max` params; `products.is_active`, `platform_id`, `region_id`, `name`; `cheapest_price_cents` |
| `GET /products` | slug to id for platform and region | `platforms.slug`, `regions.slug` (one lookup each, also used by the `exists` check) |
| `GET /products` | euros to cents for the price bounds | `price_min × 100`, `price_max × 100` (integers, never floats) |
| `GET /products` | order of results | `sort` param, default `name` (AC-2) |
| `GET /products` | card price, list price, discount | unchanged `ProductResource` (`cheapest_price_cents`, `list_price_cents`, `Discount::percent`) |
| `GET /products` | `meta.total`, `meta.last_page`, `meta.current_page` | Laravel's `LengthAwarePaginator` over the filtered query; page capped at `MAX_PAGE` |
| `GET /catalog/filters` | platform and region lists | `platforms`, `regions` joined to active `products`, ordered by `name` |
| `/store` | every filter, sort, and page value | the page URL's search params (AC-5), parsed by the route loader |
| `/store` | price field drafts and inline errors | component state, reset from the URL's price params on every change of them |
| `/store` | sidebar or dialog placement | `matchMedia("(min-width: 1024px)")` |
| `/store` | checkbox labels, chip labels | `GET /catalog/filters` names; the slug while it loads or fails |
| `/store` | "N results" and "Show N results" | `meta.total` of the latest answer (the previous one while the next loads) |
| `/store` | Filters button count | derived from the URL: number of platform slugs + region slugs + 1 if any price bound is set |
| `/store` | price chip text | `price_min`, `price_max` from the URL, formatted as whole euros with `€` |
| `/store` | `<h1>` and tab title | `q` from the URL |
| header | search field value on `/store` | `q` from the URL; elsewhere the field's own state |
| `/store` | "Page X of Y" | `meta.current_page`, `meta.last_page` |

**Key invariants**:
- The server alone decides what matches and in which order; the client never filters or sorts the list itself.
- Money stays integer cents on the server; euros appear only in the URL and the UI and are converted by `× 100`.
- A call to `GET /products` with no params is identical to the call before this spec (same rows, same order).
- Every sort ends with `id`, so pages never overlap or skip a product.
- The URL is the only source of the store's state; no filter lives only in component state once applied.
- Checkout's existing `invalidateQueries({ queryKey: ["products"] })` covers the store's queries, because their keys start with `"products"`. The filter options use the key `["catalog", "filters"]`, outside that prefix, so a purchase does not refetch them.
- The same `^(0|[1-9]\d{0,4})$` price pattern is used by `ListProductsRequest` and `storeParams.ts`.

**Security model**: both endpoints are public and read only, with the existing `catalog` limiter per IP. Inputs are validated and bound as query parameters (no raw SQL from the user); the `q` wildcard characters are escaped so a visitor cannot turn the match into an expensive pattern. Inactive products never appear. No personal data is involved.

**Configuration required**: none.

**Critical test scenarios**:
- Happy path: `?platform=steam,xbox&region=europe&price_max=30&sort=price_asc` returns only Steam or Xbox, Europe, at most €30.00, cheapest first, and `meta.total` matches; verifies **AC-1**, **AC-2**
- Out of stock: a product whose offers have no available key is last in every sort and disappears when `price_min=0` is set; verifies **AC-1**, **AC-2**
- No params: the response equals today's (same rows, same order), so the homepage does not change; verifies **AC-1**
- Name match: `q=WITCHER` finds The Witcher 3; `q=%` and `q=_` match only names containing those characters; verifies **AC-1**
- Invalid input: `platform=sega`, `price_min=50&price_max=10`, `price_max=9.5`, `price_max=007`, `sort=popular`, `platform[]=steam`, a 101 character `q` each return 422 keyed by the param (`platform`, not `platform.0`); `price_min=10` alone returns 200; `page=9223372036854775807` returns `data: []`, not page 1; verifies **AC-3**
- Price high to low: products with no in stock offer are still last; verifies **AC-2**
- Filter options: a platform with only inactive products is not listed; verifies **AC-4**
- URL state: ticking Steam then Xbox then pressing back leaves only Steam; `/store?sort=name&page=1` is replaced with `/store`; verifies **AC-5**
- Mobile: at 360px the Filters dialog opens, a tick updates the results behind it, "Show N results" closes it, focus is back on the Filters button; verifies **AC-6**
- Overflow: `/store?page=9` with 4 pages becomes `/store?page=4` with no empty state flash; verifies **AC-8**
- Auth/permission: none required; a visitor with no token gets the full store, and the 121st request in a minute gets 429; verifies **AC-3**

## Build plan

The project builds by Journey, so this plan finishes the whole discovery path through the store, every state included, before feature 14 starts. Server first, because the page has nothing to show until the API filters.

1. Server list filters: `ProductSort` enum, `ProductFilters` value object, `ListProductsRequest` (list splitting, the one query slug check in `after()`, the price pattern, the conditional `lte` rule, array input rejected), `ListProducts::handle(ProductFilters)` with the name match, platform, region, and price filters, the three sorts, and `MAX_PAGE`; Pest for each filter, their combinations, each sort across pages, out of stock placement, the no param baseline, every 422 case, the page cap, the 429, and the fixed query count. Satisfies **AC-1**, **AC-2**, **AC-3**
2. Server filter options: `ListCatalogFilters` action, `CatalogFiltersResource`, invokable `CatalogFilterController`, route `GET /catalog/filters` with `throttle:catalog`; Pest for the shape, the active product rule, and the order. Satisfies **AC-4**
3. Client data layer: `client/src/lib/storeParams.ts` (`parseStoreParams`, `toStoreSearch`, `canonicalStoreSearch`, `activeFilterCount`, `priceChipLabel`) with Vitest; `listProducts(params)` and `productsQuery(params)` with `placeholderData: keepPreviousData` and a 30 second `staleTime`; `getCatalogFilters` and `catalogFiltersQuery` (key `["catalog", "filters"]`, `staleTime` one hour); homepage `ProductListSection` moved to `productsQuery({})`. Satisfies **AC-5**, **AC-7**
4. `/store` route and page: loader that redirects to the canonical URL, `Pagination` `onNavigate` prop, `preventScrollReset` on other navigations, `<h1>` and title, result count, grid, `Pagination` with page overflow replacement and scroll to top, and every state (skeleton, slow notice, dimmed `aria-busy`, empty, 422, error); Vitest for the URL replacement and the states. Satisfies **AC-5**, **AC-8**, **AC-9**
5. Filters: `StoreFilterPanel` (fieldsets, checkboxes, price fields with inline validation, loading and error states), sort `Select`, the `lg` sidebar, and the mobile `FiltersDialog` on native `<dialog>` with the count button and "Show N results" (single panel instance by `matchMedia`, scroll lock, close on crossing `lg`); Vitest for price validation, draft reset from the URL, and that each change pushes exactly one history entry and a no op change pushes none (stub `HTMLDialogElement.prototype.showModal` and `close` in the Vitest setup, since jsdom lacks them; check focus return in the browser pass). Satisfies **AC-6**, **AC-9**
6. Chips, Clear all, and entry points: `ActiveFilterChips`, the header "Store" `NavLink`, the homepage "See all" link, and the header search draft synced to `q` on `/store` with `maxLength={100}`. Satisfies **AC-7**, **AC-10**
7. Finish: `/ui` showcase entries, `client/design.md` contrast rows for new pairs, 360px and keyboard pass, all client and server checks, CI, deploy, and the public `/store` run from the AC. Satisfies **AC-11**

## Consequences

**Positive**:
- One list endpoint serves the homepage, the store, and later search, so the card shape and price rules live in one place.
- The store's state lives in the URL, so links are shareable, the back button works, and `/check verify` can drive every case by typing URLs.
- Feature 14 only replaces how `q` matches (and may add a relevance sort); filters, URL handling, and the page are reused as is.
- No schema change and no new dependency.

**Negative / tradeoffs**:
- Strict 422 on unknown slugs means an old shared link with a removed platform shows an error state instead of partial results; the visitor removes the bad chip or presses "Clear filters".
- Instant apply sends one request per checkbox change; at the `catalog` limit of 120 per minute a very fast clicker could hit 429. Acceptable for 81 products and one visitor per IP.
- `ILIKE '%q%'` cannot use an index; fine at this size, and feature 14 replaces it.
- No per option counts, so a visitor can combine filters into zero results and only learn it from the empty state.
- Whole euro price bounds cannot express €9.99; the bound is inclusive at the whole euro.

**Neutral**:
- `productsQuery(page)` becomes `productsQuery(params)`, which touches the homepage call site.
- The order history review follow up on `ProductController::index` (page offset overflow) is closed by the `MAX_PAGE` cap in build task 1.
- A new `client/design.md` entry is needed for the chip and count badge colours if they introduce new pairs.

## Follow-up

- [ ] Feature 14 swaps the `q` matcher for a typo tolerant one and decides whether a `relevance` sort becomes the default when `q` is present.
- [ ] Revisit per option counts if the catalog grows enough that zero result combinations become common.
- [ ] The header `SearchForm` checks "same URL, no new entry" (AC-10) against the rendered location, the stale state `useStoreParams` had before its AC-5 fix. Two submits within one frame could push the same URL twice. Deferred, not observed in use.
