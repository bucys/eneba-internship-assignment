# Review, main (order history), 2026-11-13

**Reviewed by**: Claude Sonnet 5.5 (same model family as author; fresh context)
**Scope**: 33 files, range e002c8b..working tree (main)
**Verdict**: Approve with nits

## Summary
Adds `GET /orders` (owner-scoped, paginated, constant query count), a URL-driven `/orders` page with pagination and all states, and a `justPaid`/`fromPage` router-state arrival on the order page. Matches spec 0011 closely. Client typecheck and all 284 Vitest tests pass; the 12 ListOrders Pest tests pass. No blockers or majors; a few small UX/robustness points.

## Minor
### 🟡 Pagination and row `fromPage` use the requested page while old rows are still shown, `client/src/pages/OrdersPage.tsx:95-107`
**Problem**: With `keepPreviousData`, after clicking Next the page-1 rows stay visible, but `page` is already 2, so the nav reads "Page 2 of Y" and each row links with `fromPage: 2`.
**Why it matters**: A click on a stale row during the transition makes "Back to my orders" lead to the wrong page; the nav label briefly disagrees with the rows.
**Suggested fix**: Derive the displayed page from `data.meta.current_page` for the label and `fromPage`, keeping the requested `page` only for the query.

### 🟡 Huge `?page` value can reach Postgres as an offset, `server/app/Actions/Orders/ListOrders.php:28`
**Problem**: `?page=99999999999999999999` is passed to the paginator; behaviour depends on Laravel's int resolution and may overflow the OFFSET.
**Why it matters**: Potential 500 on a user-controlled param (same pattern as `ProductController::index`, so not new). The spec's AC-2 does not cover this value.
**Suggested fix**: Check once with such a value; if it 500s, clamp or cap the page in both list endpoints.

### 🟡 `first_item` can be null-valued without a type guard, `server/app/Http/Resources/OrderSummaryResource.php:35-38`
**Problem**: `$firstItem?->...` emits `product_name: null` for an order with no items, but the client type says `product_name: string`.
**Why it matters**: Checkout never creates an itemless order, so it is unreachable today; the null-safe operator and the client type disagree about the contract.
**Suggested fix**: Either drop the `?->` (the invariant holds) or make the client type nullable; pick one.

## Nits
- ⚪ `client/src/components/ui/Pagination.tsx:29`, disabled span is not focusable and has no `role`; `aria-disabled` on a bare span is weakly announced. Acceptable per AC-4 but consider `role="link"`.
- ⚪ `client/src/pages/OrderConfirmationPage.tsx:130`, under StrictMode the clear-state effect can run twice (harmless, second navigate is a no-op replace).
- ⚪ `client/src/lib/checkout.ts:17`, `secondsText` import is placed after `queryClient` import; import order differs from the rest of the file.

## Strengths
- Server follows the thin controller, action, resource shape; ownership is part of the query via `$user->orders()`; `(int)` casts for Postgres SUM; query count test guards N+1.
- Leak test proves no `items` or key codes in the list; `secondsText` duplication was consolidated into `lib/format.ts`; `buttonClasses` extraction lets `Pagination` reuse button styling cleanly.
- Client state handling is careful: canonical URL replacement, beyond-last clamp that never flashes the empty state, `justPaid` read once then cleared, list key kept as a sibling of the order keys so invalidation is scoped.

## Test coverage
Good. Pest covers ordering, pagination, leak, query count, invalid and beyond-last pages, empty, isolation, 401, 429, no writes. Vitest covers helpers, page states (rows, paging, clamp, empty, 429/retry) and the order page arrival (justPaid, fromPage, reload). Gaps: no test for the stale-rows `fromPage` behaviour above, and none for a very large `page` value.

## Resolution (2026-11-13)
All three minor findings were fixed after review. The original findings above are kept as written.

- **Fixed: pagination and row `fromPage` during a page change** (`client/src/pages/OrdersPage.tsx`). The "Page X of Y" label and each row's `fromPage` now come from `data.meta.current_page`, the page of the rows on screen, not the requested page. Placeholder data that is beyond the last page now shows the skeleton instead of an empty list labelled "Page 9 of 2". Regression test: `OrdersPage.test.tsx` "keeps the label and back link on the shown rows' page while the next page loads".
- **Fixed: huge `?page` value** (`server/app/Actions/Orders/ListOrders.php`). Reproducing it showed a worse result than suspected: `?page=9223372036854775807` overflowed the offset and silently returned page 1's rows (no 500). The resolved page is now capped at `ListOrders::MAX_PAGE` (100,000), so such a request returns `data: []` with the real `last_page`, and the client clamps it as for any page beyond the last. Pages up to the cap behave as before. Regression test: `ListOrdersTest.php` "answers a huge page as an empty page beyond the last". `ProductController::index` likely shares the pattern; it is enrolled as a follow up under feature 13, not changed here.
- **Fixed: nullable `first_item`** (`client/src/api/orders.ts`, `client/src/components/orders/OrderSummaryRow.tsx`). The client type now matches the API (`product_name: string | null`), and a null name renders as "Unknown product". Regression test: `OrdersPage.test.tsx` "names a row with no first item as an unknown product".

Nits, no action: the `aria-disabled` span is what spec 0011 AC-4 requires; the StrictMode double effect is development only and harmless; the `checkout.ts` import order is cosmetic.

Checks after the fixes: client format, lint, typecheck, 286 Vitest tests, and build pass; server Pint, PHPStan, and 328 Pest tests pass.
