# Eneba Marketplace (internship assignment)

A marketplace for digital game keys in the style of [eneba.com](https://www.eneba.com), built for the Eneba Intern Assignment 2027. Visitors browse a store, search with typo tolerance, and compare offers from several sellers. Signed in buyers pay with a simulated card and receive a unique key.

| | |
|---|---|
| **Live app** | https://eneba-internship-assignment.vercel.app |
| **API** | https://eneba-api.onrender.com (health check: `/up`) |
| **Source** | https://github.com/bucys/eneba-internship-assignment |

> **The first visit can take up to a minute.** The API runs on Render's free plan, which sleeps after 15 minutes without traffic. Waking it took 23 to 35 seconds in measurements. The app shows "Waking up the server" while it waits. After that, the homepage loads in about 0.6 seconds. See [Hosting limitations](#hosting-limitations).

## Try it in two minutes

1. Open the live app and pick any game from the homepage or the search box.
2. Compare the seller offers and add one to the cart (no account needed yet).
3. Click Checkout. You are asked to register or sign in, and your guest cart merges into your account.
4. Pay with a test card from the table below.
5. The confirmation page shows your order. Click **Reveal key** to see it. You can find it again under **My orders**.

### Test cards

Payment is simulated. No card is charged, no card data is stored or logged, and nothing leaves the server.

| Card number | Result |
|---|---|
| `4242 4242 4242 4242` | Approved |
| `4000 0000 0000 0002` | Declined: "Your card was declined." |
| `4000 0000 0000 9995` | Declined: "Your card has insufficient funds." |

Use any future expiry (for example `12/30`), any 3 digit CVC, and any name. Any other number that passes the Luhn check is approved too. The checkout page shows these numbers, so you never need this README to test it.

## Features

Every part of the brief is built. Search, the store, checkout with key delivery, and the homepage blocks got the most depth.

- **Homepage**: assembled from blocks the server controls. `GET /home` returns which blocks to show, in what order, with their titles. Each block then loads from its own endpoint and has its own loading, error, and empty states, so one failing block never breaks the page.
- **Store** (`/store`): filter by platform, region, and price range, sort by relevance, name, or price, paginate. Filters live in the URL, so a filtered view can be shared or bookmarked.
- **Search**: a search box in the header on every page, with suggestions while you type. It copes with typos and partial names (`witchr` finds The Witcher 3, `cyberpnk` finds Cyberpunk 2077, `eldn ring` finds Elden Ring).
- **Product page**: details, a buy box with the best price, and every seller's offer with price, rating, and stock.
- **Cart**: works for guests and signed in buyers, with live prices and per line availability.
- **Checkout**: one database transaction checks prices and stock again, charges the simulated gateway, writes the order, and assigns one unique key per unit. Retries and double clicks can never create a second order.
- **Key delivery and order history**: keys are revealed on demand on the order page. `/orders` lists past orders.
- **Authentication**: register, sign in, sign out. Checkout and orders require an account. Expired sessions, a second open tab, and rate limits are handled.
- **Eneba styling**: colours, the Metropolis typeface, spacing, and components follow eneba.com screenshots (`docs/reference/`). Works from 360 px phones up. Accessibility basics throughout: one `<h1>` per page, keyboard focus rings, labelled controls, AA contrast.

## Architecture

```
Browser ──► Vercel: React SPA (client/)
              │  REST + JSON, Bearer token
              ▼
            Render (Docker): Laravel API (server/)  ──►  Neon: PostgreSQL 17
```

- **Two apps in one repository.** `client/` is a Vite React single page app. `server/` is a Laravel REST API. They talk only through `/api/v1`, and every response uses the `{ data }` wrapper.
- **The server owns every rule.** Prices, discounts, stock, cart totals, offer order, and search ranking are all computed on the server. The client never does money math, so the store, cards, cart, and checkout can never disagree.
- **Server code shape**: thin controller, then a Form Request for validation, then an action class with the logic, then an API Resource for the JSON. For example `ProductController` → `ListProductsRequest` → `ListProducts` → `ProductResource`.
- **Money** is integer cents plus a currency code (EUR only). Never floats.
- **Client data** goes through TanStack Query; routes use React Router data mode, so pages load their data before they render and protected routes redirect before anything shows.

### Data model

`platforms`, `regions`, `sellers`, `products`, `offers`, `product_keys`, `cart_items`, `orders`, `order_items`, plus `home_blocks` and `banners` for the homepage. A product is one store listing (game, edition, platform, and region). Sellers compete on it with one offer each. Stock and the cheapest price are always counted from the data, never stored, so they cannot drift. Order items keep a snapshot of the price and names at purchase time.

### Homepage blocks

The brief asks that each block gets its content from the backend and nothing is hardcoded in the frontend. That is how it works:

| Endpoint | Content | Source |
|---|---|---|
| `GET /home` | Which blocks show, their order and titles | `home_blocks` table |
| `GET /home/banners` | Featured promo tiles | `banners` table, with live prices from offers |
| `GET /home/best-sellers` | Top 12 products | Units sold, summed over paid orders (all time) |
| `GET /home/deals` | Top 12 discounts | Biggest percent off the list price, from the cheapest in stock offer |
| `GET /products` | "Browse games" grid | The same store endpoint |

Hiding a block or reordering the page is a database change, not a deploy. Best sellers needs real orders to rank, so a **demo order seeder** places 15 orders through the real checkout code for a demo account nobody can sign in to (it has a random password). That keeps Best sellers full on a fresh deploy, and every ranked unit is a real paid order.

### Search

Search uses PostgreSQL's `pg_trgm` extension (trigram similarity, which matches words that share most of their letters). Every word in the query must match, either as a plain substring or, for words of 4 or more letters, by similarity at a threshold of 0.5. A GIN index serves both. Results sort by relevance: names that start with the query first, then names that contain every word, then fuzzy matches. At this threshold a few near names match too (`stardew` also lists Starfield, after Stardew Valley).

Relevance is the one sort that does **not** push out of stock products to the end. If you search for an exact title, you should see that title first even when it is sold out, rather than a different game that happens to be in stock. Every other sort puts out of stock products last.

## Scope decisions and tradeoffs

The brief says to decide the scope and justify it. These are the conscious choices.

**Payment and orders**
- **Payment is simulated** behind a `PaymentGateway` interface (`SimulatedPaymentGateway`). The checkout action does not know the gateway is fake.
- **The simulated charge runs inside the database transaction.** That is safe only because the fake charge is instant and cannot fail halfway. A real provider needs a different lifecycle, because a network call must never run while row locks are held: (1) in a short transaction, write a `pending` order and reserve its keys; (2) call the provider outside any transaction, passing our idempotency key so it ignores retries; (3) in a second short transaction, mark the order `paid` and the keys sold, or `failed` and release the keys; (4) reconcile through the provider's webhooks and a sweep for orders stuck in `pending`; (5) refund automatically when a charge succeeds but the order cannot be completed. That needs a wider order status, a reservation expiry, and a webhook endpoint. It is listed as deferred work.

**Keys**
- **Key codes are fake and stored as plain text.** A database leak would expose every unsold key. A real store encrypts them at rest.
- **Reveals are not tracked.** A real store records `revealed_at`, so it can refuse a refund once a buyer has seen the key. The keys endpoint is the only place codes are returned, only to the order's owner, and it sends `Cache-Control: no-store`.

**Catalog and product page**
- **One listing per platform and region.** "The Witcher 3 on Steam, Europe" and "on Xbox, Global" are separate products, as on Eneba. It keeps offers and stock simple, at the cost of one game appearing several times in the store.
- **Exact stock counts are public.** Fine for a demo; a real marketplace might hide them from competing sellers.
- **The server sorts offers** (in stock first, then cheapest) and picks the best price. The client only displays it.
- **Cover art** is hotlinked from Steam's image servers and belongs to its publishers. It is used here for a non commercial demo only. If Steam moves an image, the card shows a placeholder. The catalog is 81 listings (30 games plus 4 DLC across Steam, Xbox, PlayStation, and Nintendo in three regions) with 8 made up sellers.

**Cart**
- **Guest cart in `localStorage`.** A guest's cart is a list of offer ids and quantities in the browser. The server prices it through a public preview endpoint, so prices and stock are always live. On sign in it merges into the account cart (quantities add up, then get capped at stock and 10 per line).
- **No stock reservation.** Adding to the cart does not hold a key. Checkout checks stock and prices again, and if anything changed it refuses with "Your cart changed" and shows the updated cart. Nothing is charged.
- **Accepted merge retry tradeoff.** If the merge response is lost and the client retries, quantities can double. They are still capped and visible in the cart before paying. An idempotency key would fix it, but costs a column or cache entry for a rare case.

**Authentication**
- **Bearer token in `localStorage`.** Sanctum issues a token that expires after 7 days. Storing it in `localStorage` keeps the API stateless and avoids cookie and CSRF setup across two domains. The cost is that a cross site scripting bug could read it. React escapes all rendered text and the app never injects raw HTML, which limits that risk.
- **No password reset or email verification.** Both need a real mail provider. A user who forgets their password cannot recover the account.
- **Vercel preview deployments cannot sign in.** The API rejects every write from a preview origin (`Preview deployments are read only.`), so previews can browse but never create accounts or orders against the production database.

**Deferred on purpose** (kept in [`docs/scope/scope.md`](docs/scope/scope.md)): password reset, wishlist, filter counts, currency and region switch, an admin or seller panel, a payment provider's test mode, SEO metadata, error monitoring, translations, and reviews.

## Hosting limitations

Everything runs on free plans: Vercel (client), Render (API, one instance with 0.15 CPU and 512 MB RAM in Frankfurt), and Neon (database). Measurements are in [spec 0016 verify.md](docs/specs/0016-performance-reliability/verify.md).

- **Cold start: about 23 to 35 seconds.** After 15 minutes without traffic, Render stops the container. The first request waits while it starts again (container start, migrations, PHP boot). The server's own work on that first request stays under 1 second, so the wait is the platform, not the app. A full cold homepage took 29 to 42 seconds. There is deliberately no keep alive ping. The client shows a waking up notice after 3 seconds and waits up to 90 seconds before giving up.
- **Warm homepage: about 0.6 seconds** (median 575 ms for all five calls in parallel, down from 5.7 seconds). The gains came from enabling OPcache (83% less), moving the rate limiter to APCu memory (25% less), and fetching every homepage block in the route loader at once (21% less).
- **Where the time goes when warm:** 300 to 450 ms of each call is server work, mostly database queries to Neon. The other 120 to 140 ms is network and the hand off to PHP. Requests are not queued waiting for a worker.

## Run it locally

You need Docker, PHP 8.4 with Composer (and the `pdo_pgsql` extension), and Node 24 (see `client/.nvmrc`).

```bash
# 1. Database: Postgres 17 with two databases, eneba (dev) and eneba_test (tests)
docker compose up -d

# 2. API on http://localhost:8000
cd server
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed      # tables, the catalog, the homepage, and the demo orders
php artisan serve

# 3. Client on http://localhost:5173 (in a second terminal)
cd client
npm install
cp .env.example .env            # VITE_API_URL=http://localhost:8000
npm run dev
```

Every seeder is idempotent, so `php artisan db:seed` is safe to run again.

### Environment variables

Each app commits a `.env.example` with local defaults and comments. Production values live in the Vercel and Render dashboards, never in git.

| App | Variable | Purpose |
|---|---|---|
| client | `VITE_API_URL` | API origin, no trailing slash |
| server | `APP_KEY` | Laravel encryption key (`php artisan key:generate`) |
| server | `APP_URL` | The API's own public origin |
| server | `DB_URL` | Postgres URL. Production uses Neon's direct (not pooled) URL with `?sslmode=require` |
| server | `FRONTEND_URL` | The one client origin CORS allows |
| server | `CORS_PREVIEW_ORIGIN_PATTERN` | Regex for Vercel preview origins (read only). Empty turns previews off |
| server | `CACHE_LIMITER_STORE` | `apc` on Render. Leave unset locally |
| server | `PORT`, `AUTORUN_*`, `HEALTHCHECK_PATH` | Container settings, set on Render only |

### Docker

`docker-compose.yml` runs only the local Postgres. The API's production image is `server/Dockerfile` (`serversideup/php:8.4-fpm-nginx`). It runs migrations on start but never seeds; production is seeded by hand.

## Testing and CI

```bash
cd server && php artisan test                                   # Pest, against eneba_test
cd server && composer format:check && composer analyse          # Pint, PHPStan level 6
cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

- **Server**: about 490 Pest tests against a real Postgres (never SQLite, because search and locking depend on Postgres). They cover every endpoint, the checkout rules and declines, ownership checks, rate limits, and exact query counts on list endpoints to catch N+1 queries.
- **Client**: about 460 Vitest tests, with React Testing Library for components.
- **Concurrency**: `scripts/checkout-concurrency.sh` fires real parallel HTTP checkouts at a served API to prove a key is never sold twice and a retried checkout never creates a second order. Pest cannot do this, because it runs one request at a time.
- **CI** (GitHub Actions, `.github/workflows/ci.yml`) runs on every push and pull request: the server job (Pint, PHPStan, Pest on Postgres 17), the concurrency job (5 rounds), and the client job (Prettier, oxlint, typecheck, Vitest, build).

## Repository layout

```
client/      React SPA (Vite, TypeScript, Tailwind CSS, TanStack Query, React Router)
server/      Laravel 13 API (PHP 8.4, Sanctum, Pest, PHPStan)
docs/specs/  One spec per feature: the decision, acceptance criteria, rationale, verification
docs/scope/  The feature plan and what was deferred
docs/reviews/ Code review findings and how each was resolved
docs/agent-logs/ Claude Code conversation history, sanitized: a readable and a full view per session
scripts/     Checkout concurrency test, homepage timing, agent log export
docker/      Local Postgres init script
```

### Stack

| Part | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, React Router 8 (data mode), lucide-react, Metropolis font |
| Backend | Laravel 13 on PHP 8.4, REST, Sanctum Bearer tokens |
| Database | PostgreSQL 17 with `pg_trgm` |
| Tooling | Vitest, React Testing Library, oxlint, Prettier, Pest 4, Pint, PHPStan with Larastan |
| Hosting | Vercel, Render (Docker), Neon, all free plans |

## How AI was used

The project was built with Claude Code, following a spec first workflow. Each feature went through a written spec (`docs/specs/`) with acceptance criteria, then the build, then verification against the running app, then tests, and code reviews (`docs/reviews/`). The specs record why each decision was made and which alternatives were rejected. The full agent conversation history is in [`docs/agent-logs/`](docs/agent-logs/README.md), one numbered session per Claude Code conversation. Each session has two views. The readable view holds every prompt and every reply from Claude, verbatim. The full view is the technical transcript, with tool calls, results and subagents. Both are generated from the original transcripts by `scripts/export-agent-logs.py`. Secrets, personal emails, account identifiers and local paths are replaced with `[REDACTED:kind]`.
