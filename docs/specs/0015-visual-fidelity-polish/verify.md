# Verify: Visual fidelity and polish · spec 0015 · updated 2026-11-14
_Steps derived from spec 0015 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Spec amended on 2026-11-14 (AC-5, AC-6, AC-11, AC-12, AC-13, AC-22) and 2026-11-15 (AC-6 wording and checkout header height, AC-9, AC-16 and its price comparison wording); the steps below follow the amended criteria. The earlier open points (art size, result count copy) are now part of the spec.

## UI / manual
- [x] Store, card with a discount → struck list price in muted grey and `-NN%` in lime green above a white extrabold price, no pink pill → AC-1, AC-2
- [x] Any product card → platform strip over the cover's bottom edge, name, region in mint uppercase, "From", price; hover and Tab show a 1px mint inset ring → AC-3
- [x] Home at 360px → Best sellers list cards show the same parts with an 80px cover → AC-4
- [x] 768px and 1440px, any shop page → one header row: wordmark, search, Store (icon and label), cart, account; no second row, no platform links in the header → AC-5
- [x] Visit `/store`, `/store?platform=steam`, `/store?q=x` → Store link yellow with `aria-current="page"`; `/` and a product page → not current → AC-5
- [x] 360px header → wordmark, then grid (Store), cart, account icons on one line, search full width below; each icon at least 44px → AC-6
- [x] In devtools, the header's height equals `--header-h` at 360px (121px) and at 768px+ (69px) → AC-6
- [x] On `/cart` and `/checkout`, the `CheckoutHeader` is 69px and `--header-h` resolves to `4.3125rem` at 360px and 1280px (rule `:root:has([data-header="checkout"])`); the sticky summary clears it with no extra gap → AC-6
  - Evidence (2026-11-15, Playwright, local dev): at 360px and 1280px, `/cart` and `/checkout` show `header[data-header="checkout"]` at 69px, `--header-h` = `4.3125rem` (69px), `scroll-padding-top` 77px. Route switches (cart → checkout by link, checkout → home by wordmark, store → cart by header link, back to store) flip the value both ways: shop routes go back to 121px / `7.5625rem` / 129px at 360px and stay 69px at 1280px. At 1280px, scrolled 1200px: summary `top` 85px, header bottom 69px, gap 16px (the specced `+1rem`) on both pages. 0 console errors or warnings.
- [x] Scroll down on cart (768px+) and the product page (1024px+) → summary and buy box stick just under the header, never under it → AC-6
- [x] Home at 1440px → under the hero, "Shop by platform" with All games, Steam, PlayStation, Xbox, Nintendo, generic icons; at 360px the row scrolls inside itself, page does not → AC-7
- [x] Home at 1440px → split hero, 22.5rem tall: featured (first banner) 2 parts, two stacked side tiles; while loading a matching split skeleton → AC-8
- [x] Featured slot → one link named by its visible text; art on the right, title, tagline, price, yellow CTA as text on the left; at 1024px and 1279px the tagline is hidden while title, price, discount, CTA and art stay; at 1280px and 1440px the tagline shows; block the image URL in devtools → text stays on a dark gradient → AC-9
- [x] Side tiles → title, price, yellow CTA pill on the left, 2:3 cover on the right, each one link → AC-10
- [x] Home at 360px → one featured banner only (first banner): wide art band on top, then a strip with title and price left and the yellow CTA right; no tagline, no carousel, no other banners → AC-11
- [x] Home at 768px → same banner, 16rem tall, art filling it, title, price, and CTA over the left gradient → AC-11
- [x] Home below 1024px, block the image URL → text and link stay (below 640px the art band disappears; from 640px the dark gradient stays) → AC-11
- [x] Home below 1024px while loading → compact skeleton of the same size; resize across 1024px → only one hero layout in the DOM at a time, split hero unchanged at 1024px+ → AC-8, AC-11
- [x] Run `php artisan db:seed --class=HomeSeeder` → Cyberpunk 2077 first, featured art from `images/banners/cyberpunk-2077-featured.webp`; with the file missing the seeder fails naming the path → AC-12
- [x] Featured art file → WebP, 2172 by 724 (3:1), at most 300 KB (249 KB), no text in the image, subject on the right → AC-12
- [x] Store at 1440px → Platform, Region, Price each in their own panel; toolbar with "N results" ("1 result" for one) left and the sort control right; 4 columns at 1280px+, 3 at 768px+, 2 below → AC-13
- [x] Sort control → yellow icon trigger read as "Sort by, <current>"; click opens a white list with a check on the current option; ArrowDown, Enter, Escape, Home, End, Tab, and an outside click behave as AC-13 says; focus never leaves the trigger; only one sort control in the DOM at 360px and 1440px → AC-13
- [x] Store below 1024px → Filters is a rounded pill on `surface-deep` with the count badge; dialog unchanged → AC-14
- [x] Product page at 1440px → breadcrumb Home › Store › name, cover beside the title, info rows, offers, About on the left; buy box in a 20rem right column that stays sticky while scrolling → AC-15
- [x] Product page at 360px → order is breadcrumb, cover and title, buy box, info rows, offers, About → AC-15
- [x] Buy box → "Best offer", price, "Sold by <seller>", Add to cart, "+N offers from €X"; click the link → page jumps to All offers, which lands just below the sticky header (no doubled gap) at 360px and desktop → AC-16
- [x] A product with only one in stock offer → no "+N offers" link; a product with no offers → only "Out of stock" → AC-16
- [x] Info rows → "Activate on <platform>", "<region> key", "Revealed on your order page right after payment", nothing else → AC-17
- [x] `/cart` → focused header: wordmark and stepper, step 1 current, no search, nav, cart, or account; skip link and footer still there → AC-18
- [x] `/checkout` → step 2 current; completed Cart step is a link back to `/cart`; at 360px only "Payment" shows its label → AC-18
- [x] Pay with 4242 4242 4242 4242 → order page opens with Cart and Payment checked, Done current, under the normal header; reload → no stepper → AC-19
- [x] Cart, checkout, and order rows → line totals use the shared price style; at 360px the remove button stays beside the price → AC-20
- [x] Login and orders list → same layout and copy as before, only token and price changes → AC-21
- [x] Tab through home, store, product, cart, checkout at 1440px and 360px → every new link reachable in visual order with the yellow focus ring → AC-23
- [x] Turn on reduce motion → no hero zoom, no transitions → AC-23

## Value sourcing
- [x] Featured art → change banner 1's `image_url` in the DB, reload → featured art changes → AC-9, AC-12
- [x] Hero text → edit a banner's `title`, `tagline`, `cta_label` in the DB → featured and tiles show the new text → AC-9, AC-10
- [x] Prices → change a product's best offer price → featured, tiles, cards, buy box all update → AC-2
- [x] Side tile art → comes from `product.cover_image_url`, not `image_url` (they differ once AC-12 lands) → AC-10
- [x] Compact banner art and text → the first banner's `image_url`, `title`, `cta_label`; change them in the DB, reload below 1024px → the compact banner follows → AC-11
- [x] Store result count → filter to a known count, matches `meta.total`, worded by `resultCountLabel` → AC-13
- [x] Sort options → Relevance appears only with a search; picking an option writes the same URL as before → AC-13
- [x] Filters pill count → tick 2 platforms and set a price bound → badge shows 3 → AC-14
- [x] Buy box seller → is the seller of the offer whose `id` equals `best_offer_id`, not simply the first row → AC-16
- [x] Sticky offsets → change the header height (zoom text to 200%) → summary and buy box still clear the header; if not, update `--header-h` → AC-6
- [x] Featured banner choice → reorder `banners.position` → the new first banner becomes featured → AC-8
- [x] Card strip and region → product with a different platform and region shows both → AC-3
- [x] Shortcut links → each slug filters the store to that seeded platform (no empty results) → AC-7
- [x] Store link current state → follows the path on back and forward navigation → AC-5
- [x] "+N offers" count → set one non best offer's stock to 0 → N drops by one → AC-16
- [x] "from €X" → lowest price among the counted offers (compared by `price.amount`), formatted like every other price → AC-16
- [x] Info rows → product on a different platform and region shows those names → AC-17
- [x] Stepper → `/cart` 1, `/checkout` 2 (from route handles); order page 3 only with `justPaid` → AC-18, AC-19
- [x] Featured art URL → built from `APP_URL` at seed time; on Render, `APP_URL` is the public API origin → AC-12 (local: seeding the isolated `eneba_verify` DB with `APP_URL=http://localhost:8011` gave `http://localhost:8011/images/banners/cyberpunk-2077-featured.webp`, 2026-11-14; Render: the developer confirmed in the Render dashboard that `APP_URL=https://eneba-api.onrender.com`, 2026-11-15, user confirmed, not read by the agent)

## Commands
- [x] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → all pass (413 tests on 2026-11-14, rerun after AC-12) → AC-22
- [x] `cd server && php artisan test` → all pass (460 tests on 2026-11-14, after AC-12) → AC-22
- [x] At 360 by 780, `document.documentElement.scrollWidth` on home, store, search, product, cart, checkout, confirmation, login, orders → each at most 360 (all 360 on 2026-11-14, rerun after AC-12) → AC-23
- [x] `git check-ignore docs/reference/desktop/hero.png docs/reference/mobile/cart.png docs/reference/current/<any file>` → all three ignored → AC-24

## Paired screenshots (AC-25)
Saved under `docs/reference/current/` at 1440 by 900 and 360 by 780 on 2026-11-14 (local app, reseeded banners; cart, checkout, confirmation, and orders as a throwaway local user after a real 4242 payment). The Result column is a first look during the build, not the verify verdict.

| Page | Reference (desktop / mobile) | Current 1440 | Current 360 | Result |
|---|---|---|---|---|
| Home | `desktop/homepage.png`, `desktop/hero.png`, `desktop/homepage_store_shortcuts.png` / `mobile/homepage.png` | `current/desktop-home.png` | `current/mobile-home.png` | desktop and 360 reviewed, close |
| Store | `desktop/store.png` / `mobile/store.png` | `current/desktop-store.png` | `current/mobile-store.png` | captured, review in /check verify |
| Search | `desktop/search.png` / `mobile/search.png` | `current/desktop-search.png` | `current/mobile-search.png` | captured, review in /check verify |
| Product | `desktop/product-card.png`, `desktop/product-card_active.png` / `mobile/product-card.png` | `current/desktop-product.png` | `current/mobile-product.png` | desktop reviewed, close |
| Cart | `desktop/cart.png` / `mobile/cart.png` | `current/desktop-cart.png` | `current/mobile-cart.png` | captured, review in /check verify |
| Checkout | `desktop/checkout.png` / `mobile/checkout.png` | `current/desktop-checkout.png` | `current/mobile-checkout.png` | 360 reviewed, close |
| Confirmation | none | `current/desktop-confirmation.png` | `current/mobile-confirmation.png` | desktop reviewed, stepper at step 3 |
| Login | `desktop/login.png` / `mobile/login.png` | `current/desktop-login.png` | `current/mobile-login.png` | captured, review in /check verify |
| Orders | `desktop/orders_history.png`, `desktop/order_history.png` / `mobile/orders_history.png`, `mobile/order_history.png` | `current/desktop-orders.png` | `current/mobile-orders.png` | captured, review in /check verify |

## Acceptance criteria coverage
- AC-1, AC-2: discount card step, `Price.test.tsx` · AC-3, AC-4: card steps, `ProductCard.test.tsx` · AC-5: header steps, `Header.test.tsx` · AC-6: header height and sticky steps · AC-7: shortcuts step, `HomePage.test.tsx`, `platformLinks.test.ts` · AC-8 to AC-11: hero steps, `HeroBanners.test.tsx`, `HomePage.test.tsx` · AC-12: seed and art file steps, `HomeSeedersTest.php` · AC-13, AC-14: store and sort steps, `SortSelect.test.tsx`, `StorePage.test.tsx` · AC-15 to AC-17: product steps, `BuyBox.test.tsx`, `productPageView.test.ts` · AC-18, AC-19: stepper steps, `Stepper.test.tsx`, `AppLayout.test.tsx`, `OrderConfirmationPage.test.tsx` · AC-20, AC-21: row and account steps · AC-22: commands · AC-23: 360 sweep and Tab steps · AC-24: check-ignore · AC-25: paired screenshots table
