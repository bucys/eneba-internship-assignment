# 0011. Order history: rationale

## Context

Journey 1 promises that a buyer can "find it again in order history". Specs 0009 and 0010 already create paid orders, give each unit its own key, and show those keys on `/orders/{ulid}`, but a buyer can only reach that page from the checkout redirect. Once they leave it, the only way back is the URL. `/orders` is a placeholder behind the sign in guard, already linked from the account menu.

The forces at play: the list must show only the caller's own orders, and nothing about another account may leak (the same 404 parity spirit as spec 0009 AC-9). Key codes must stay behind their owner only, never cached endpoint (spec 0010). The demo data is small, but the assignment is judged on correct backend behaviour, so an unbounded list or an N+1 query (one extra query per row) would be visible flaws. The client already has a paginated response type (`Paginated<T>`) from the product list, a query key convention under `"me"` that sign out clears, and page state patterns (skeleton, slow notice, error retry, empty).

The order page has one honest wording problem: its heading always reads "Payment successful", which is wrong when the same page is opened weeks later from history. Router state survives a reload, so a naive flag from checkout would keep saying "Payment successful" after F5.

Not deciding leaves Journey 1 unfinished and the account menu pointing at an empty page.

## Options considered

### Option 1: Reuse the full `OrderResource` in an unpaginated list

`GET /orders` returns every order with all its items, the same shape as `GET /orders/{ulid}`, and the client derives the row text.

**Pros**:
- No new resource or type; one order shape everywhere.
- The client could open an order instantly from the list cache.

**Cons**:
- The payload grows with every item of every order, and without pagination with every order too.
- An unbounded list endpoint is a known production incident, and a reviewer flag.
- The client must compute counts that the database computes for free.

### Option 2: A slim, paginated summary endpoint, and the existing order page as the detail (chosen)

`GET /orders` returns 10 `OrderSummary` rows per page (`item_count`, `line_count`, and `first_item` computed with `withSum`, `withCount`, and a `oldestOfMany` relation), in four queries for any page. The client keeps the page in `?page`, and the order page uses router state to tell a fresh purchase from a later visit.

**Pros**:
- Sends exactly what a row shows; no items and no codes in the list.
- Fixed query count, and bounded payload per request.
- Reuses the order page, keys endpoint, and reveal flow of spec 0010 unchanged.
- URL driven pages survive reload and back navigation, and match the Laravel paginator the product list already uses.

**Cons**:
- A second order shape to keep in sync for the shared fields.
- Offset pagination can skip or repeat a row while new orders arrive.
- The arrival flag depends on checkout passing router state.

### Option 3: A load more list (infinite query)

The same summary endpoint, but the client appends pages with `useInfiniteQuery` behind a "Load more" button.

**Pros**:
- Feels smoother on phones; no page numbers to read.

**Cons**:
- Position is lost on reload and when coming back from an order.
- Adds a second query pattern the project does not use yet, which is harder to explain.
- Focus management after appending needs extra care for keyboard users.

### Option 4: A separate detail route for history

Keep `/orders/{ulid}` as the confirmation only, and add `/orders/{ulid}/details` for history, sharing components.

**Pros**:
- Clear split between "just paid" and "viewing later", with no router state.

**Cons**:
- Two URLs for one order, so shared or bookmarked links disagree.
- Page states (loading, not found, error) are duplicated across two routes.

## Rationale

Option 2 fits the forces best. Correct backend behaviour is what the assignment judges, and a paginated, owner scoped list with a fixed query count is the textbook answer that a junior can still explain line by line: one action with `withSum`, `withCount`, and one `HasOne` relation. The summary shape keeps the security line from spec 0010 sharp: codes come only from the keys endpoint, and the list never carries items at all.

URL pages (over Option 3) match the paginator and `Paginated<T>` type the product list already uses, so nothing new is learned, and the buyer returns to the same page after opening an order (the `fromPage` back link). Keeping the existing order page (over Option 4) means one URL per order and no duplicated states. The "Payment successful" problem is solved with the smallest honest mechanism: checkout passes `justPaid`, the page reads it once and clears it from history, so a reload or a later visit reads "Order details".

The engineer confirmed each of these calls in the design conversation (summary rows, 10 per page, arrival based heading read once then cleared, empty state with a store link, slim resource, item count as keys, no migration, client side clamping, last 8 ULID characters, back link to the same page). Calls settled at write time: the list query key is a sibling (`["me", "order-list", page]`) rather than a child of `["me", "orders"]`, so invalidating the list never refetches an open order or its keys (runner up: a child key, simpler to invalidate but noisy). `placeholderData: keepPreviousData` keeps rows on screen between pages (runner up: a skeleton per page, which flashes). `Pagination` is a generic `ui` component because feature 13 pages too (runner up: keep it in `orders/` until a second user exists). The list is invalidated on checkout success rather than given `staleTime: 0` (runner up: always refetch, which wastes requests on every visit).
