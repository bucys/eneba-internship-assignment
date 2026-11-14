# Scope: Eneba Marketplace (internship assignment)

An Eneba inspired marketplace for digital game keys. Visitors browse, search, and compare seller offers. Signed in buyers check out with simulated payment and get a unique key. Built for the Eneba Intern Assignment 2027 (`docs/reference/Eneba Internship Assignment.pdf`), with a 3 to 4 day build budget.

**Build approach:** Journey (finish one whole user path, with all its states, before starting the next).
**Workflow:** Alpha (after `/develop`, run `/check verify` on the real app). This is the default level of rigor for the project. Checkout and key delivery are tagged `· Beta`, so they also get `/test`. `/architect` is the recommended first stop for a feature with a real decision, but you can skip it when you already know the build. Any feature can carry its own tag to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

**Scope decisions (to justify in the README):** go deep on search + store, checkout + key delivery, and homepage blocks. Payment is simulated. Each homepage block has its own endpoint and data source in one backend. Guest cart, with sign in required at checkout. Seeded catalog of about 60 to 100 products, each with 2 to 5 seller offers. English only. Accessibility basics from day one.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Data model | Foundation | done |
| 4 | Design system & Eneba UI foundation | Foundation | done |
| 5 | Seed catalog data | Foundation | done |
| 6 | Walking skeleton + public deploy | Skeleton | done |
| 7 | Authentication | Journey 1: Purchase | done |
| 8 | Product page with seller offers | Journey 1: Purchase | done |
| 9 | Cart | Journey 1: Purchase | done |
| 10 | Checkout & simulated payment | Journey 1: Purchase | done |
| 11 | Key delivery & order confirmation | Journey 1: Purchase | done |
| 12 | Order history | Journey 1: Purchase | done |
| 13 | Store catalog: filters, sort, pagination | Journey 2: Discovery | done |
| 14 | Search with typo tolerance | Journey 2: Discovery | done |
| 15 | Homepage blocks | Journey 3: Landing | done |
| 16 | Visual fidelity & polish | Polish | done |
| 17 | Performance & reliability | Polish | planned |
| 18 | Submission readiness | Wrap up | planned |

## Foundations

### 1. Stack & architecture · Beta · done
Choose the frontend, backend, database, and free tier hosting, then scaffold `client/` and `server/` so every later feature builds on real structure.
**Done when:** the stack and repo layout are recorded in a spec, and both apps boot locally and pass a build.
spec [0001](../specs/0001-stack-architecture/index.md) · code in `client/`, `server/`, `docker-compose.yml`
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack & architecture` (AC-1 to AC-3)
- [x] Verify it: `/check verify stack & architecture`
- [x] Test it: `/test stack & architecture`

### 2. Coding standards & tooling · done
Capture conventions from the real scaffold, then add lint, format, type and static analysis checks for both apps, and run them all in CI.
**Done when:** root `AGENTS.md` reflects the real stack; in `client/`, Prettier, oxlint, and `tsc -b` run clean; in `server/`, Pint and PHPStan (Larastan) run clean; and a GitHub Actions workflow runs lint, format check, type and static analysis, tests, and the client build on every push and pull request, failing on any error.
code in `client/` (Prettier), `server/pint.json`, `server/phpstan.neon`, `.github/workflows/ci.yml`
- [x] Capture conventions + tooling choices: `/audit`
- [x] Build it: `/develop coding standards & tooling`
  - [x] Client: Prettier added with `format` and `format:check` scripts; existing oxlint (`npm run lint`) and TypeScript (`npm run typecheck`) checks kept and passing
  - [x] Server: Laravel Pint configured (`pint.json`) with a check mode command, passing on the current code
  - [x] Server: PHPStan with Larastan configured (`phpstan.neon`) at an agreed level, passing with no baseline errors hidden
  - [x] CI: GitHub Actions workflow with a server job (PHP 8.4, Postgres 17 service with `eneba_test`, Pint check, PHPStan, Pest) and a client job (`npm ci`, Prettier check, oxlint, typecheck, Vitest, build)
  - [x] Commands documented in root and nested `AGENTS.md`
- [x] Verify it: `/check verify coding standards & tooling` (CI goes green on a real push, and red on a deliberate lint error)

### 3. Data model · done
Core entities every journey rests on: users, products, platforms, regions, sellers, offers, key stock, carts, orders, and order items.
**Done when:** the schema supports offers per seller, a unique key per purchased unit, a guest cart that merges on login, and order history, without a breaking migration later.
spec [0002](../specs/0002-data-model/index.md) · code in `server/app/Models/`, `server/app/Enums/`, `server/database/migrations/`, `server/database/factories/`, `server/tests/Feature/DataModel/`, `server/tests/Migrations/`
- [x] Design it (spec): `/architect data model`
- [x] Build it: `/develop data model`
  - [x] Enums and the nine migrations with named checks, unique constraints, and indexes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7)
  - [x] Eloquent models with relations, casts, scopes, and the order ULID, plus factories with states (AC-3, AC-5, AC-8)
  - [x] Pest schema tests, one violation per test, plus an isolated rollback test (AC-1 to AC-7)
  - [x] Pint, PHPStan, and Pest green locally and in CI (AC-9)
- [x] Verify it: `/check verify data model`

### 4. Design system & Eneba UI foundation · done
Eneba look and feel: colors, type, spacing, header, product card, buttons, and form fields, mobile first and accessible.
**Done when:** `design.md` covers tokens and base components, the shared header and layout render on mobile and desktop, and base components handle focus, keyboard, and contrast.
spec [0003](../specs/0003-design-system-ui-foundation/index.md) · code in `client/src/components/`, `client/design.md`
- [x] Design it (spec): `/architect design system & Eneba UI foundation`
- [x] Build it: `/develop design system & Eneba UI foundation`
  - [x] Tokens, Metropolis font, starter removed (AC-1, AC-2, AC-6, AC-15, AC-17)
  - [x] Router layout shell: header, search, cart, footer, 404 (AC-3, AC-4, AC-5)
  - [x] Base components: buttons, form fields, price, product card and grid, states, alert, toast (AC-8 to AC-13)
  - [x] Dev only `/ui` showcase, `client/design.md` with contrast table, all checks green (AC-7, AC-14, AC-16, AC-17)
- [x] Verify it: `/check verify design system & Eneba UI foundation`

### 5. Seed catalog data · done
A repeatable seed of about 60 to 100 games across platforms and regions, with 2 to 5 seller offers each and a pool of keys per offer.
**Done when:** one command resets and seeds the database, with images, prices, and stock varied enough to make filters, sorting, and typo search meaningful.
spec [0004](../specs/0004-seed-catalog-data/index.md) · code in `server/database/data/catalog.php`, `server/database/seeders/`
- [x] Design it (spec): `/architect seed catalog data`
- [x] Build it: `/develop seed catalog data`
  - [x] Catalog data file: 34 titles, 81 listings, sellers, facts from Steam (AC-2)
  - [x] `OfferPlanner` with unit tests (AC-3, AC-4)
  - [x] `CatalogSeeder` + `DatabaseSeeder` rewrite, with feature tests for rerun, top up, and environment guard (AC-1, AC-5, AC-6, AC-7)
  - [x] Card ratio 2:3, cover URL check, all checks green (AC-8, AC-9, AC-10)
- [x] Verify it: `/check verify seed catalog data`

## Skeleton

### 6. Walking skeleton + public deploy · done
Prove the stack is wired end to end and deployable before feature work: one product read from the database, served by the API, and rendered in the React app on a public URL.
**Done when:** the public frontend URL shows a product fetched from the deployed backend and database, with no hardcoded hosts and secrets kept in environment variables.
spec [0005](../specs/0005-walking-skeleton-deploy/index.md) · code in `server/`, `client/`
- [x] Design it (spec): `/architect walking skeleton + public deploy`
- [x] Build it: `/develop walking skeleton + public deploy`
  - [x] Products list API: cheapest price, discount, resource, rate limit (AC-1 to AC-5)
  - [x] CORS and proxy trust (AC-6, AC-12)
  - [x] Client data layer and home page grid with all states (AC-7 to AC-9)
  - [x] Dockerfile, checks green, CI on `main` (AC-10, AC-13)
  - [x] Deploy to Neon, Render, Vercel; seed and production checks (AC-11, AC-12)
- [x] Verify it: `/check verify walking skeleton + public deploy`

## Journey 1: Purchase

The assignment's core path, built completely first: product page → cart → sign in → pay → receive key → find it again in order history.

### 7. Authentication · done
Create an account, sign in, sign out, and guard the parts only signed in users may reach (checkout, orders).
**Done when:** a visitor can register and sign in, protected pages redirect to sign in and return afterward, and validation and wrong password errors render clearly.
spec [0006](../specs/0006-authentication/index.md) · code in `server/app/Actions/Auth/`, `client/src/lib/auth.ts`, `client/src/pages/AuthPage.tsx`
- [x] Design it (spec): `/architect authentication`
- [x] Build it: `/develop authentication`
  - [x] Server auth API: Sanctum, register, login, me, logout (AC-1 to AC-4)
  - [x] Rate limits, exposed `Retry-After`, preview write guard (AC-5, AC-6)
  - [x] Client auth core: token store, `apiFetch` Bearer and 401 handling, `safeRedirect`, Vitest (AC-8, AC-9, AC-12 to AC-15)
  - [x] Auth page with tabs, header account menu, sign out, `/orders` guard, checks green and deployed (AC-7 to AC-15)
- [x] Verify it: `/check verify authentication`

### 8. Product page with seller offers · done
One game's details plus the offers from several sellers, so a buyer can compare price and seller and pick one.
**Done when:** the page shows details, platform, region, and an offer list sorted by price, the cheapest offer is highlighted, out of stock offers can't be bought, and an unknown product shows a not found state.
spec [0007](../specs/0007-product-page-seller-offers/index.md) · code in `server/app/Actions/Catalog/ShowProduct.php`, `client/src/pages/ProductPage.tsx`, `client/src/components/product/`
- [x] Design it (spec): `/architect product page with seller offers`
- [x] Build it: `/develop product page with seller offers`
  - [x] Server product detail API: route, `ShowProduct` sort and best offer, resources, Pest tests (AC-1 to AC-4)
  - [x] Client data layer: types, `productQuery`, `formatRating`, `formatReleaseDate`, type labels, Vitest; extract `CoverImage` (AC-5 to AC-7, AC-10)
  - [x] Product page: hero with buy box, offer list, About, route `/products/:slug` (AC-5 to AC-7, AC-9)
  - [x] Page states: skeleton and slow notice, not found, error retry, tab title; checks green, CI and deploy (AC-8 to AC-10)
- [x] Verify it: `/check verify product page with seller offers`

### 9. Cart · done
Add a chosen offer to the cart, change quantity, remove items. Works as a guest and carries over after sign in.
**Done when:** a guest cart persists across reloads, merges into the account on sign in, totals update live, quantity is capped by available stock, and the empty cart state renders.
spec [0008](../specs/0008-cart/index.md) · code in `server/app/Actions/Cart/`, `client/src/lib/cart.ts`, `client/src/components/cart/`
- [x] Design it (spec): `/architect cart`
- [x] Build it: `/develop cart`
  - [x] Server cart API: shared `Cart` resource, read, add, set, remove, `cart` limiter (AC-1 to AC-4, AC-7)
  - [x] Preview and merge endpoints with the preview guard exemption, plus Pest tests (AC-5 to AC-7)
  - [x] Client data layer: guest cart store, cart queries and actions, single flight merge, sign out guard, Vitest (AC-8, AC-10, AC-11)
  - [x] Product page Add to cart, toast link, header badge, `/cart` page with all states, `/checkout` placeholder (AC-9, AC-12 to AC-14)
  - [x] Checks green, CI, deploy, 360px and keyboard (AC-15)
- [x] Verify it: `/check verify cart`

### 10. Checkout & simulated payment · Beta · done
Signed in checkout with a simulated card form that can succeed or decline, creating an order exactly once.
**Done when:** a successful payment creates one paid order, a decline shows an error and leaves the cart intact, double submits don't create duplicate orders, and prices are recalculated on the server.
spec [0009](../specs/0009-checkout-simulated-payment/index.md) · code in `server/app/Actions/Checkout/`, `server/app/Payments/`, `client/src/pages/CheckoutPage.tsx`, `client/src/pages/OrderConfirmationPage.tsx`
- [x] Design it (spec): `/architect checkout & simulated payment`
- [x] Build it: `/develop checkout & simulated payment`
  - [x] Per user `CartLock` in the cart actions, simulated gateway, `CheckoutRequest`, replay first flow, `PlaceOrder` with key allocation, order resources, routes, limiter, Pest (AC-1 to AC-8, AC-18)
  - [x] `GET /orders/{ulid}` and the concurrency script passing 20 rounds (AC-6, AC-9, AC-18)
  - [x] Client data layer: `api/orders.ts`, card input helpers, `usePlaceOrder`, error mapping, Vitest (AC-12 to AC-14)
  - [x] Checkout page and order confirmation page with all states (AC-10 to AC-15)
  - [x] Checks green, CI, deploy, public purchase, stock drop, 360px and keyboard (AC-16, AC-17)
- [x] Verify it: `/check verify checkout & simulated payment`
- [x] Test it: `/test checkout & simulated payment`
- [x] Carried from feature 8: after a real purchase, the product page offer `stock` drops by one, and at 0 the row moves below every in stock row (spec 0007 verify.md, Value sourcing: stock)

### 11. Key delivery & order confirmation · Beta · done
Show the buyer the keys checkout already allocated (spec 0009): an owner only keys endpoint, fetched on the first Reveal, with masked keys, copy, and hide on the confirmation page.
**Done when:** each paid unit's one key is returned only to its buyer (also under concurrent purchases, building on spec 0009's allocation and stock drop), and the confirmation page reveals the keys with a copy action.
spec [0010](../specs/0010-key-delivery-order-confirmation/index.md) · code in `server/app/Actions/Orders/ShowOrderKeys.php`, `client/src/lib/orderKeys.ts`, `client/src/components/orders/`
- [x] Design it (spec): `/architect key delivery & order confirmation`
- [x] Build it: `/develop key delivery & order confirmation`
  - [x] Server keys API: `ShowOrderKeys`, `OrderItemKeysResource`, `NoStore`, route, item `id` on `OrderItemResource`, Pest (AC-1 to AC-3)
  - [x] Concurrency script scenario 4: winner reads its key, loser gets 404 (AC-4)
  - [x] Client data layer: keys query, `useOrderKeys` reveal state, error and copy hint helpers, fixtures, Vitest (AC-7, AC-9, AC-10)
  - [x] `KeySlot` and `OrderKeys` on the order page with all states, Vitest (AC-5 to AC-10)
  - [x] `/ui` states, 360px, keyboard, contrast, checks green, CI, deploy, public reveal and copy (AC-11)
- [x] Verify it: `/check verify key delivery & order confirmation`
- [x] Test it: `/test key delivery & order confirmation`

### 12. Order history · done
Signed in users see past orders and can reveal their keys again.
**Done when:** orders list newest first with status and totals, an order's detail shows its keys, users can never see another user's orders, and the empty state renders.
spec [0011](../specs/0011-order-history/index.md) · code in `server/app/Actions/Orders/ListOrders.php`, `server/app/Http/Resources/OrderSummaryResource.php`, `client/src/pages/OrdersPage.tsx`, `client/src/lib/orderHistory.ts`, `client/src/components/orders/`, `client/src/components/ui/Pagination.tsx`
- [x] Design it (spec): `/architect order history`
- [x] Build it: `/develop order history`
  - [x] Server list API: `Order::firstItem`, `ListOrders`, `OrderSummaryResource`, `orders.index` route, Pest (AC-1, AC-2)
  - [x] Client data layer: `getOrders`, `orderListQuery`, `orderHistory` helpers, checkout invalidation and `justPaid` state, Vitest (AC-4, AC-6, AC-7)
  - [x] `/orders` page with `Pagination`, summary rows, and all states, plus the order page "Order details" arrival and back link, Vitest (AC-3 to AC-5, AC-7)
  - [x] `/ui` states, 360px, keyboard, contrast, checks green, CI, deploy, public purchase found in history (AC-8)
- [x] Verify it: `/check verify order history`

## Journey 2: Discovery

### 13. Store catalog: filters, sort, pagination · done
Browse every product, narrow by platform, region, and price, change the sort order, and page through results.
**Done when:** filters and sort combine correctly on the server, state lives in the URL (shareable, back button works), result counts and the no results state render, and the layout works on mobile.
spec [0012](../specs/0012-store-catalog/index.md) · code in `server/app/Actions/Catalog/ListProducts.php`, `server/app/Http/Requests/Catalog/ListProductsRequest.php`, `server/app/Actions/Catalog/ListCatalogFilters.php`, `client/src/pages/StorePage.tsx`, `client/src/lib/storeParams.ts`, `client/src/components/store/`
- [x] Design it (spec): `/architect store catalog`
- [x] Follow up from the order history review: check `ProductController::index` for the page offset overflow fixed in `ListOrders` (a page near `PHP_INT_MAX` silently returned page 1's rows; capped by `ListOrders::MAX_PAGE`) · covered by spec 0012 AC-3 (`ListProducts::MAX_PAGE`)
- [x] Build it: `/develop store catalog`
  - [x] Server list API: `ListProductsRequest`, `ProductFilters`, `ProductSort`, filters, sorts, and `MAX_PAGE` in `ListProducts`, plus `GET /catalog/filters`, Pest (AC-1 to AC-4)
  - [x] Client data layer: `storeParams` helpers, `productsQuery(params)`, `catalogFiltersQuery`, homepage call updated, Vitest (AC-5, AC-7)
  - [x] `/store` page: canonical URL loader, results, count, pagination with overflow, every state, Vitest (AC-5, AC-8, AC-9)
  - [x] Filters and entry points: sidebar and mobile `<dialog>` panel, price fields, sort, chips, Clear all, header Store link and search sync, homepage See all (AC-6, AC-7, AC-10)
  - [x] `/ui` entries, 360px, keyboard, contrast, checks green, CI, deploy, public store run (AC-11)
- [x] Verify it: `/check verify store catalog`

### 14. Search with typo tolerance · done
A search box in the global header with live suggestions and a results page that copes with typos and partial names.
**Done when:** searching "witcher", "witchr", or "wild hunt" finds The Witcher 3, suggestions appear while typing (debounced) and are keyboard navigable, and results reuse the store's filters.
spec [0013](../specs/0013-search-typo-tolerance/index.md) · code in `server/app/Support/ProductSearch.php`, `server/app/Actions/Catalog/SuggestProducts.php`, `client/src/components/layout/SearchForm.tsx`
- [x] Design it (spec): `/architect search with typo tolerance`
- [x] Build it: `/develop search with typo tolerance`
  - [x] Server matcher: `pg_trgm` migration and index, `SearchTerms`, `ProductSearch` (indexable `<%` check), relevance sort on `GET /products`, Pest (AC-1 to AC-3, AC-5, AC-6)
  - [x] Suggestions API: `GET /search/suggestions` request, action, resource, Pest (AC-4, AC-6)
  - [x] Client store relevance sort: `defaultSort(q)` in `storeParams`, sort select, Clear all, Vitest (AC-11)
  - [x] Header combobox: suggestions query, debounce, highlighting, keyboard, states, live region, RTL tests (AC-7 to AC-10)
  - [x] `/ui` entries for the dropdown states: results, searching, no matches, unavailable (AC-12)
  - [x] Local checks green: server Pest, Pint, PHPStan; client format, lint, typecheck, Vitest, build (AC-12)
  - [x] 360px, keyboard, and contrast check in a browser (AC-12)
  - [x] Commit, CI green, Render and Vercel deploy, `pg_trgm` and index confirmed on Neon, public search run with the AC-6 terms (AC-12, AC-5, AC-6)
- [x] Verify it: `/check verify search with typo tolerance`

## Journey 3: Landing

### 15. Homepage blocks · done
A homepage assembled from blocks (hero banner, best sellers, deals) where each block fetches from its own endpoint and data source; the frontend hardcodes no content.
**Done when:** each block loads independently with its own loading and error state, one failing block doesn't break the page, best sellers reflect real order data, and every card links into the purchase journey.
spec [0014](../specs/0014-homepage-blocks/index.md) · code in `server/app/Actions/Home/`, `client/src/components/home/`, `client/src/pages/HomePage.tsx`
- [x] Design it (spec): `/architect homepage blocks`
- [x] Build it: `/develop homepage blocks`
  - [x] Layout frame: `home_blocks` and `banners` tables, `HomeSeeder`, `GET /home`, `HomePage` layout states, `HomeSection` bands, `ErrorBoundary`, grid moved into its block (AC-1, AC-5, AC-6, AC-8, AC-9, AC-12)
  - [x] Hero: `GET /home/banners`, `ScrollRail`, portrait tile strip with all states (AC-2, AC-9, AC-10)
  - [x] Best sellers and Deals: both endpoints, `DemoOrdersSeeder` through `PlaceOrder`, `ProductRailBlock` (desktop rail, mobile list with Show all), `ProductCard` layout prop and ring hover (AC-3, AC-4, AC-7, AC-11, AC-12)
  - [x] Tests, `design.md` and contrast rows, `/ui`, 360px and keyboard check, CI, deploy, production seed (AC-13)
- [x] Verify it: `/check verify homepage blocks`
- Follow ups from `/check review` (2026-11-13, Approve with nits) moved to feature 17: slow production first load, the minor and nit findings, and the 10 unit checkout charged for 6 units.

## Polish

### 16. Visual fidelity & polish · done
Bring the existing UI close to the supplied Eneba desktop and mobile references, without changing established functionality. Close visual fidelity, not pixel perfection.
**Done when:** a spec records the visual audit findings against `docs/reference/desktop/` and `docs/reference/mobile/`, the shared design rules, and bounded acceptance criteria; those criteria pass on desktop and at 360px; existing tests and user journeys are unchanged; contrast and keyboard checks still pass.
spec [0015](../specs/0015-visual-fidelity-polish/index.md) · code in `client/src/components/`, `client/src/index.css`, `client/design.md`, `server/database/data/home.php`, `server/database/seeders/HomeSeeder.php`
- [x] Design it (spec): `/architect visual fidelity & polish`
- [x] Build it: `/develop visual fidelity & polish`
  - [x] Shared system: tokens, Price, ProductCard (AC-1 to AC-4)
  - [x] Browse journey: single row header from `md` (two lines below it), split hero, platform shortcuts, featured art seed (AC-5 to AC-12)
  - [x] Find and buy journeys: store panels, product page buy box, checkout header and stepper, row prices (AC-13 to AC-20)
  - [x] Account pass, full checks, paired screenshots in verify.md (AC-21 to AC-25)
- [x] Verify it: `/check verify visual fidelity & polish`
- Supplied: `server/public/images/banners/cyberpunk-2077-featured.webp` (text free, 3:1 WebP, 2172 by 724, 249 KB, subject on the right; approved minimum per spec 0015 AC-12)
- Deferred follow ups (non blocking minors from the [review](../reviews/2026-11-15-main-visual-fidelity-polish.md); not part of feature 17 unless enrolled there):
  - `HomePageSkeleton` has no placeholder for the platform shortcuts row, so content shifts when the page loads.
  - `BuyBox` imports `otherOffersSummary` from `pages/productPageView`; move it to `lib/` or beside the offer components.
  - No tests for `ProductBreadcrumb`, `ProductInfoRows`, `ProductTitleBlock` (AC-15, AC-17 rely on the manual verify pass).
  - Featured banner text may overlap the art's subject around 1024 to 1100px; check and cap the text column or extend the gradient if it does.

### 17. Performance & reliability · Beta · needs a decision
Investigate production homepage latency, fix confirmed bugs, and resolve the review findings that matter.
**Done when:** homepage latency is measured before and after with recorded evidence; each fix is justified by that evidence, or the limit is documented as an infrastructure constraint (for example Render free tier workers); confirmed checkout bugs are fixed with a regression test each; every relevant finding in `docs/reviews/` is fixed or marked won't fix with a reason; CI is green.
- [ ] Design it (spec): `/architect performance & reliability`
- Carried in from feature 15 ([review](../reviews/2026-11-13-main-homepage-blocks.md)):
  - Production first load is slow: 5 API calls (layout, then 4 blocks) each took 6 to 9 s on Render while one call alone takes about 0.9 s. Check Render's PHP worker count, or add a short `Cache-Control` to the home endpoints.
  - The minor and nit findings in the review file (for example `ScrollRail` re-rendering on every scroll event, band colours flipping when a block resolves empty).
  - A second 10 unit checkout charged for 6 units (the cart seems to cap at available keys without telling the buyer). Confirm with `/debug`, then cover with a regression test.

## Wrap up

### 18. Submission readiness
Final end to end audit, documentation, deployment checks, and submission preparation. Replaces the former feature 16 (Submission package).
**Done when:** the assignment's submission requirements are reviewed and each one is met; the README explains scope, architecture, run instructions and tradeoffs, including every "Submission README (feature 16)" obligation in specs 0002, 0004, 0007, 0008, 0009, 0010 and 0014 (those now belong here); a secrets audit covers the repo, git history, and any log artifact; original Claude Code JSONL transcripts stay local and their gitignore protection stays in place, and only sanitized, reviewed exports are included where the assignment requires them; the public URL passes a full purchase run on desktop and mobile.
- [ ] Build it: `/develop submission readiness`

## Deferred
Out of scope for this build pass, kept so the plan stays honest and the README can justify the cuts.
- **Password reset & email verification**: needs a real mail provider (from spec 0006)
- **Wishlist**: save products for later
- **Store facet counts**: per option counts next to each store filter, e.g. Steam (33) (from spec 0012)
- **Header search stale state**: `SearchForm` compares against the rendered location, so two submits in one frame could push the same URL twice (from spec 0012, AC-5 debug)
- **Currency / region switch**: header selector for display currency and region · needs a decision
- **Admin / seller panel**: manage products, offers, and key stock in the browser · needs a decision
- **Payment provider test mode**: swap the simulated payment for a real sandbox · needs a decision · Beta
- **SEO basics**: page titles, meta tags, readable product URLs, sitemap
- **Error monitoring & analytics**: error reporting and conversion tracking · needs a decision
- **Multiple languages**: translated UI
- **Reviews & ratings**: buyer reviews on products and sellers · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· Beta`) sets that one feature's rigor above or below the project default; no tag inherits the default. It decides the feature's check boxes and each skill's next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing (trust develop's own build time self check); **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
