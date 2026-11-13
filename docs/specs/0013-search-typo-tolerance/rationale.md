# 0013. Search with typo tolerance: rationale

## Context

The scope commits to going deep on search and store. Feature 14's done line asks that "witcher", "witchr", and "wild hunt" all find The Witcher 3, that suggestions appear while typing (debounced) and can be used with the keyboard, and that results reuse the store's filters.

Here is what exists today. Spec 0012 built the store on `GET /products` with a `q` param that keeps products whose name contains the text, ignoring case (`ILIKE '%q%'`). That finds "witcher" and "wild hunt" but returns nothing for "witchr". Results are always in name order, so a search shows matches alphabetically, not best first. The header `SearchForm` only submits to `/store?q=`; it has no suggestions. Spec 0012 left two follow-ups for this feature: replace the matcher behind the same `q`, and decide whether a `relevance` sort becomes the default when `q` is present. Spec 0001 left an open item to confirm that Neon supports `pg_trgm` before this feature relies on it.

Here are the forces at play. The catalog is small (81 products from 34 titles, every name plain ASCII, with apostrophes as the only punctuation that matters). The stack is fixed: Laravel 13, Postgres 17 (Neon in production), and a React SPA with TanStack Query, deployed on Render and Vercel by a single developer on a 3 to 4 day budget. Search results must keep every store filter, the canonical URL rules, and pagination working. Suggestions fire while typing, so they hit the shared `catalog` rate limiter (120 per minute per IP) more often than any other read. The dropdown is a new interactive widget in the global header, so it has to work with the keyboard and with screen readers from day one.

If nothing is decided, a typo returns an empty store page, the header gives no feedback while typing, and the done line fails.

## Options considered

### Option 1: Postgres `pg_trgm` word similarity inside the existing query

Turn on the `pg_trgm` extension, keep matching inside the `GET /products` query, and let each word of the search match a name either by containment or by `word_similarity` above a threshold. Relevance ranking comes from the same scores. A slim suggestions endpoint reuses the matcher.

**Pros**:
- No new service, no data sync, no new env var; Neon, CI, and local all get it through one migration.
- Filters, price, sort, pagination, and `meta.total` keep working, because the matcher is just another `WHERE` on the same query.
- `word_similarity` compares a word against the best matching part of a longer name, which fits short game names well.

**Cons**:
- Trigram similarity is coarse: double typos in short words ("wichr") and joined words ("godofwar") are missed.
- The threshold is a single global number, so it trades recall against near name false hits ("stardew" also finds Starfield).
- The readable function form (`word_similarity(...) >= 0.5`) does not use the GIN index; the indexable `<%` operator needs a session setting.

### Option 2: Postgres full text search plus `pg_trgm`

Add a `tsvector` (a list of normalised word stems) on the name for stemming and phrase matching, and use trigrams only for typo fallback.

**Pros**:
- Stemming handles plurals and word forms ("assassins" versus "assassin").
- Full text ranking (`ts_rank`) is built in.

**Cons**:
- Game names are short proper nouns; stemming adds little and can hurt ("Hades" stems oddly).
- Two match paths to keep consistent, plus a generated column and a second index.
- More SQL for the developer to explain, with no gain on the done line's examples.

### Option 3: A dedicated search engine (Meilisearch or Typesense)

Run a hosted search engine with built in typo tolerance and ranking, sync products into it, and query it from the API.

**Pros**:
- Best typo tolerance and relevance out of the box, including prefix search while typing.
- Scales to large catalogs without query tuning.

**Cons**:
- A second hosted service to deploy, secure, and keep in sync (seed, price, and stock changes).
- Price filters and the cheapest in stock price live in Postgres, so they would have to be mirrored or joined back, which breaks the "filters on the server in one query" model from spec 0012.
- New env vars and credentials, and an outage mode where search is down but the store is up.

### Option 4: Laravel Scout with the database driver

Use Scout's searchable models with the database engine.

**Pros**:
- A Laravel native API and an easy later swap to Meilisearch or Typesense.

**Cons**:
- The database engine only does `LIKE` or full text, with no typo tolerance, so `pg_trgm` is still needed underneath.
- It returns its own paginator, which complicates combining with the existing filter query and `withCheapestPrice`.

## Rationale

Option 1 is chosen because the forces that matter here are small scale, one developer, a short budget, and the need to keep spec 0012's server side filters intact. `pg_trgm` adds typo tolerance with one migration and no new moving parts. Because it stays inside the same query, every store filter, the price rule, `meta.total`, and pagination keep working with no change. A dedicated engine (Option 3) solves a problem this catalog does not have, and it costs a second service plus a sync path. Full text search (Option 2) adds stemming that short game names do not need. Scout's database driver (Option 4) does not provide typo tolerance at all.

The finer calls, as made with the engineer:

- **Every word must match** (over whole phrase similarity or any word). This keeps multi word searches precise ("witcher blood" finds only Blood and Wine) and means adding a word only narrows results. Whole phrase similarity blurs results when word order or extra words differ.
- **Words of 3 characters or fewer match only by containment.** Trigram scores on very short words are noisy ("gta" would loosely resemble many names), so this is the "balanced" choice: forgiving on real words, exact on abbreviations.
- **Threshold 0.5**, picked from the measured scores below. It is the highest value that still accepts "wicher" (0.56) and "starfeild" (0.50). The near name hits it lets in ("stardew" finding Starfield) rank below the intended game, because relevance puts containment matches (tier 1) ahead of similarity only matches (tier 2). The default `pg_trgm` threshold (0.6) would miss "wicher".
- **A relevance sort, default only when `q` is set** (over keeping name order or an implicit order). With name order, "witchr" would list the Witcher DLCs in alphabetical order, with no sense of best match. Keeping relevance as a context default leaves `sort` out of search URLs, which honours spec 0012's "defaults are left out" rule. Dropping a stray `sort=relevance` on the client, and reading it as `name` on the server instead of returning 422, means removing the search chip can never produce a broken link.
- **Relevance ignores stock.** The engineer chose to include out of stock products in suggestions and rank them by relevance. Applying the same rule to the store's relevance sort keeps the dropdown and "See all" results in the same order. Pushing an exact match below a loose typo match because it is out of stock would bury the game the visitor named.
- **A separate `GET /search/suggestions` endpoint** (over reusing `/products` with a hidden page size). Each keystroke would otherwise return 24 full cards plus pagination meta. A slim endpoint returns 6 rows with only the fields the dropdown shows, and it shares the matcher so the two can never disagree.
- **Reuse the `catalog` limiter.** With a 250 ms debounce and 60 seconds of caching per term, a visitor typing a few searches stays far under 120 per minute. A separate limiter would add config and tests for a risk that has not been measured, and the dropdown degrades to a message on 429 anyway.
- **The WAI-ARIA combobox pattern with a listbox popup** (decided at write time). It is the established pattern for a text field with suggestions, and screen readers expect it. Focus stays in the input, and `aria-activedescendant` points at the active option. Arrow keys wrap around, which the pattern allows, to keep a short list easy to cycle through. Escape closes and then clears, as the pattern describes. The runner up, moving real focus into the list, breaks typing while browsing the list.
- **Client side highlighting** (decided at write time). The client already knows the typed words and the name, so marking case insensitive substrings needs no server change. Words that matched only by similarity are not highlighted, since there is no exact span to mark. The runner up, returning match offsets from the server, adds payload and couples the API to presentation.
- **A 10 word cap** (decided at write time). Within the 100 character limit a query could hold 50 words, each adding two checks per row. Ten words covers every realistic game name search and bounds the cost. Ignoring extra words is gentler than a 422 for a field people type into freely.
- **The function form of `word_similarity`** (decided at write time) over the `<%` operator. The operator only reads its threshold from a session setting (`pg_trgm.word_similarity_threshold`), which would need a transaction and `SET LOCAL` around every search query. At 81 rows the scan the function form causes is not measurable. The GIN index still serves the containment checks and is ready for the operator if the catalog grows.

Declined for this feature: searching developer, publisher, platform, or region (they add noise, and filters already cover platform and region); popular searches on empty focus (no data source until feature 15); recent searches; and "Did you mean" (largely redundant once typos match).

### Measured similarity (Postgres 17, `pg_trgm`, local scratch database)

`word_similarity(word, name)` for typical searches, all scores at or above 0.4:

| Word | Name | Score |
|---|---|---|
| witcher | The Witcher 3: Wild Hunt | 1.00 |
| witchr | The Witcher 3: Wild Hunt | 0.71 |
| wicher | The Witcher 3: Wild Hunt | 0.56 |
| wichr | The Witcher 3: Wild Hunt | below 0.4 |
| cyberpnk | Cyberpunk 2077 | 0.67 |
| eldn | Elden Ring | 0.60 |
| eldenring | Elden Ring | 0.62 |
| baldurs | Baldur's Gate 3 | 0.75 |
| assasins | Assassin's Creed Valhalla | 0.60 |
| skyrm | Skyrim Special Edition | 0.67 |
| tsushma | Ghost of Tsushima Director's Cut | 0.63 |
| helldiver | Helldivers 2 | 0.90 |
| starfeild | Starfield | 0.50 |
| stardew | Starfield | 0.50 (false hit) |
| stardw | Stardew Valley / Starfield | 0.71 / 0.57 |
| hdes | Hades | 0.40 |
| godofwar | God of War | below 0.4 |

The full AC-1 rule (every word, threshold 0.5, short words by containment), run against all 34 seeded titles with AC-2 ordering, gives:

| Search | Results in order (tier, score) |
|---|---|
| witcher | The Witcher 3: Wild Hunt, then Blood and Wine, Complete Edition, Hearts of Stone (all tier 1, 1.00) |
| witchr | the same four (tier 2, 0.71) |
| wicher | the same four (tier 2, 0.56) |
| wild hunt | the same four (tier 1, 2.00), nothing else |
| witcher blood | The Witcher 3: Wild Hunt Blood and Wine only |
| cyberpnk | Cyberpunk 2077, Cyberpunk 2077: Phantom Liberty |
| eldn ring | Elden Ring, Elden Ring Shadow of the Erdtree |
| baldurs gate | Baldur's Gate 3 |
| assasins creed | Assassin's Creed Mirage, Assassin's Creed Valhalla |
| starfeild | Starfield |
| stardew | Stardew Valley (tier 0), Starfield (tier 2, 0.50) |
| gta | nothing |
| zzzz | nothing |

Within equal tier and score, name order puts the base game ahead of its DLCs, because a shorter name that is a prefix of a longer one sorts first.
