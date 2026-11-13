# Verify: Store catalog · spec 0012 · updated 2026-11-13
_Steps derived from spec 0012 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [ ] `curl -s "$API/api/v1/products" | jq '[.data[].slug]'` matches the list from before this spec (same rows, same order) → AC-1
- [ ] `curl -s "$API/api/v1/products?platform=steam,xbox&region=europe&price_max=30&sort=price_asc"` → only Steam or Xbox, Europe, price ≤ 3000 cents, ascending; `meta.total` equals the matching count → AC-1, AC-2
- [ ] `?price_min=10&price_max=20` → prices from 1000 to 2000 cents inclusive (2001 excluded); euros become cents by × 100 → AC-1
- [ ] `?price_min=0` → no product with `price: null` → AC-1
- [ ] `?q=WITCHER` finds The Witcher 3; `?q=%25` and `?q=_` match only names holding those characters → AC-1
- [ ] `?sort=price_desc` → highest first, products with `price: null` still last; pages 1 to 4 together hold every product exactly once → AC-2
- [ ] `?platform=sega`, `?platform=Steam`, `?price_min=50&price_max=10`, `?price_max=9.5`, `?price_max=007`, `?price_max=%205`, `?price_max=10001`, `?sort=popular`, `?platform[]=steam`, a 101 character `q`, 11 platform slugs → each 422 with `errors` keyed by the param only (never `platform.0`) → AC-3
- [ ] `?platform=steam,,steam` behaves as `?platform=steam`; `?per_page=100` still gives 24 per page; `?price_min=10` alone is 200 → AC-3
- [ ] `?page=9223372036854775807` → 200, `data: []`, real `meta.last_page` → AC-3
- [ ] 121 requests in a minute to `/products` or `/catalog/filters` → 429 with `Retry-After` → AC-3, AC-4
- [ ] `curl -s "$API/api/v1/catalog/filters"` → `{ data: { platforms, regions } }`, each `{ slug, name }` ordered by name, only ones an active product uses → AC-4
- [ ] `cd server && php artisan test && composer format:check && composer analyse` → green → AC-11
- [ ] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → green → AC-11

## UI / manual
- [ ] Open `/store?page=1&sort=name&platform=steam%2Cxbox` → URL becomes `/store?platform=steam,xbox`, and back does not return to the old URL → AC-5
- [ ] Tick Steam, then Xbox, then press back → only Steam ticked, results follow; forward restores both → AC-5
- [ ] Type 10 in Min, press Enter, then Tab away → one history entry only; choosing the current sort adds none → AC-5
- [ ] On page 2, tick a platform → `page` leaves the URL; on page 1, click Next → the window scrolls to the top and every other param is kept → AC-5, AC-8
- [ ] Type `5.5` in Max → "Enter a whole number from 0 to 10000", nothing applied; Min 50 with Max 10 → "Min must not exceed max" on Min → AC-6
- [ ] Type junk in Min, then remove the price chip → both fields empty, error gone → AC-6
- [ ] At 360px: Filters button shows the active count; the dialog opens, a tick updates the results behind it and "Show N results"; Escape, the close icon, and "Show N results" each close it with focus back on Filters; the page behind does not scroll while open → AC-6
- [ ] With the dialog open, widen past 1024px → the dialog closes and the sidebar shows the same filters → AC-6
- [ ] Chips read "Steam" (option name), "€10 to €30" / "From €0" / "Up to €30" / "€10", and "Search: witcher"; each removes only its own filter; Clear all keeps `q` → AC-7
- [ ] `/store?q=witcher` → `<h1>` `Results for "witcher"`, tab title `Results for "witcher" | Eneba Marketplace (demo)`; `/store` → "Store" → AC-7
- [ ] "N results" ("1 result" for one) shows under the chips; `/store?page=99` jumps to the last page with no empty state flash → AC-8
- [ ] A combination with no match → "No products match" and Clear filters goes to `/store` → AC-9
- [ ] `/store?platform=sega` → "Some filters in this link are not valid." with Clear filters, no Try again; the sega chip removes it → AC-9
- [ ] Block `/catalog/filters` in devtools → only Platform and Region show "Filters could not load." with Try again; chips show slugs; price, sort, and results still work → AC-9
- [ ] Header "Store" link has `aria-current="page"` and yellow text on `/store`; homepage "Browse games" has a "See all" link to `/store` → AC-10
- [ ] On `/store?platform=steam`, search "doom" → `/store?q=doom` (platform dropped); submit again → no new history entry; back → the field shows the previous `q` → AC-10
- [ ] At 360px no sideways scroll; Tab reaches every checkbox, price field, sort, chip, Clear all, Filters, dialog buttons, and page link with the yellow ring → AC-11
- [ ] `/ui` → Store filters section shows the panel loaded, loading, and error, the chips row, and the Filters button with and without a count → AC-11
- [ ] Public deploy: `/store?platform=steam&price_max=20&sort=price_asc` lists only Steam products of €20 or less, cheapest first; opening one leads into the purchase journey → AC-11

## Acceptance-criteria coverage
- AC-1: commands 1 to 5 · AC-2: commands 2, 6 · AC-3: commands 7 to 10 · AC-4: commands 10, 11 · AC-5: UI 1 to 4 · AC-6: UI 5 to 8 · AC-7: UI 9, 10 · AC-8: UI 4, 11 · AC-9: UI 12 to 14 · AC-10: UI 15, 16 · AC-11: commands 12, 13, UI 17 to 19
