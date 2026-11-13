# Review, main (uncommitted, store catalog spec 0012), 2026-11-13

**Reviewed by**: Sonnet 5.5 (author model not stated)
**Scope**: 15 tracked + 21 untracked files, uncommitted
**Verdict**: Changes requested

## Summary
Adds server side filters, sort, and name match to `GET /products` (Form Request, value object, enum, action), a `GET /catalog/filters` endpoint, and a URL driven `/store` page with panel, dialog, chips, and header entry points. Structure follows the spec and AGENTS.md closely and client tests pass (335). One real behavioural bug in the client's no-op detection on pages above 1, plus a possible 500 on odd bytes in `q`.

## Major
### 🟠 No-op change on page 2+ is not a no-op, and jumps to page 1, `client/src/lib/useStoreParams.ts:20`
**Problem**: `apply` compares `toStoreSearch({...next, page: 1})` with `toStoreSearch(params)`, where `params.page` is the current page. On page 3, any change that keeps the filters (tabbing through the unchanged Min/Max fields, which commit on blur; pressing Enter in them; re-picking the current sort) yields different strings, so it pushes a history entry to page 1.
**Why it matters**: Violates AC-5 ("a no op change pushes none") and loses the visitor's page just by tabbing past the price fields. The existing test ("pushes nothing for a change that keeps the URL") only runs on page 1, so it misses this.
**Suggested fix**: Compare with page ignored on both sides (compare `{...params, page: 1}` to the target), and add a test starting from `?page=2`.

## Minor
### 🟡 NUL or invalid UTF-8 in `q` or slugs may reach Postgres and 500, `server/app/Http/Requests/Catalog/ListProductsRequest.php:73`
**Problem**: `q` (and platform/region slugs) only pass `string` and length rules. `q=%00` or `q=%FF` is bound into `ILIKE` / `whereIn`; Postgres rejects NUL bytes and invalid UTF-8 with an error, which surfaces as a 500 (not verified against the running DB).
**Why it matters**: Public endpoint returning 500 on junk input contradicts the "invalid input is a 422" contract and adds log noise.
**Suggested fix**: Add a rule rejecting NUL and invalid UTF-8 (e.g. a `regex:/\A[^\x00]*\z/u` style check, which also fails on invalid UTF-8), and a Pest case.

### 🟡 Dialog crossing `lg` and scroll lock are untested, `client/src/pages/StorePage.test.tsx:449`
The AC-6 behaviours "closes when widened past lg" and "page behind does not scroll" have no test; only open, live apply, and close are covered.

### 🟡 422 state is a hand built block, not `ErrorState`, `client/src/pages/StorePage.tsx:102`
Spec AC-9 asks for an `ErrorState` styled message. The custom block has no alert semantics, so screen reader users are not told the results failed. Reuse `ErrorState` (without retry) or add `role="alert"`.

## Nits
- ⚪ `client/src/pages/StorePage.tsx:199`, `event.target.value as StoreSort` cast; validate with `isStoreSort` instead.
- ⚪ `client/src/pages/StorePage.tsx:73`, the clamp effect depends on `params`, a new object each render, so it re-runs every render (harmless, guarded by `mustClamp`).
- ⚪ `client/src/components/store/PriceRangeFields.tsx:42`, when min exceeds max the error is only on Min; fine per spec, but Max gets no `aria-invalid` hint.

## Strengths
- Server follows the layering exactly: thin controllers, Form Request with the slug check done once per list, readonly `ProductFilters`, derived table so price filter and sort use a real column, every sort ends with `IS NULL, key, name, id`.
- LIKE escaping, `MAX_PAGE` overflow cap, and `trimStrings` exception for price params are deliberate and commented with the why.
- Client keeps the URL as the single source of state, with canonical URLs via a `replace` loader, and drafts reset from the URL without effects.

## Test coverage
Server: Pest covers each filter, OR/AND, inclusive bounds, out of stock placement, wildcard literals, both sorts across pages, 18 invalid cases keyed by param, query count, page cap, filter options, and the limiter. Missing: odd byte input, `q` trimmed to empty. Client: storeParams unit tests and a thorough StorePage suite (canonical redirect, history entries, clamp, empty/422/429/error, dimmed loading, price validation, dialog). Gaps: no-op on page above 1 (the bug above), lg crossing, scroll lock. All 335 client tests pass; server tests not run (needs Postgres).

## Resolution (2026-11-13)
All four findings (one major, three minor) are resolved. The original findings above are kept as written.

- **Major, no op on page 2+**: resolved. `useStoreParams.apply` now compares the target with the current params with `page` set to 1 on both sides, so a no op keeps the page and pushes nothing, and a real change still resets to page 1. Regression test "keeps the page and pushes nothing for a no op change on a later page" in `StorePage.test.tsx` (confirmed failing with the fix reverted).
- **Minor, NUL or invalid UTF-8**: reproduced first. Invalid UTF-8 in `q`, `platform`, or `region` returned 500 (Postgres `QueryException`, then the JSON error renderer failed on the same bytes); `q=a%00b` returned 200. Fixed with a shared `ListProductsRequest::TEXT_PATTERN` (`regex` rule with the `u` flag, no NUL) on all three params, so each returns 422 keyed by the param. Six new cases in the `StoreFiltersTest` invalid input dataset.
- **Minor, dialog crossing `lg` and scroll lock**: two new tests. Widening past `lg` closes the dialog, releases the scroll lock, and shows the sidebar with a single panel; closing the dialog restores the page's previous `overflow` value.
- **Minor, 422 state**: `ErrorState` gained optional `title` and `action` props (default behaviour unchanged for every other caller). The store 422 now renders `ErrorState` inside `role="alert"`, with "Clear filters" and no Try again; the test asserts the alert.

Nits: no action. The sort cast is safe because the select only offers `STORE_SORTS`; the clamp effect is guarded by `mustClamp`; Min only error matches spec AC-6.

Checks after the fixes: client format, lint, typecheck, 338 tests, build; server Pint, PHPStan, 377 Pest tests. All pass.
