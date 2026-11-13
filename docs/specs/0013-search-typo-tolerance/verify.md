# Verify: search with typo tolerance · spec 0013 · updated 2026-11-13
_Steps derived from spec 0013 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Result (2026-11-13): PASS.** All 12 acceptance criteria (AC-1 to AC-12) verified and every specced surface built. Run on the public Vercel and Render deploys at 1280 px and 360 px, the public API, local `/ui`, and a local API for the 429 check; server Pest 426/426, Pint, PHPStan, and client Prettier, oxlint, typecheck, Vitest 368/368, build all green; CI green on `6e70e07`. Non blocking findings are deferred in spec 0013 Follow-up.

## UI / manual
- [x] On `/`, type `witchr` in the header search → after a short pause a dropdown lists The Witcher 3: Wild Hunt first, each row with a cover, name, platform, and price → AC-7, AC-8, AC-6
- [x] Type `witch hunt` → "Witch" and "Hunt" are bold in each name; for `witchr`, no part of the name is bold → AC-8
- [x] Type one character (`w`) → no dropdown, and the network tab shows no `/search/suggestions` request → AC-7
- [x] Type `witc` quickly → exactly one request; delete back to `w` → the dropdown closes; type `itc` again within 60 s → no new request → AC-7
- [x] ArrowDown and ArrowUp move the yellow bar and wrap between the first row and "See all results for …"; Enter on a game opens `/products/<slug>`, and the field keeps its text → AC-9, AC-8
- [x] Enter with no active row goes to `/store?q=<term>` with no `sort` param → AC-9, AC-11
- [x] Click "See all results for "witcher"" → `/store?q=witcher`; focus stays in the field → AC-8, AC-9
- [x] Escape closes the open dropdown; a second Escape clears the field; Tab closes it; clicking outside closes it → AC-7, AC-9
- [x] Type `zzzz` → one row "No games match "zzzz"" and no "See all" row → AC-10, AC-8
- [x] Stop the API (or exceed the limit) and type → one row "Suggestions are unavailable right now."; Enter still submits to the store → AC-10
- [x] With the network throttled, type `witcher`, then ` blood` → the first list stays visible, dimmed, while the second loads → AC-10
- [x] Type `witcher`, press Escape, clear, and type `elden` → "Searching…" shows, never the Witcher list → AC-7
- [x] On `/store?q=witcher`, press back and forward between two searches → the dropdown never opens; focusing the field opens it → AC-7
- [x] With a screen reader (or the hidden live region in DevTools), results read "6 suggestions", "1 suggestion", or "No games match" → AC-9
- [x] At 360 px wide the dropdown spans the full width under the search row, scrolls inside itself, and sits above the page → AC-12
- [x] `/ui` shows the Search suggestions section with results (active row), dimmed, searching, no matches, and unavailable → AC-12
- [x] On `/store?q=witcher`, the sort select lists Relevance first and selected; choosing "Name: A to Z" adds `sort=name`; choosing Relevance removes it → AC-11
- [x] On `/store?q=witcher&sort=name`, remove the search chip → the URL becomes `/store` and Relevance is no longer offered → AC-11
- [x] Open `/store?sort=relevance` → redirected to `/store` → AC-11
- [x] On `/store?q=hades&platform=steam&sort=price_desc`, click Clear all → `/store?q=hades` → AC-11

## Commands
- [x] `curl '<api>/api/v1/products?q=witchr'` → first `data[0].name` is "The Witcher 3: Wild Hunt"; same for `witcher`, `wicher`, `wild hunt` → AC-6, AC-3
- [x] `curl '<api>/api/v1/search/suggestions?q=witchr'` → `{ data: [...] }`, at most 6 items, first is The Witcher 3: Wild Hunt, no `links` or `meta` → AC-4, AC-6
- [x] `cyberpnk`, `eldn ring`, `baldurs gate`, `assasins creed`, `starfeild` each find their game; `witcher blood` returns only Blood and Wine; `stardew` lists Stardew Valley before Starfield → AC-6
- [x] `q=gta` returns nothing (short words only match by containment); `q=%` and `q=_` match only names holding those characters → AC-1
- [x] `products?sort=relevance` (no `q`) returns 200 and the same order as no params → AC-3
- [x] Suggestions with `q` missing, ` a `, 101 characters, `q[]=x`, `%00`, or `%FF` → 422 keyed `q` → AC-4
- [x] The 121st catalog request in a minute → 429 with `Retry-After` (proven on a local `artisan serve`; production sends `x-ratelimit-limit: 120` but its single free tier worker cannot serve 121 requests in a minute from one client) → AC-4
- [x] `SELECT extname FROM pg_extension WHERE extname='pg_trgm'` and `SELECT indexname FROM pg_indexes WHERE indexname='products_name_trgm_idx'` on Neon → both rows exist after the Render deploy (index row with `gin_trgm_ops` confirmed by the developer in the Neon SQL editor, 2026-11-13; similarity matches like `witchr` on production prove the extension is live) → AC-5
- [x] `cd server && php artisan test && composer format:check && composer analyse` → all pass → AC-12
- [x] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → all pass → AC-12
- [x] CI is green on the push, and the Render and Vercel deploys succeed → AC-12

## Value sourcing
- [x] Words: `q=Wild%20%20HUNT%20wild` behaves the same as `wild hunt` (lowercased, deduplicated) → AC-1
- [x] Similarity threshold 0.5: `starfeild` (score 0.5) still finds Starfield; `wichr` (under 0.4) finds nothing → AC-1
- [x] Short word cutoff: `gat` finds Baldur's Gate 3 by containment, `gta` finds nothing → AC-1
- [x] Tier and score: `witchr` gives The Witcher 3: Wild Hunt tier 2 and score 0.7143 (Pest `binds the tier and score columns in order`) → AC-2
- [x] Effective sort: with `q`, no `sort` means relevance; without `q`, `sort=relevance` means name → AC-3
- [x] Suggestion `price`: an out of stock match shows `price: null` and "Out of stock" in the row → AC-4, AC-8
- [x] At most 6 rows: a term matching 8 games returns 6 → AC-4
- [x] Cache key: `Witc` and `witc ` share one request → AC-7
- [x] Option ids: `aria-activedescendant` always names an option id that exists in the listbox → AC-9
- [x] Store sort default: `defaultSort(q)` is relevance with a search, name without → AC-11

## Acceptance-criteria coverage
- AC-1 word rules and wildcard steps, Value sourcing words, threshold, cutoff · AC-2 tier and score, `stardew` ordering · AC-3 products curl, `sort=relevance` without `q` · AC-4 suggestions curl, 422, 429, price null, limit · AC-5 Neon extension and index · AC-6 seeded term curls and the first UI step · AC-7 debounce, cache, open rule, flash steps · AC-8 rows, highlights, See all · AC-9 keyboard, focus, live region · AC-10 searching, empty, unavailable, dimmed · AC-11 store sort steps · AC-12 360 px, `/ui`, checks, CI, deploy
