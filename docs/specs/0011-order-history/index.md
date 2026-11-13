# 0011. Order history: a paginated summary list endpoint, a /orders page, and an order page that knows how you arrived

**Date**: 2026-11-13
**Status**: In Progress

## Summary

This spec lets a signed in buyer find every past order again and open it to reveal its keys. A new `GET /orders` endpoint returns the buyer's own orders, newest first, 10 per page, as slim summaries (no item list, no key codes). The `/orders` page shows one summary row per order, with Previous and Next links. Opening a row reuses the order page from spec 0010, which now says "Order details" with a "Back to my orders" link, and keeps "Payment successful" only for the visit right after checkout. Nothing is written to the database and no migration is needed.

## Requirements

**User stories**:
- As a buyer, I want to see all my past orders, newest first, so that I can find a game I bought earlier.
- As a buyer, I want each order to show what I bought, when, and for how much, so that I can tell orders apart without opening them.
- As a buyer, I want to open an old order and reveal its keys again, so that I can redeem a key I did not use yet.
- As the store, I want each buyer to see only their own orders, so that no account ever exposes another's purchases.

**Acceptance criteria**:
- **AC-1**: `GET /api/v1/orders` (Bearer) returns 200 with Laravel's default paginated resource collection shape, `{ data: OrderSummary[], links, meta }` (the same shape as `GET /products`, read by the client's existing `Paginated<T>` type), 10 orders per page. It lists only the caller's orders, ordered by `created_at` descending, then `id` descending. Each `OrderSummary` is `{ ulid, status, total: Money, paid_at, item_count, line_count, first_item: { product_name, cover_image_url } }`: `item_count` is the sum of `quantity` over the order's items (the number of keys), `line_count` is the number of order items, and `first_item` is the item with the lowest `order_items.id` (the first one in cart order, spec 0009 AC-2). `product_name` is the order time snapshot, and `cover_image_url` is the live product cover, as in `OrderItemResource`. No item list and no key code appear anywhere in the response. The endpoint writes nothing, and its query count does not grow with the number of orders on the page.
- **AC-2**: `?page` follows Laravel's paginator rule: a value that is missing, not an integer, or below 1 reads as page 1. A page beyond the last returns 200 with `data: []` and `meta.last_page` set to the real last page. A buyer with no orders gets 200 with `data: []`, `meta.total` 0, and `meta.last_page` 1. No token returns 401. The endpoint uses the `account` limiter (60 per minute per user, shared with `GET /orders/{ulid}` and its keys), so going over returns 429 with `Retry-After`. Orders of other users never appear on any page.
- **AC-3**: The `/orders` page (still behind the existing sign in guard) has the tab title "My orders | Eneba Marketplace (demo)" and the `<h1>` "My orders". It renders one row per order in an `<ul aria-label="Orders">`. Each row is a single link to `/orders/{ulid}` that passes router state `{ fromPage: <current page> }`, and it shows: the first item's cover (`alt=""`, because the product name next to it is text), the first item's `product_name`, "and 1 more product" or "and N more products" when `line_count` is above 1 (N is `line_count − 1`), "1 item" or "N items" from `item_count`, the paid date (`Intl.DateTimeFormat` with `dateStyle: "medium"`, inside `<time dateTime={paid_at}>`), the order number as `#` plus the last 8 characters of the ULID in uppercase, a "Paid" status badge, and the total with the existing `Price` component. The row's accessible name comes from its visible text. The list sends no keys request.
- **AC-4**: The current page comes from `?page` in the URL. A value that is not a whole number of 1 or more reads as page 1, and the URL is replaced with `/orders`. Page 1's URL is always `/orders` (never `?page=1`). Below the list, a pagination nav (`<nav aria-label="Order pages">`) shows "Page X of Y" plus Previous and Next links to the neighbouring page URLs. On page 1, Previous is not a link but a `<span aria-disabled="true">`, and the same goes for Next on the last page. The nav is hidden when `meta.last_page` is 1. Changing pages keeps the current rows on screen until the next page arrives (no skeleton flash), then scrolls the window to the top. If the API answers with `meta.current_page` above `meta.last_page`, the URL is replaced with the last page's URL (`/orders` when that is page 1), and the empty state never shows for that answer.
- **AC-5**: While the first page loads, the page shows an order list skeleton (3 rows), plus the shared slow notice once `useSlowPending` fires, as on the other pages. A failed request shows the existing `ErrorState` with the `ApiError` message (the 429 message includes the seconds) and a "Try again" button that refetches. When `meta.total` is 0, the page shows `EmptyState` with the title "No orders yet", the message "Keys you buy will appear here.", and a "Browse games" `LinkButton` to `/`. The pagination nav is not shown in the loading, error, or empty states.
- **AC-6**: The list is fresh after a purchase. A successful checkout invalidates every order list query, so the new order is the first row of `/orders` on the next visit with no reload. Sign out removes the list from the cache (its query key starts with `"me"`), as it already does for the order and keys queries.
- **AC-7**: Checkout navigates to `/orders/{ulid}` with router state `{ justPaid: true }` (still `replace: true`). The order page reads `justPaid` once, on mount, into local state, then replaces its history entry with no router state, so this visit keeps saying "Payment successful" (tab title "Order confirmed | Eneba Marketplace (demo)") and a reload or any later visit to the same entry says "Order details" (tab title "Order details | Eneba Marketplace (demo)"). Every visit without `justPaid` (history row, reload, typed or shared URL) shows the `<h1>` "Order details" and, above it, a "Back to my orders" link to `/orders?page=n` when the router state carries `fromPage` as a whole number above 1, else to `/orders`. The key reveal, copy, and hide behaviour (spec 0010) and the "Continue shopping" button are unchanged in both cases. The "Order not found" and error states are unchanged.
- **AC-8**: Everything works at 360px with no sideways scroll, every row and pagination link is keyboard reachable with the global focus ring, every new text and background pair (the "Paid" badge included) is in the `client/design.md` contrast table (AA), and `/ui` shows an order summary row (one product, several products) and the pagination nav (first, middle, and last page). Client checks (`format:check`, `lint`, `typecheck`, `test`, `build`) and server checks (Pint, PHPStan, Pest) pass locally and in CI, and on the public deploy a fresh purchase appears first in `/orders`, opens as "Order details" from there, and reveals its key.

## Decision

**Chosen option**: Option 2: a slim, paginated summary endpoint, a URL driven `/orders` page, and the existing order page as the detail, told by router state whether the buyer just paid.

`GET /orders` returns 10 owner scoped `OrderSummary` rows per page, computed in a constant number of queries; the client renders them as summary links with Previous and Next, and `/orders/{ulid}` becomes "Order details" unless checkout says otherwise.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no schema change, no migration. This feature only reads.

| Table | Read | Notes |
|---|---|---|
| `orders` | `id`, `ulid`, `user_id`, `status`, `total_cents`, `paid_at`, `created_at` | found through `$user->orders()`, so ownership is part of the query; sorted by the existing `(user_id, created_at)` index, then `id` |
| `order_items` | `id`, `order_id`, `product_id`, `product_name`, `quantity` | summed and counted per order; the lowest `id` is the first item |
| `products` | `id`, `cover_image_url` | the live cover of the first item, as in `OrderItemResource` |

`paid_at` and `created_at` are set in the same checkout transaction (spec 0009 `PlaceOrder`), so sorting by `created_at` matches the date the row shows.

**State transitions**: none on the server; `OrderStatus` has only `paid`. On the client the list is `loading → (rows | empty | error)`, `error → loading` on Try again, and `rows → rows` on a page change (the previous rows stay until the next page arrives). The order page's arrival flag is `justPaid` (read once on mount) `→` cleared from history; it never comes back for that entry.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/orders` | GET | query `page`: int (opt, default 1) | 200 `{ data: OrderSummary[], links, meta }` | Bearer, `throttle:account` | 401, 429 |
| `/orders/{ulid}` | GET | unchanged | unchanged | unchanged | unchanged |
| `/orders/{ulid}/keys` | GET | unchanged | unchanged | unchanged | unchanged |

Server shape (thin controller → action → resource, per `AGENTS.md`):

- Route above `orders.show`: `Route::get('/orders', [OrderController::class, 'index'])->middleware(['auth:sanctum', 'throttle:account'])->name('orders.index')`. No Form Request: `page` is the only input and Laravel's paginator already resolves it (AC-2), the same as `ProductController::index`.
- `Order::firstItem(): HasOne` as `$this->hasOne(OrderItem::class)->oldestOfMany('id')`, documented as "the first item in cart order (spec 0009 AC-2)".
- `App\Actions\Orders\ListOrders` with `public const PER_PAGE = 10` and `handle(User $user): LengthAwarePaginator<int, Order>`, which runs `$user->orders()->withSum('items as item_count', 'quantity')->withCount('items as line_count')->with(['firstItem:id,order_id,product_id,product_name', 'firstItem.product:id,cover_image_url'])->orderByDesc('created_at')->orderByDesc('id')->paginate(self::PER_PAGE)`. That is the count query, the page query (sum and count as subqueries), one `firstItem` query, and one product query: four queries for any page size.
- `App\Http\Resources\OrderSummaryResource` returns `ulid`, `status` (`->value`), `total` (`Money::eur($order->total_cents)`), `paid_at` (`->utc()->toIso8601ZuluString()`, as in `OrderResource`), `item_count` (`(int)` cast, because a Postgres `SUM` may arrive as a string), `line_count` (`(int)`), and `first_item` (`product_name` from the snapshot, `cover_image_url` from `firstItem->product`). A doc comment says it never carries items or codes.
- `OrderController::index(Request $request, ListOrders $listOrders): AnonymousResourceCollection` returns `OrderSummaryResource::collection($listOrders->handle($user))`.

Client shape:

- `api/orders.ts`: `OrderSummary` type (mirrors `OrderSummaryResource`, `status: "paid"`), `getOrders(page, signal)` (`apiFetch<Paginated<OrderSummary>>` GET `/orders?page=${page}`), `ORDER_LIST_KEY = ["me", "order-list"] as const`, `orderListQueryKey(page)` = `["me", "order-list", page]` (a sibling of `["me", "orders", ulid]`, so invalidating the list never refetches an open order or its keys), and `orderListQuery(page)` with `placeholderData: keepPreviousData` (project default `staleTime` and retry policy).
- `lib/orderHistory.ts`: small pure helpers with Vitest: `parsePageParam(raw: string | null): number | null` (whole number ≥ 1, else `null`), `ordersPageHref(page)` (`/orders` for 1, else `/orders?page=n`), `shortOrderNumber(ulid)` (`#` + last 8 uppercase), `itemCountLabel(n)`, `moreProductsLabel(lineCount)` (empty for 1), `ORDER_STATUS_LABEL = { paid: "Paid" }`, and `readFromPage(state)` (the `fromPage` whole number above 1, else 1).
- `lib/checkout.ts` `onSuccess`: add `void queryClient.invalidateQueries({ queryKey: ORDER_LIST_KEY })`, and navigate with `{ replace: true, state: { justPaid: true } }`.
- `components/ui/Pagination.tsx`: generic `Pagination({ page, lastPage, hrefFor, label })`, with Previous and Next as `Link`s, `aria-disabled` spans at the ends, "Page X of Y", and `null` when `lastPage` is 1. Built generic because the store catalog (feature 13) pages too.
- `components/orders/OrderSummaryRow.tsx` (one row link, AC-3) and `components/orders/OrderListSkeleton.tsx` (3 rows, matching the row height).
- `pages/OrdersPage.tsx` replaces `OrdersPlaceholderPage.tsx` (rename the file; `OrdersErrorBoundary` moves with it, unchanged), and `router.tsx` imports the new names. The page reads `useSearchParams`, clamps per AC-4 with `useNavigate` (`replace: true`), runs `useQuery(orderListQuery(page))`, and calls `window.scrollTo({ top: 0 })` in an effect when `page` changes after the first render (the app has no `ScrollRestoration`).
- `OrderConfirmationPage.tsx`: `const [justPaid] = useState(() => location.state?.justPaid === true)`, plus an effect that, when `justPaid` and `location.state` is still set, calls `navigate(".", { replace: true, state: null })`. That reruns `requireAuth`, which reads the cached `/me` through `ensureQueryData`, so no extra request goes out. `PageShell` gets the heading and title from `justPaid`; when it is false, a "Back to my orders" link (`ChevronLeft` icon) to `ordersPageHref(readFromPage(location.state))` renders above the `<h1>`. `orderPageView.ts` gains `ORDER_DETAILS_TITLE`.
- Fixtures: an `orderSummary` factory in `client/src/test/fixtures.ts`; existing checkout tests assert the new navigate state.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| `GET /orders` | which orders | `$request->user()` plus `$user->orders()` scope |
| `GET /orders` | order of rows | `orders.created_at` desc, then `orders.id` desc |
| `GET /orders` | page and page size | `page` query param via Laravel's paginator; `ListOrders::PER_PAGE` = 10 |
| `GET /orders` | `ulid`, `status`, `total`, `paid_at` | `orders` columns, formatted as in `OrderResource` |
| `GET /orders` | `item_count` | `SUM(order_items.quantity)` per order (`withSum`) |
| `GET /orders` | `line_count` | `COUNT(order_items)` per order (`withCount`) |
| `GET /orders` | `first_item.product_name` | `order_items.product_name` of the lowest `order_items.id` (`firstItem`, snapshot) |
| `GET /orders` | `first_item.cover_image_url` | `products.cover_image_url` through `firstItem.product` (live) |
| `GET /orders` | `meta`, `links` | Laravel `LengthAwarePaginator` through the resource collection |
| `/orders` page | current page | `?page` via `parsePageParam`, else 1 |
| `/orders` page | clamp target | `meta.last_page` from the response |
| `/orders` page | "Page X of Y" | the parsed page and `meta.last_page` |
| `/orders` page | empty state | `meta.total === 0` |
| Row | order number | `shortOrderNumber(ulid)` |
| Row | "and N more products" | `line_count − 1` |
| Row | "N items" | `item_count` |
| Row | date | `paid_at`, `Intl.DateTimeFormat` `dateStyle: "medium"`, browser locale and time zone |
| Row | status badge text | `ORDER_STATUS_LABEL[status]` |
| Row | link state `fromPage` | the parsed current page |
| Order page | "Payment successful" vs "Order details" | router state `justPaid`, set only by checkout `onSuccess`, read once on mount |
| Order page | back link target | router state `fromPage` via `readFromPage`, then `ordersPageHref` |
| Checkout | new order first in the list | `invalidateQueries({ queryKey: ["me", "order-list"] })` in checkout `onSuccess` |
| Error state | 429 seconds | `ApiError.retryAfter` from `Retry-After` (since spec 0006) |

**Key invariants**:
- The list shows only the caller's orders; ownership is part of the query, never a filter after it.
- `item_count` equals the number of keys the order holds (spec 0009: each item has exactly `quantity` sold keys).
- No key code leaves the server through the list (spec 0010: codes only come from `GET /orders/{ulid}/keys`).
- The list endpoint writes nothing and runs a fixed number of queries per page.
- Page 1 has exactly one URL, `/orders`.
- `justPaid` only ever comes from checkout's own navigate, and each history entry shows "Payment successful" at most once.

**Security model**:
- Bearer only; the caller's own orders through `$user->orders()`. There is no user id or filter input, so nothing lets a caller ask for another user's list.
- The list holds order summaries, not secrets, so it needs no `NoStore` (Laravel's default `Cache-Control: no-cache, private` applies). Codes stay behind the keys endpoint.
- The `account` limiter (60 per minute per user) caps scraping of one account's history; a stolen token already exposes the account.
- Router state is client only and grants nothing: `justPaid` changes a heading, and `fromPage` changes a link.
- No compliance scope: digital goods, fake seed data, and no payment or personal data beyond what the account already shows.

**Configuration required**: none. No new env vars or credentials.

**Critical test scenarios**:
- Happy path (Pest): a buyer with 12 orders (one with items of quantities 2 and 1) gets page 1 with 10 rows newest first and page 2 with 2; `meta.total` 12, `meta.last_page` 2; the multi item order has `item_count` 3, `line_count` 2, and `first_item` from the lower item id; `total` and `paid_at` match `GET /orders/{ulid}`, verifies **AC-1**
- Leak check (Pest): the raw list JSON contains none of the buyer's key codes and no `items` field, verifies **AC-1**
- Query count (Pest): page 1 with 1 order and page 1 with 10 orders run the same number of queries (`DB::enableQueryLog`), verifies **AC-1**
- Pages and empty (Pest): `?page=abc` and `?page=0` give page 1; `?page=99` gives `data: []` with the real `last_page`; a user with no orders gets `data: []`, `total` 0, `last_page` 1, verifies **AC-2**
- Auth/permission (Pest): another user's orders never appear in the list; no token gives 401; the 61st `account` request in a minute gives 429 with `Retry-After`, verifies **AC-2**
- Client helpers (Vitest): `parsePageParam` for `null`, `"1"`, `"3"`, `"0"`, `"-1"`, `"2.5"`, `"abc"`, `" 2"`; `ordersPageHref`, `shortOrderNumber`, `itemCountLabel`, `moreProductsLabel`, `readFromPage` for missing, non number, 1, and 3; the list query key starts with `"me"` and is not under `["me", "orders"]`, verifies **AC-3**, **AC-4**, **AC-6**, **AC-7**
- List page (Vitest + Testing Library, mocked fetch): rows render every AC-3 field and link with `fromPage`; Next goes to `?page=2` and keeps old rows visible until it resolves; `?page=1` and `?page=abc` replace to `/orders`; `?page=9` with `last_page` 2 replaces to `?page=2` and never shows the empty state; pagination is hidden for one page; empty, error with retry, and 429 seconds render; no keys request is sent, verifies **AC-3**, **AC-4**, **AC-5**
- Fresh after checkout (Vitest): a successful `usePlaceOrder` invalidates `["me", "order-list"]` and navigates with `{ justPaid: true }`; sign out removes the list query, verifies **AC-6**, **AC-7**
- Order page arrival (Vitest): with `{ justPaid: true }` the heading is "Payment successful", there is no back link, and the history state is cleared after mount; with `{ fromPage: 3 }` the heading is "Order details" and the back link goes to `/orders?page=3`; with no state the back link goes to `/orders`; reveal still works in both, verifies **AC-7**

## Build plan

Approach: Journey. This closes Journey 1's last step ("find it again in order history") end to end: server list, then the client data layer, then the list page with all its states, then the order page arrival wording, then the public check. No migration.

1. Server: `Order::firstItem`, `ListOrders`, `OrderSummaryResource`, `OrderController::index`, `orders.index` route, satisfies **AC-1**, **AC-2**
2. Pest tests for the happy path, leak check, query count, pages and empty, auth, and limiter; Pint and PHPStan clean, satisfies **AC-1**, **AC-2**
3. Client data layer: `OrderSummary`, `getOrders`, `orderListQuery` and keys, `lib/orderHistory.ts` helpers, checkout `onSuccess` invalidation and `justPaid` state, the `orderSummary` fixture, Vitest, satisfies **AC-4**, **AC-6**, **AC-7**
4. `Pagination`, `OrderSummaryRow`, `OrderListSkeleton`, and `OrdersPage` (rename from the placeholder, router import) with the loading, slow, error, empty, rows, and clamp states, Vitest page tests, satisfies **AC-3**, **AC-4**, **AC-5**
5. Order page arrival: `justPaid` read once and cleared, "Order details" heading and title, "Back to my orders" link with `fromPage`, Vitest, satisfies **AC-7**
6. Show the row and pagination on `/ui`; check 360px, keyboard, focus, and contrast (add the badge pair to `client/design.md`); run all client checks, satisfies **AC-8**
7. Push, confirm CI green, deploy, then buy, open `/orders`, open the new order from there, and reveal its key on the public URL, satisfies **AC-6**, **AC-7**, **AC-8**

## Consequences

**Positive**:
- Journey 1 is complete: pay, confirm, reveal, and find the order again later.
- The list payload holds exactly what a row shows, keys stay behind their own endpoint, and the query count is fixed per page.
- The order page reads honestly in both cases: a celebration right after paying, plain details afterwards.
- `Pagination` is ready for the store catalog (feature 13).
- No schema change, no new env var, nothing new to operate.

**Negative / tradeoffs**:
- A second order shape (`OrderSummary`) to keep in sync with `OrderResource` for the shared fields.
- Offset pagination can skip or repeat a row if a new order lands while the buyer pages; acceptable for one buyer's own history.
- `justPaid` lives in router state, so the "Payment successful" wording depends on checkout passing it; a future flow that navigates to the order page another way shows "Order details".
- The extra replace navigation on the confirmation reruns the route loader once (cached `/me`, no request).
- The row cover is the live product cover while the name is the snapshot, so a later cover change shows on old orders (the same tradeoff as spec 0009's items).

**Neutral**:
- `OrdersPlaceholderPage.tsx` is renamed `OrdersPage.tsx`; `router.tsx` imports change.
- `Order` gains a `firstItem` relation.
- Checkout's navigate gains router state; existing checkout tests assert it.

## Follow-up

- [ ] `/develop`: confirm `oldestOfMany` and `withSum` behaviour in the installed Laravel 13 (eager loading `firstItem` with a column list and the `SUM` type on Postgres), and keep the `(int)` casts either way.
- [ ] `/develop`: confirm with the installed React Router 8 that `navigate(".", { replace: true, state: null })` keeps the path and clears `location.state`, and that `keepPreviousData` is the installed TanStack Query export name.
- [ ] Feature 13 (store catalog): reuse `components/ui/Pagination.tsx`; consider an app wide `ScrollRestoration` then, replacing this page's local scroll to top.
