# 0005. Walking skeleton: rationale

## Context

Features 1 to 5 built the stack, tooling, schema, UI kit, and seed data, but nothing connects them yet. No `/api/v1` route exists, the client has no fetch layer, and nothing is deployed. The assignment requires a public deployment, and the hosting chosen in spec 0001 (Render free plan, Neon, Vercel) carries known risks: port detection, migrations against a sleeping Neon database, CORS between two free domains, proxy headers, and cold starts of about a minute.

The first endpoint sets precedents later features inherit: the resource JSON shape (key style, nesting, money format), how list endpoints paginate, how prices are derived, and how the client fetches, retries, and shows slow requests. Features 8, 13, and 15 all read products. Spec 0002 already defines the cheapest price rule but leaves it unbuilt, and spec 0003 leaves the discount rounding to feature 15.

If the skeleton is a throwaway, those precedents get set by accident later, under feature pressure. If it is too big, it eats the time budget meant for the purchase journey. Reviewers' first impression is the public URL after a cold start, so an unexplained minute of loading skeletons is a real cost.

## Options considered

### Option 1: The real list endpoint, smallest form, on the home page

`GET /api/v1/products` with the final resource shape, page 1 of 24, cheapest price and discount computed, shown as a grid on `/` with every state, plus the full deploy.

**Pros**:
- Nothing is thrown away; features 13 and 15 add to it.
- Proves the hard part (price derivation through offers and keys) end to end, not just "a row came back".
- A reviewer sees a working store on the root URL.

**Cons**:
- Bigger than a minimal skeleton: a scope, a helper, a limiter, and CORS land now.
- The home grid is temporary and may be removed by feature 15.

### Option 2: One product by slug

`GET /api/v1/products/{slug}`, rendered somewhere on the client.

**Pros**:
- Grows directly into the feature 8 product page.
- The smallest response.

**Cons**:
- The client needs a hardcoded slug to show anything, which breaks when seed data changes.
- Doesn't exercise pagination or the list shape every grid needs.

### Option 3: Throwaway skeleton endpoint

`GET /api/v1/skeleton` returning one product, with a plain `fetch` on the client.

**Pros**:
- The fastest to build and deploy.
- Zero design decisions up front.

**Cons**:
- Deleted later, so it proves only wiring, not the real contracts.
- The resource shape, client data layer, and cold start handling are all deferred to features under more pressure.

## Rationale

Option 1 wins because the skeleton's real job is to set the cross app contracts once, calmly, before the purchase journey. It costs only a little more than a throwaway. The price rule is already defined in spec 0002, so building it now adds no new decision, and it means the first public page shows prices a buyer can actually pay. Snake_case keys and nested `{ slug, name }` relations follow Laravel conventions and give feature 13's filters the slugs they need, with no conversion layer to explain. Pagination at 24 follows spec 0001's list shape and the "every list paginates" rule.

On the client, the cold start notice, timeout, and retry rule come in now because the very first public visit is the cold one. Without them the most likely reviewer experience is a minute of unexplained skeletons. Fetching with `useQuery` inside the section rather than a router loader keeps the page shell and `<h1>` visible during that wait.

Smaller calls: floor rounding for the discount never overstates a deal, and a result of 0 maps to null so "null means no badge" holds (runner up: round half up, which can show -50% for 49.6%). The rate limit is 120 per minute per IP, generous enough for browsing with retries while protecting the single free instance (runner up: 60, which a fast session could hit). The `BlockPreviewWrites` guard waits for feature 7 because there are no writes to block yet (runner up: build it now, which adds tested code nothing exercises). Neon and Render both go in Frankfurt, matching spec 0001's "EU" and keeping DB round trips short.
