# Review, main, 2026-11-13

**Reviewed by**: Sonnet 5.5 (author on Claude, same family; fresh read)
**Scope**: 34 files (17 modified, 17 new), uncommitted on main
**Verdict**: Approve with nits

## Summary
Adds a pg_trgm backed matcher (`ProductSearch`) shared by `GET /products` and the new `GET /search/suggestions`, a `relevance` sort resolved in the request, and an ARIA combobox in the header on TanStack Query. Code follows the thin controller, Form Request, action, resource shape; the spec's ACs are traceable in code and tests. No blockers or majors; the findings are an index that cannot serve the similarity branch, a defensive gap around `assert()`, and a broken docs table row.

## Minor
### 🟡 GIN trigram index cannot serve the similarity branch, `server/app/Support/ProductSearch.php:30`
**Problem**: The index is `gin_trgm_ops`, which serves `ILIKE '%x%'` and the `<%` operator, not the `word_similarity(?, name) >= ?` function form. Each word's clause is `ILIKE OR word_similarity(...)`, so for any word of 4+ characters Postgres cannot use the index and falls back to a seq scan of the product table.
**Why it matters**: Harmless at the seeded catalog size, but spec 0013 AC-5 and the rationale present the index as what makes the matcher fast; that claim does not hold for the typo path.
**Suggested fix**: Either state in the spec/rationale that the index serves only the containment branch and the catalog is small enough to scan, or move the similarity test to the indexable form (`? <% name` with `pg_trgm.word_similarity_threshold` set to 0.5 per query) and re-run the AC-6 cases.

### 🟡 `assert()` guards a non nullable return, `server/app/Http/Requests/Catalog/SearchSuggestionsRequest.php:46`
**Problem**: `terms()` relies on `assert($terms !== null)`. With `zend.assertions=-1` in production, a term that passes validation yet splits into zero words (a 2+ character value of exotic whitespace the TrimStrings middleware and `\s` treat differently) would return null from a `SearchTerms` return type and surface as a 500 TypeError. The tests cover U+3000 for `SearchTerms::fromQuery` only, not through the suggestions endpoint.
**Why it matters**: A public endpoint should answer 422, not 500, for odd input.
**Suggested fix**: Add a validation rule (or `after` hook) that fails `q` when `SearchTerms::fromQuery` yields null, and add a suggestions endpoint case for an all whitespace Unicode term.

### 🟡 `ListProducts` trusts the caller to avoid Relevance without a search, `server/app/Actions/Catalog/ListProducts.php:46`
**Problem**: `ProductSort::Relevance` orders by `search_tier` / `search_score`, which exist only when `q` is set. The guard lives in `ListProductsRequest::resolveSort`, not in the action or `ProductFilters`.
**Why it matters**: Any future caller building `ProductFilters(sort: Relevance)` gets a Postgres "column does not exist" 500.
**Suggested fix**: Fall back to Name in the action when `$filters->q === null`, or enforce it in the `ProductFilters` constructor.

### 🟡 Broken Markdown table row, `client/design.md:123`
**Problem**: The `SearchForm` row ends its cell with `` `q` |. Combobox with ... `` so the new text sits outside the table cell, and the row renders with a stray `.` and a dangling paragraph.
**Suggested fix**: Merge the combobox sentence into the third cell before the closing pipe.

### 🟡 Scope checklist is out of date, `docs/scope/scope.md:213`
**Problem**: "Server matcher ... Pest" is unchecked although `ProductSearch`, the migration, relevance sort, and `SearchTest.php` are all present; the `/ui` entry work (SearchSuggestionsDemo) is also in the diff while its line stays unchecked (it bundles other still open items).
**Suggested fix**: Tick the server matcher line once the suite is green in CI, and split the final line so the `/ui` item can be ticked on its own.

## Nits
- ⚪ `server/app/Support/ProductSearch.php:46`, the tier 0 "starts with" test uses the raw trimmed query, so inner repeated spaces ("wild   hunt") never reach tier 0; collapsing whitespace in `SearchTerms::query` would match the client's `normaliseSearchTerm`.
- ⚪ `client/src/components/layout/SearchSuggestions.tsx:79`, the listbox `ul` renders empty (role listbox with no options) while "Searching…" or "No games match" shows; harmless, but `aria-controls` points at an empty listbox in those states.
- ⚪ `server/database/migrations/2026_11_13_100001_add_name_trigram_index_to_products.php:20`, `down()` drops the extension, which would fail or cascade if any other object ever depends on pg_trgm; dropping only the index is safer.
- ⚪ `client/src/lib/storeParams.ts:96`, `effectiveSort` is called in both `parseStoreParams` and `toStoreSearch`; fine, but a short note on why both need it (URL in vs URL out) would help a junior reader.

## Strengths
- One matcher feeds both endpoints, so results and suggestions cannot drift; LIKE wildcards stay literal, bindings for the tier/score columns are tested in order, and ranking is deterministic (rounded score, name, id tie breaks) with a cross page stability test.
- Combobox is carefully built: opens only on visitor input (never from URL sync), focus stays in the input via mousedown prevention, wrapping arrows, live region, no stale list flash, 429 handled, and RTL tests exercise each of these.
- Sort resolution is handled symmetrically on server and client (`relevance` without `q` reads as `name`, never reaches the URL), with tests on both sides.
- Test helpers `storeProduct` and `storeNames` were moved to `tests/Pest.php` for reuse, rather than duplicated.

## Test coverage
Configured and meaningful. Server: seeded catalog AC-6 cases, word rules (short words, punctuation only, wildcards, 10 word cap), tier/stock ordering, page stability, sort resolution, suggestion shape, limit, 422 matrix. Client: debounce and cache reuse, highlighting, keyboard wrap, Tab/Escape, click selection, URL sync not opening, searching/empty/unavailable/stale states, plus `storeParams`, `searchTerm`, `useDebouncedValue`, and `StorePage` updates. Gaps: suggestions endpoint with exotic Unicode whitespace (see Minor 2), rate limit 429 for the suggestions route (shares the `catalog` limiter, only the client side of a 429 is tested), and no test that the migration runs on a database that already has pg_trgm (idempotence relies on IF NOT EXISTS). Not run by the reviewer (read only).

## Resolutions (2026-11-13, author follow up)

Not committed or deployed. Feature 14 stays `in-progress`.

### Minor
1. **GIN index cannot serve the similarity branch**: fixed. `ProductSearch` now checks `? <% products.name`, and `ProductSearch::withThreshold()` runs each search in a transaction that calls `set_config('pg_trgm.word_similarity_threshold', '0.5', true)` (transaction local, so nothing leaks through a pooled connection). `ListProducts` (only when `q` is set) and `SuggestProducts` use it.
   - Index eligibility (local Postgres 17, `SET enable_seqscan = off`): the old `ILIKE OR word_similarity(...) >= 0.5` stays a `Seq Scan`; the new `ILIKE OR <%` gives a `BitmapOr` of two `Bitmap Index Scan on products_name_trgm_idx` (`~~*` and `%>`). The same holds for the SQL the app builds for both endpoints. At 81 rows the planner still picks a seq scan by cost without that setting, which is expected.
   - Same semantics: pg_trgm defines `<%` as `word_similarity >= threshold`. Checked across 75 words (every 4+ character word in the seeded names, plus typos) × 81 products = 6,075 pairs: 262 matches each way, 0 mismatches. Scores, tiers, and ordering are unchanged (`search_score` still uses `word_similarity`).
   - Guard: new test `matches a score of exactly the threshold on both endpoints` ("stardew" → Starfield scores exactly 0.500, which Postgres's default 0.6 would drop), so a caller that skips `withThreshold` fails. Query count tests grow by one (`set_config`).
   - Spec 0013 updated: the design table, `ProductSearch` row, Consequences, and the Follow-up item.
2. **`assert()` in `SearchSuggestionsRequest::terms()`**: fixed. A `q` rule now fails a term that `SearchTerms::fromQuery` reads as no words ("The q field must contain a word."), and `terms()` throws a `LogicException` instead of relying on `assert()`. Finding: through HTTP, Laravel's `TrimStrings` (`Str::trim`, Unicode aware) already empties such terms, so `required` answered 422; the 500 was reachable only when that middleware is skipped. Regression test `rejects a term of only Unicode whitespace` (U+3000 U+2003) runs with and without `TrimStrings`; before the fix the second case returned 500 (`AssertionError`). Spec AC-4's 422 list updated.
3. **`ListProducts` trusts the caller about Relevance**: fixed. The action reads Relevance without `q` as Name. Regression test `lists by name when the action gets relevance without a search` calls the action directly; before the fix it threw `column "search_tier" does not exist`. `ProductFilters` doc updated.
4. **Broken table row, `client/design.md:123`**: fixed (stray `|.` removed, the combobox text is back inside the cell).
5. **Stale scope checklist**: fixed. Server matcher ticked; the last line split into `/ui` entries (ticked; all four states exist in `SearchSuggestionsDemo`), local checks (ticked), the 360 px, keyboard, and contrast browser check (open), and commit, CI, deploy, Neon `pg_trgm` check, public run (open). `Build it` and `Verify it` stay open.

### Nits
- **Tier 0 uses the raw trimmed query**: fixed in the final corrections below. Original note: needs a decision, not changed. It is a real mismatch: suggestions send the client's `normaliseSearchTerm` (whitespace collapsed), but the header submit sends only `trim()`, so `wild   hunt` can rank differently in the dropdown and on the results page. The code follows AC-2's wording ("the whole trimmed `q`"), so fixing it (collapse whitespace in `SearchTerms::$query`) amends AC-2. Recommended, small.
- **Empty listbox while a status row shows**: no action. ARIA allows an empty listbox, the status text and live region carry the state, and no option is ever announced.
- **Migration `down()` drops the extension**: fixed in the final corrections below. Original note: no action. Spec AC-5 asks for it, and nothing else uses `pg_trgm`. Revisit if another migration ever depends on the extension.
- **`effectiveSort` called in parse and serialise**: no action. Each call already sits where a URL is read or written; a comment would only restate that.

### Checks run
- Server: `php artisan test` 421 passed; `composer format:check` passed; `composer analyse` 0 errors.
- Client: `npm run format:check`, `lint`, `typecheck`, `test` (33 files, 368 tests), `build` all passed.

## Final corrections (2026-11-13, before commit)

Not committed or deployed.

1. **Whitespace normalised in `SearchTerms`**: `fromQuery` now makes every `\s` run (with `/u`, so Unicode whitespace such as U+3000 and U+2003 counts) one space, then trims, and splits the words from that string. `query` (the tier 0 "starts with" value) and `words` now come from the same normalised text, so the header submit (`trim()` only) and the suggestions request (`normaliseSearchTerm`) rank identically. Before, a trailing U+2003 also stayed in `query`. Invalid UTF-8 still reads as no search. Spec 0013 AC-2 updated.
   - Tests: `collapses every run of whitespace, Unicode included, to one space` (`" Wild \t\u{3000} Hunt\u{2003}"` → `Wild Hunt`, words `wild`, `hunt`) and `ranks repeated spaces like single ones on both endpoints` (`wild   hunt` puts "Wild Hunter" above "A Wild Hunt" on `/products` and suggestions, same as `wild hunt`). Both failed before the fix.
2. **Migration `down()`** drops only `products_name_trgm_idx`; `pg_trgm` stays. The migration test now expects the extension to remain after rollback (it failed before the change). Spec 0013 AC-5 and the test line updated.
3. **`withThreshold()` scope verified**:
   - Same connection: `Product` uses the default connection, `DB::transaction` and `DB::select` in `withThreshold` use the default connection, and `config/database.php` has no read/write split.
   - Same transaction: new test `runs the threshold and every search query in one transaction on one connection` (suggestions and products) records transaction events and queries in order and requires `begin threshold search ... commit` with no commit or begin in between, all on one connection name. For products that covers the count query, the page query, and the eager loads.
   - Outside tests, on the local dev database (no outer transaction): both actions ran every query at transaction level 1 on `pgsql`, on the same Postgres backend (`pg_backend_pid()` unchanged), found Starfield for `stardew` (so 0.5 was in effect), and `current_setting('pg_trgm.word_similarity_threshold')` read `0.6` afterwards (nothing leaked).
   - The boundary test (`matches a score of exactly the threshold`) now runs one endpoint per test: the setting is transaction local, and the test's own transaction would otherwise carry it from the first request into the second and hide a missing wrapper.

### Checks run
- Server: `php artisan test` 426 passed; `composer format:check` passed; `composer analyse` 0 errors.
- Client: no client files changed in this round; the previous round's run stands.
