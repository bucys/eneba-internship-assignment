# 0013. Search with typo tolerance: a pg_trgm name matcher with relevance ranking behind `q`, and live header suggestions

**Date**: 2026-11-13
**Status**: Accepted

## Summary

This spec makes search forgiving and fast to use. On the server, the plain "name contains q" match from spec 0012 is replaced by a matcher that splits the search into words and lets each word match a product name either exactly or with a small typo, using Postgres trigram similarity (`pg_trgm`, which compares names by the three letter chunks they share). A new `relevance` sort puts the best matches first whenever there is a search. In the header, typing two or more characters opens a keyboard friendly dropdown with up to 6 games (cover, name, platform, price) from a new `GET /search/suggestions` endpoint. The results page is still the store, so every filter keeps working. The only schema change is one migration that turns on the extension and adds a trigram index.

## Requirements

**User stories**:
- As a visitor, I want to find a game even when I misspell it ("witchr", "cyberpnk"), so that a typo never ends my search.
- As a visitor, I want suggestions while I type, so that I can jump straight to a game without loading the results page.
- As a visitor using a keyboard or screen reader, I want to move through the suggestions with the arrow keys and hear how many there are, so that the dropdown works without a mouse.
- As a visitor, I want search results to come out best match first while my store filters still apply, so that the game I meant is at the top.

**Acceptance criteria**:
- **AC-1**: One server matcher, used by both `GET /products` and `GET /search/suggestions`, decides whether a product matches a search. The trimmed `q` is split on whitespace into words, lowercased, with duplicates removed; only the first 10 distinct words count (the rest are ignored). A product matches when **every** word matches its `name`. A word matches when the name contains it ignoring case, with `%`, `_`, and `\` matched literally (today's rule), **or**, only for a word of 4 or more characters, when `word_similarity(word, name)` is at least `ProductSearch::SIMILARITY_THRESHOLD` (0.5). Words of 3 characters or fewer match only by containment. Only the product `name` is searched; developer, publisher, platform, and region are not.
- **AC-2**: Relevance orders matching products by, in turn: (1) a tier, where 0 means the name starts with the whole normalised `q`, that is every run of whitespace (Unicode included, so U+3000 counts) made one space, then trimmed (`name ILIKE ?` bound to `escapeLike(q) . '%'`, so wildcards stay literal; `wild   hunt` ranks exactly like `wild hunt`, matching the client's `normaliseSearchTerm` for suggestions), 1 means every word is contained in the name, and 2 means at least one word matched only by similarity; (2) the sum of `word_similarity(word, name)` over the counted words, rounded to 4 decimals (`round(...::numeric, 4)`, so float noise never reorders ties), highest first; (3) `name`; (4) `id`. Stock does not affect relevance: a product with no key in stock keeps its place (a deliberate exception to spec 0012 AC-2's "out of stock last" rule, which still holds for `name`, `price_asc`, and `price_desc`). The order is stable across pages.
- **AC-3**: `GET /api/v1/products` uses the AC-1 matcher for `q`, replacing the `ILIKE` from spec 0012 AC-1; every other param, the response shape, the 24 per page, `meta.total`, and the `catalog` limiter stay as they are. `sort` also accepts `relevance` (the enum rule now has four values). The effective sort is resolved in `ListProductsRequest::filters()`, after validation, from the normalised `q` (a `q` empty after trimming counts as no `q`): with a `q`, a missing `sort` means `relevance`; without `q`, a missing `sort` means `name`, and `sort=relevance` is accepted and read as `name` (no 422). The leading `cheapest_price_cents IS NULL` order term applies only to `name`, `price_asc`, and `price_desc`, never to `relevance`. A call with no params still returns exactly what it returns today. Validation of `q` is unchanged (trimmed, at most 100 characters, valid UTF-8 with no NUL, a string not an array). The query count does not grow with the page size.
- **AC-4**: `GET /api/v1/search/suggestions?q=<term>` is public, read only, and uses the `catalog` limiter (120 per minute per IP, 429 with `Retry-After` when exceeded). `q` is trimmed and required: missing, empty after trimming, shorter than 2 characters, longer than 100 characters, sent as an array, invalid UTF-8, holding a NUL byte, or holding no word (only Unicode whitespace) returns 422 in Laravel's default error shape keyed `q`. The length rules count characters (`mb_strlen`) after trimming, and the request reuses `ListProductsRequest::TEXT_PATTERN` and `ListProductsRequest::MAX_QUERY_LENGTH`, so the two requests cannot drift apart. It returns 200 with `{ data: Suggestion[] }`, where each suggestion is `{ slug, name, cover_image_url, platform: { slug, name }, price }` (`price` is the existing `Money` shape of the cheapest in stock offer; the resource returns `null`, not a `Money`, when `cheapest_price_cents` is null). It returns at most 6 active products in AC-2 relevance order, with no pagination `links` or `meta`, an empty `data` when nothing matches, and a fixed number of queries.
- **AC-5**: One migration runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` and creates the GIN index `products_name_trgm_idx` on `products` using `name gin_trgm_ops`; its `down()` drops only the index and keeps the extension, which is database wide and may be used by other objects. It runs unchanged on local Postgres, the `eneba_test` database, CI's Postgres 17 service, and Neon in production. No other table or column changes.
- **AC-6**: With the seeded catalog, `q=witcher`, `q=witchr`, `q=wicher`, and `q=wild hunt` each return The Witcher 3: Wild Hunt as the first result of `GET /products` and the first suggestion; `cyberpnk` finds Cyberpunk 2077, `eldn ring` finds Elden Ring, `baldurs gate` finds Baldur's Gate 3, `assasins creed` finds both Assassin's Creed titles, and `starfeild` finds Starfield. `witcher blood` returns only The Witcher 3: Wild Hunt Blood and Wine. `stardew` lists Stardew Valley before Starfield. `q=%` and `q=_` still match only names that hold those characters.
- **AC-7**: The header search field opens the dropdown only after the visitor's own input: typing, or focusing the field while it holds 2 or more characters (after trimming). It never opens because the field synced to the URL's `q` on `/store` (spec 0012 AC-10), on back or forward, or on page load: `isOpen` is set to true only inside the input's change, focus, and ArrowDown handlers, never in an effect that watches the term. Focusing the field on `/store?q=witcher` does open it, because the focus is the visitor's own action. Closing clears what the dropdown showed, so reopening never flashes an older term's list. A suggestions request is sent 250 ms after the visitor stops typing, only when the trimmed term has 2 or more characters; under 2 characters the dropdown closes and nothing is sent. Requests for the same normalised term (trimmed, lowercased, inner whitespace collapsed) are served from the TanStack Query cache for 60 seconds, and a request for a term the visitor has typed past is aborted (the query `signal` is passed to `fetch`); an aborted or cancelled request is ignored and never shows the error row. The dropdown closes on Escape, on Tab, when focus leaves the search form, on submit, after a selection, and on any route change.
- **AC-8**: The dropdown lists up to 6 suggestions in server order. Each row shows the cover image (decorative, empty `alt`, lazy loaded, fixed size so rows do not shift), the name (at most two lines, the rest cut with an ellipsis), the platform name, and the price formatted like store cards, or "Out of stock" when `price` is `null`. In each name, every case insensitive occurrence of a typed word of 2 or more characters (split like the server, on whitespace) is wrapped in `<mark>` and shown bold, with overlapping or touching matches merged into one mark and regex characters in the term escaped (no highlight for words that matched only by similarity). Choosing a suggestion goes to `/products/<slug>`. After the suggestions, a final option "See all results for "<term>"" goes to `/store?q=<term>` (the same fresh search the form submit makes, spec 0012 AC-10). It is hidden when there are no suggestions. The field keeps its text after a selection.
- **AC-9**: The search field and dropdown follow the WAI-ARIA combobox pattern with a listbox popup: the input has `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` pointing at the listbox, and `aria-activedescendant` set to the active option (absent when none is active). Each suggestion and the "See all" row is a `role="option"` with a unique id. ArrowDown and ArrowUp move the active option and wrap from last to first and back; ArrowDown on a closed field with 2 or more characters opens it. Enter on an active option selects it; Enter with no active option submits the form as today. Escape closes an open dropdown, and on a closed one clears the field. Focus stays in the input the whole time: the listbox calls `preventDefault` on `mousedown`, so clicking an option does not blur the input, and selection happens on `click`. The form closes the dropdown on `blur` only when the event's `relatedTarget` is outside the form. Typing resets the active option to none. A visually hidden polite live region announces "N suggestions" ("1 suggestion"), "No games match", or the error text whenever the dropdown's content settles; its text is blanked when the term changes, so the same count is announced again for a new term.
- **AC-10**: Dropdown states: from the first keystroke that opens it (during the 250 ms debounce too) until the first answer arrives, an open dropdown with nothing to show displays one "Searching…" row; while a later term is pending, the previous suggestions stay visible, dimmed, with `aria-busy="true"` on the listbox. When the answer is empty, it shows one non selectable row "No games match "<term>"". When the request fails for any reason (network, 5xx, 429, or 422), it shows one non selectable row "Suggestions are unavailable right now." with no retry button; typing again retries. In every state, Enter with no active option still submits to the store.
- **AC-11**: The store learns `relevance` (label "Relevance") as a sort value, so spec 0012 AC-5 to AC-7 now have four sort values and a default that depends on `q`: `defaultSort(q)` is `relevance` when `q` is not empty, else `name`. `parseStoreParams` reads a missing `sort` as `defaultSort(q)`, and drops `relevance` when `q` is empty. `toStoreSearch` leaves `sort` out whenever it equals `defaultSort(q)`. With a non empty `q`, the sort select lists Relevance first; choosing it writes no `sort`, and choosing "Name: A to Z" writes `sort=name`. Without `q`, Relevance is not offered, and a `sort=relevance` in the URL is dropped by the loader's canonical redirect (spec 0012 AC-5). Removing the search chip therefore leaves a canonical URL, with no 422. "Clear all" keeps `q` and sets the sort to `defaultSort(q)`, and its visibility check compares the sort with `defaultSort(q)`, not `"name"`. The header submit and the "See all" row build their URL with `sort: defaultSort(q)`, so it has no `sort` and results come in relevance order. Everything else in spec 0012 AC-5 to AC-10 is unchanged.
- **AC-12**: The dropdown works at 360 px wide (full width under the search row, which already wraps to its own line on mobile). It is positioned `absolute` under the form, layered above the sticky header and page content, with `max-h-[min(24rem,60dvh)]` and `overflow-y-auto`, so it scrolls inside itself when the on screen keyboard leaves little room. The `/ui` page gains entries for the dropdown's states (results with highlights, searching, no matches, unavailable). Text and marks meet AA contrast in the existing tokens, the active option is visible without relying on colour alone, and the client and server checks, CI, the Render and Vercel deploys, and a run of the public site all pass.

## Decision

**Chosen option**: Option 1: Postgres `pg_trgm` word similarity inside the existing catalog query, a shared `ProductSearch` matcher with relevance ranking, a slim `GET /search/suggestions` endpoint, and an ARIA combobox in the header built on TanStack Query.

Typo tolerance lives in the database the project already runs, behind the same `q` param, so filters, sort, pagination, and the store page keep working with no new service.

**Implementation skills**: `laravel-best-practices` (`laravel/boost`, `.claude/skills/laravel-best-practices/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `react-router-data-mode` (`remix-run/agent-skills`, `.claude/skills/react-router-data-mode/`) · `tailwind-css-patterns` (`giuseppe-trisciuoglio/developer-kit`, `.claude/skills/tailwind-css-patterns/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Reasoning, measured similarity scores, and the options weighed: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no new tables or columns. One migration (AC-5):

| Object | Definition | Serves |
|---|---|---|
| extension `pg_trgm` | `CREATE EXTENSION IF NOT EXISTS pg_trgm` (a trusted extension, so the database owner can create it without superuser) | `word_similarity()` and the `gin_trgm_ops` operator class |
| index `products_name_trgm_idx` | `CREATE INDEX products_name_trgm_idx ON products USING gin (name gin_trgm_ops)` via `DB::statement`, like the existing CHECK constraints | `ILIKE '%word%'` and `word <% name` lookups (see Consequences) |

Server code shape (thin controller, Form Request, action, resource, per the root `AGENTS.md` rules):

| Piece | Role |
|---|---|
| `App\Support\SearchTerms` | Readonly value: built from the validated `q`; holds `query` (trimmed) and `words` (lowercased, deduped, first 10, split on `/\s+/u`). Constant `MAX_WORDS = 10`. |
| `App\Support\ProductSearch` | Applies AC-1 to a `Product` builder (`where` per word: `ILIKE` with the existing escape, `OR ? <% products.name` for words of 4+ characters, counted with `mb_strlen`; `<%` is true exactly when `word_similarity(word, name) >= pg_trgm.word_similarity_threshold`) and adds the AC-2 columns `search_tier` and `search_score` with `selectRaw($sql, $bindings)`, called after `withCheapestPrice` so its `select` does not replace them, with all values bound (select bindings compile ahead of where bindings, so a test asserts a known row's score). Constant `SIMILARITY_THRESHOLD = 0.5`. `withThreshold(Closure)` runs the built query in a transaction that first calls `set_config('pg_trgm.word_similarity_threshold', '0.5', true)`, so the setting ends with the transaction and never leaks through a pooled connection; `ListProducts` (only when `q` is set) and `SuggestProducts` call it. Holds the `escapeLike` helper, moved out of `ListProducts`. |
| `App\Enums\ProductSort` | Gains `Relevance = 'relevance'`. |
| `ProductFilters` | `q` becomes `?SearchTerms`. `ListProductsRequest::filters()` resolves the sort: given value, else `Relevance` when `q` is set, else `Name`; `Relevance` without `q` becomes `Name`. |
| `ListProducts` | Calls `ProductSearch` on the inner query when `q` is set, so `search_tier` and `search_score` are real columns of the derived table. The current unconditional `orderByRaw('cheapest_price_cents IS NULL')` moves into the three non relevance arms. `Relevance` orders `search_tier, search_score DESC, name, id`; the other sorts keep spec 0012 AC-2. |
| `SuggestProducts` action, `SearchSuggestionsRequest`, `SearchSuggestionController` (invokable), `SearchSuggestionResource` | `GET /search/suggestions`: active, `withCheapestPrice`, `ProductSearch`, `with('platform:id,slug,name')`, relevance order, `limit(SuggestProducts::LIMIT)` where `LIMIT = 6`. |

Client pieces:

| Piece | Role |
|---|---|
| `client/src/api/search.ts` | `Suggestion` type, `getSearchSuggestions(term, signal)`, `searchSuggestionsQuery(term)` with key `["search", "suggestions", normalisedTerm]`, `staleTime` 60 s, `placeholderData: keepPreviousData`, `retry: false`. |
| `client/src/lib/searchTerm.ts` | `normaliseSearchTerm` (trim, lowercase, collapse whitespace), `MIN_SUGGEST_LENGTH = 2`, `highlightMatches(name, term)` returning text and mark segments. |
| `client/src/lib/useDebouncedValue.ts` | Returns the value after it has been stable for the given delay (250 ms here). |
| `SearchForm` + new `SearchSuggestions` (listbox) | Combobox state: `isOpen`, `activeIndex`; options are the suggestions plus the "See all" row. |
| `client/src/lib/storeParams.ts` | `StoreSort` gains `relevance`; `defaultSort(q)`; parse, canonical, and `toStoreSearch` use the context default (AC-11); the sort select filters Relevance out when `q` is empty. |

**State transitions**: none on the server. Dropdown: `closed → open` only on the visitor's input (AC-7); while open, content is `searching (no previous data) | results | empty | unavailable`, and a new term moves `results → results (dimmed, aria-busy)`; any close trigger in AC-7 returns to `closed` and resets `activeIndex` to none.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/products` | GET | `q`: string (opt, AC-1 matcher), `sort`: `name` \| `price_asc` \| `price_desc` \| `relevance` (opt, default by `q`), plus every spec 0012 param | `{ data: Product[], links, meta }` (unchanged shape) | public, `catalog` limiter | 422 (spec 0012 AC-3 rules), 429 |
| `/api/v1/search/suggestions` | GET | `q`: string (req, 2 to 100 characters after trim) | `{ data: { slug, name, cover_image_url, platform: { slug, name }, price: Money \| null }[] }`, at most 6 | public, `catalog` limiter | 422 keyed `q`, 429 with `Retry-After` |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| matcher | words | derived from the validated `q`: trim, lowercase, split on whitespace, dedupe, first 10 (`SearchTerms`) |
| matcher | similarity threshold | constant `ProductSearch::SIMILARITY_THRESHOLD = 0.5`, chosen from the scores measured in rationale.md |
| matcher | short word cutoff | words of 3 characters or fewer, `mb_strlen` (AC-1, engineer's "balanced" choice) |
| relevance | `search_tier`, `search_score` | computed in SQL from the bound `query`, the bound `words`, and `products.name` (AC-2) |
| `GET /products` | effective sort | `sort` param, else `relevance` when `q` is set, else `name` (AC-3) |
| `GET /search/suggestions` | `slug`, `name`, `cover_image_url` | `products` columns |
| `GET /search/suggestions` | `platform.slug`, `platform.name` | `platforms` via `Product::platform` |
| `GET /search/suggestions` | `price` | `cheapest_price_cents` from the existing `withCheapestPrice` scope, wrapped by `Money::eur` |
| `GET /search/suggestions` | at most 6 rows | constant `SuggestProducts::LIMIT = 6` |
| dropdown | term sent | the input's draft, debounced 250 ms, trimmed; sent only with 2+ characters |
| dropdown | cache key | `normaliseSearchTerm(term)` |
| dropdown | price text | `price` through the same formatter `ProductCard` uses; "Out of stock" when `null` |
| dropdown | highlighted spans | derived on the client from the typed term's words and the suggestion `name` (`highlightMatches`) |
| dropdown | "See all" link | `storeHref({ ...DEFAULT_STORE_PARAMS, q: term.trim() })`, the same as the form submit |
| dropdown | option ids, listbox id | `useId()` in `SearchForm`, plus the option index |
| dropdown | live region text | the settled dropdown state and `data.length` (AC-9) |
| `/store` | sort default | `defaultSort(q)`: `relevance` when `q` is not empty, else `name` (AC-11) |

**Key invariants**:
- One matcher (`ProductSearch`) serves both endpoints, so a suggestion shown for a term is always in that term's store results with no other filters set.
- Every word must match; adding a word never adds results.
- A word of 3 characters or fewer never matches by similarity.
- User text reaches SQL only as bound parameters; `ILIKE` wildcards in user text are always escaped.
- Relevance is only the default when `q` is set; `relevance` never appears in a canonical store URL without `q`.
- Suggestions are active products only, at most 6, and do not depend on stock.
- The dropdown never opens without the visitor's own input.

**Security model**: both endpoints are public and read only with the existing `catalog` limiter per IP; no personal data. Every user value is bound (no SQL built from the term); wildcards are escaped. The 10 word cap and the 100 character cap bound the cost of one query (at most 10 `ILIKE` checks plus 10 similarity checks per row). The suggestions endpoint returns only fields the public product list already exposes.

**Configuration required**: none. No new env vars or credentials. Neon must allow `CREATE EXTENSION pg_trgm` for the app's database role (a trusted extension, checked in Build plan step 1).

**Critical test scenarios**:
- Happy path: `witchr` returns The Witcher 3: Wild Hunt first from both endpoints; typing "witchr" in the header shows it as the first suggestion with no part of its name marked (the typed word "witchr" does not occur in the name, and AC-8 marks only words that do), and Enter on it opens its product page, verifies **AC-1**, **AC-2**, **AC-6**, **AC-8**, **AC-9**
- Every word: `witcher blood` returns only Blood and Wine; `wild hunt` returns the Witcher titles and no other product, verifies **AC-1**, **AC-6**
- Short words: `gta` does not match "Gate" or other names by similarity; only containment counts, verifies **AC-1**
- Ranking: `stardew` lists Stardew Valley before Starfield; an out of stock exact match still ranks above an in stock typo match, verifies **AC-2**
- Literal wildcards: `q=%` and `q=_` match only names holding those characters on both endpoints, and a punctuation only word like `----` or `%%%%` never matches by similarity, verifies **AC-1**, **AC-6**
- Score bindings: `witchr` gives The Witcher 3: Wild Hunt `search_tier` 2 and `search_score` 0.7143 (rounded), proving the select bindings line up, verifies **AC-2**
- Sort defaults: `/products?q=witcher` orders by relevance; `/products?sort=relevance` with no `q` equals the no param order with 200; `/store?sort=relevance` redirects to `/store`; removing the search chip on `/store?q=witcher&sort=name` lands on `/store`, verifies **AC-3**, **AC-11**
- Validation: suggestions with `q` missing, `" a "`, 101 characters, `q[]=x`, or a NUL byte return 422 keyed `q`, verifies **AC-4**
- Rate limit: the 121st catalog request in a minute returns 429, and the dropdown shows "Suggestions are unavailable right now." while Enter still submits, verifies **AC-4**, **AC-10**
- Debounce and cache: typing "witc" quickly sends one request; deleting back to "w" sends none and closes; retyping "witc" within 60 s sends none, verifies **AC-7**
- Open rule: back and forward between `/store?q=a` and `/store?q=b` never open the dropdown, verifies **AC-7**
- Keyboard: ArrowDown wraps from "See all" to the first option, Escape closes then clears, Tab closes, and the live region reads "6 suggestions", verifies **AC-9**
- Empty and slow states: "zzzz" shows "No games match "zzzz"" and no "See all" row; a slow second term keeps the first list dimmed with `aria-busy`, verifies **AC-8**, **AC-10**
- Migration: `migrate:fresh` on `eneba_test` creates the extension and the index, and a rollback removes only the index, verifies **AC-5**
- Query count: suggestions and `/products?q=witcher` run a fixed number of queries, verifies **AC-3**, **AC-4**

## Build plan

The build approach is Journey: this whole search path (match, rank, suggest, land on results) is finished with all its states before Journey 3 starts. It is built server first, because the client's sort and dropdown both depend on the new contract.

1. Migration: `pg_trgm` extension plus `products_name_trgm_idx`, with `down()`. Before merging, confirm `CREATE EXTENSION pg_trgm` works on the Neon database (from the Render shell or the Neon SQL editor with the app's role), which closes spec 0001's open item. Satisfies **AC-5**
2. Matcher and relevance on `GET /products`: `SearchTerms`, `ProductSearch` (moving `escapeLike` into it), `ProductSort::Relevance`, sort resolution in `ListProductsRequest::filters()`, and relevance ordering in `ListProducts`. Pest feature tests for the AC-6 examples on a seeded catalog (`CatalogSeeder`), word rules, wildcards, sort defaults, page stability, and query count; update the spec 0012 tests whose expectations change (`q` order now relevance). Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-6**
3. `GET /search/suggestions`: route under `throttle:catalog` named `search.suggestions`, `SearchSuggestionsRequest`, `SuggestProducts`, invokable controller, `SearchSuggestionResource`. Pest tests for shape, limit 6, order, out of stock `price: null`, validation, 429, and query count. Satisfies **AC-4**, **AC-6**
4. Store relevance sort on the client: `StoreSort` plus `relevance`, `defaultSort(q)`, parse, canonical redirect, and `toStoreSearch` using the context default; the sort select hides Relevance without `q`; Vitest for `storeParams` and the `StorePage` cases (chip removal, Clear all, `sort=relevance` redirect). Satisfies **AC-11**
5. Suggestions data layer: `api/search.ts` (`getSearchSuggestions`, `searchSuggestionsQuery`), `lib/searchTerm.ts` (`normaliseSearchTerm`, `highlightMatches`), `lib/useDebouncedValue.ts`; Vitest for normalising, highlighting (case, repeats, regex characters in the term), and the debounce. Satisfies **AC-7**, **AC-8**
6. Combobox UI: `SearchForm` combobox state and keyboard handling, the `SearchSuggestions` listbox with rows, marks, the "See all" option, the searching, dimmed, empty, and unavailable states, and the live region; open and close rules including route change. React Testing Library tests with user-event for typing, debounce (fake timers), arrows and wrap, Enter, Escape, Tab, click, the URL sync not opening it, and each state. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10**
7. Finish: `/ui` entries for each dropdown state, a check at 360 px and with the keyboard, contrast on marks and the active row, all client and server checks green, CI, deploy (Render runs the migration on start), and a run on the public site with the AC-6 terms. Satisfies **AC-12**, **AC-6**

## Consequences

**Positive**:
- Typos like "witchr", "cyberpnk", and "assasins" now find the right game, with no new service, no index to keep in sync, and no new env var.
- One matcher behind both endpoints keeps the dropdown and the results page consistent.
- The store, its filters, chips, pagination, and URL rules all keep working; only the matcher and one sort value change.
- The dropdown makes the header search usable without a mouse and announces its results to screen readers.

**Negative / tradeoffs**:
- Trigram similarity is measured per word against the whole name, so it misses heavy misspellings ("wichr" scores under 0.4) and joined words ("godofwar"). This is accepted under the balanced choice.
- At 0.5 a few near names match too ("stardew" also finds Starfield); ranking puts the intended game first, but results can hold one or two extra titles.
- The similarity check uses the `<%` operator, which the GIN index can serve (EXPLAIN shows a BitmapOr of the `ILIKE` and `<%` index conditions), instead of `word_similarity(...) >= 0.5`, which it cannot. The two agree on every word and product pair in the seeded catalog. The price: each search runs in a short transaction with one extra `set_config` query, and any new caller of `ProductSearch::apply` must run inside `withThreshold`, or Postgres's default threshold of 0.6 silently drops matches like "stardew" → Starfield (a test pins that 0.5 boundary on both endpoints).
- Relevance is the one sort that does not put out of stock products last, which is a rule exception to explain in tests and the README.
- Debounced suggestions add requests to the shared `catalog` limiter; a very fast typist who is also browsing could hit 429 sooner. The dropdown degrades to a message, and submitting still works.
- Every search query now runs up to 10 extra similarity calls per row. That is negligible at this size, but it is not free.

**Neutral**:
- At 81 rows the planner still chooses a seq scan by cost; the index matters only as the catalog grows, and no test depends on the plan.
- The first migration that needs a Postgres extension; Neon, CI, and local all get it through `php artisan migrate`.
- Spec 0012 AC-1 (the `q` match), AC-2 (sort list), and AC-5 (sort default) are amended by AC-1, AC-3, and AC-11 here; spec 0012's follow-up "Feature 14 swaps the `q` matcher" is resolved by this spec.
- `escapeLike` moves from `ListProducts` into `ProductSearch`.

## Follow-up

- [ ] Note in the README that search is typo tolerant through `pg_trgm` (threshold 0.5, every word must match), and why relevance does not push out of stock items last.
- [x] Switch the similarity check to the indexable `<%` operator (done after review 2026-11-13; see Consequences). If the catalog grows past a few thousand products, measure the plan with real data.
- [ ] Popular searches on empty focus, recent searches, and "Did you mean" were declined for this feature; reconsider popular searches once feature 15's best sellers data exists.
- [ ] Deferred from `/check verify` (2026-11-13), non blocking, outside feature 14 scope:
  - [ ] Add a Pest test for the `catalog` limiter returning 429 with `Retry-After` on `GET /search/suggestions` (today proven only by a manual local run).
  - [ ] Render's free tier instance returned 502 for most of 130 requests sent 16 at a time (it recovered at once); production cannot reach the 120 per minute limit from one client, so the limiter is effectively untested there. Revisit only if the plan changes.
  - [ ] The dev only `/ui` page scrolls sideways at 360 px (503 px wide), caused by the spec 0012 Store filters section (chips and filter panels), not the search section.
  - [ ] Document that a NUL byte at either end of `q` is trimmed before validation (`q=ab%00` returns 200), while a NUL inside the term returns 422, consistent with AC-4's "q is trimmed".
