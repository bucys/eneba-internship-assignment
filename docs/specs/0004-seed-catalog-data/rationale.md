# 0004. Seed catalog: rationale

The decision record behind [index.md](index.md). `/develop` builds from `index.md`; this file explains why.

## Context

Every journey after this one reads catalog data: the walking skeleton shows one product, the product page compares offers, cart and checkout need stock, search needs names worth searching, and the store needs filters with real spread. Until there is data, none of those features can be built against anything real or checked on the public URL. The scope asks for about 60 to 100 products with 2 to 5 seller offers each, and for data varied enough to make filters, sorting, and typo search meaningful.

The schema is fixed by spec 0002: a product is one game, edition, platform, and region; offers are unique per product and seller; keys are rows, and stock is counted from unsold keys, never stored. The assignment asks for an app that looks like eneba.com, which is mostly game covers. Spec 0001 decided there is no file storage, so images must be URLs.

Production adds hard limits. Render's free plan has no shell, so the seed runs from your machine against Neon. Spec 0001 requires production seeding to be idempotent (safe to run any number of times): upsert by natural keys, never touch orders or sold keys. A reviewer may buy keys on the public site, so a rerun must not break their orders. Destructive reset commands are already blocked in production.

The developer must be able to explain every line, and the build budget is 3 to 4 days in total. A seed that takes a day to write, or that hides its logic in generated data, costs time the journeys need.

## Options considered

### Option 1: Curated PHP data file plus a deterministic offer planner

Real game titles, facts, and Steam app IDs are written by hand in one PHP file. Sellers, prices, list prices, and stock come from a small pure class whose random generator is seeded by the product slug, so the output is the same on every run. The seeder upserts by natural key and tops up unsold keys.

**Pros**:
- Real names and real art, so the store and search look and behave like Eneba.
- About 34 hand written entries instead of about 280 offers and 4,000 keys.
- The same input always gives the same rows, so upserts are truly idempotent and tests can assert rules.
- The planner is a pure function, easy to unit test and explain.

**Cons**:
- Prices are reproducible, not hand picked, so a few may look odd. The fixed draw order becomes a contract once production is seeded.
- Depends on PHP's seeded random engine staying stable across versions.

### Option 2: Model factories with Faker

Reuse the existing factories: `Product::factory()->count(80)->has(Offer::factory()->count(3)->has(ProductKey::factory()->count(15)))`.

**Pros**:
- Almost no new code; the factories already exist.
- Very fast to write.

**Cons**:
- Made up names ("Quis Dolor Amet Est") make typo search demos meaningless and the store look fake.
- Random on every run, so it cannot be idempotent: a rerun duplicates everything or needs destructive resets, which production forbids.
- Faker is a dev dependency, so production seeding becomes fragile.

### Option 3: Every value hand written

The data file lists every product, every offer price and seller, and every stock count.

**Pros**:
- Total control. Every number was chosen on purpose.
- No randomness at all, so nothing can drift.

**Cons**:
- About 280 offers to write and keep consistent with the price and stock rules. Slow, and easy to get subtly wrong (equal prices, a product with all stock zero by accident).
- Rules like "30% to 90% of base" are only conventions, not enforced by code.

### Option 4: Fetch catalog data from a games API at seed time

Pull titles, art, and facts from RAWG, IGDB, or Steam during seeding.

**Pros**:
- Richer data (screenshots, genres) with little typing.

**Cons**:
- Needs network and often an API key during seeding, and a rate limit or outage breaks the seed.
- The output can change between runs, which breaks idempotent upserts and makes tests flaky.
- More moving parts to explain, for data the app barely uses.

## Rationale

Option 1 is the only one that meets all three hard forces at once: it looks like Eneba (real titles and covers), it is safe to rerun in production (deterministic output plus upserts), and it fits the time budget (34 entries plus about 60 lines of planner). Option 2 fails idempotency outright, which spec 0001 made a requirement, and its fake names undermine the search feature's own acceptance test ("witcher", "witchr", "wild hunt"). Option 3 trades a small planner for hours of typing and an error prone file. Option 4 brings network flakiness into a command that must work against production from a laptop.

Seeding the random generator per product slug, rather than once for the whole run, is the key detail. Adding a title or reordering the file then changes only the new product's numbers, not everyone else's. Prices still change if the planner itself changes, which is why the spec treats the draw order as frozen after production seeding.

Key codes stay truly random (`Str::random`, not the seeded generator). They are the one value that should not be reproducible from a public repo, and they never need to match between runs because the top up rule counts keys rather than matching codes.

The top up rule replaces spec 0001's "only offers with no keys" because a public demo will be bought out by testers. Topping up to a target keeps the same safety (sold keys and orders untouched, nothing deleted) and adds a restock path.

Demo orders were deferred to feature 15. Creating paid orders means allocating keys exactly as checkout does. Writing that now would duplicate logic that features 10 and 11 will own, and would break the "seed never touches orders" rule.

### Supporting evidence: Steam cover check (2026-11-11)

- `https://shared.steamstatic.com/store_item_assets/steam/apps/{appId}/library_600x900.jpg` returned 200 `image/jpeg` for all 29 distinct app IDs in the catalog table (the Complete Edition and the DLC reuse their parent's ID). The older `shared.cloudflare.steamstatic.com` host redirects (301) there; `cdn.cloudflare.steamstatic.com/steam/apps/{id}/...` also still served. The Witcher 3 image measured 300×450 (2:3), so the card ratio moves to 2:3.
- The first pick for Call of Duty: Black Ops 6 (2933620) returned 404 and was replaced with Black Ops III (311210, 200).
- A DLC app ID (Hearts of Stone, 378648) returned 404 for the portrait image, which confirms the "parent game's art for DLC" rule.
- Steam's public app details confirmed names, developers, publishers, and release dates for the IDs used, and is the fact source for the data file.
