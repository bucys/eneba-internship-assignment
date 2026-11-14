# 0015. Rationale: visual fidelity and polish

## Context

Every user journey works end to end (features 1 to 15), but the client still looks like a generic purple storefront rather than Eneba. The brief asks for recognizable Eneba styling, and scope feature 16 asks for close visual fidelity against the local screenshots in `docs/reference/desktop/` and `docs/reference/mobile/`, not pixel perfection.

The forces: the work must not change routes, loaders, API shapes, or tests' intent (scope feature 16 "Done when"); every colour pair must keep passing WCAG AA (spec 0003); the homepage content must stay backend driven (spec 0014); and the catalog only holds 34 games and DLC across four platforms, so any Eneba element that implies gift cards, wallets, refunds, cashback, or reviews would be a fake feature. The reference screenshots include a real account email in the order pages, so they must never be committed.

A custom generated hero image (`docs/reference/desktop/main_hero.png`, 2172 by 724, 2 MB PNG) exists, and the developer wanted it evaluated rather than assumed.

## Options considered

### Option 1: Split featured hero from existing cover art, plus shared polish

Same shared polish as the chosen option. The desktop featured slot reuses the product cover as a darkened, blurred backdrop with a crisp portrait cover beside the text.

**Pros**:
- No new asset, no seed change, nothing to regenerate later.

**Cons**:
- Portrait covers stretched into a wide slot look improvised next to Eneba's purpose made key art.

### Option 2: Split featured hero with text free generated art, plus shared polish (chosen)

As option 1, but banner 1's `image_url` points to a purpose made, text free 3:1 image committed in `server/public/`.

**Pros**:
- The featured slot looks like Eneba's hero with real key art, while all text stays DOM text.
- No API change: `image_url` already exists; only seed data changes.

**Cons**:
- A committed binary that someone must regenerate if the featured product changes.
- Depends on `APP_URL` being right at seed time.

### Option 3: Use `main_hero.png` as is with a React CTA on top

**Pros**:
- Fastest to ship and closest to the generated mockup.

**Cons**:
- Bakes "Grand Theft Auto VI" (not in the catalog; only GTA V is) and "Gift Cards" (no gift card products) into the image, so the tiles cannot link anywhere truthful.
- At 360px the 3:1 image is about 120px tall and the baked text is about 8px; cropping for mobile cuts off the side cards.
- Baked text cannot reflow, be translated, or be read by assistive technology except through a long `alt`.
- 2172px wide is soft on 2x screens at 1440; the 2 MB PNG would dominate first load.

### Option 4: Keep the six tile strip, polish only

**Pros**:
- Lowest risk; spec 0014 AC-10 stays untouched.

**Cons**:
- The biggest visual gap on the first screen stays open; Eneba's desktop hero has one dominant featured slot.

## Rationale

The hero is the first thing a reviewer sees, so leaving it (option 4) wastes the highest impact change. Option 3 fails three hard constraints at once: it advertises products the catalog does not sell, it breaks at 360px, and it hides text inside pixels. Options 1 and 2 share the same layout and data flow; option 2 only swaps the art source through the existing `image_url` field, so it buys the closest look for a one row seed change and one committed file. The developer chose Cyberpunk 2077 as the featured product because its neon look suits the purple palette and it is in the catalog.

For everything else, polishing in place beats any rewrite: the shared `Price` and `ProductCard` appear on every page, so two component changes close most of the gap. The audit showed the remaining gaps are layout and chrome (header rows, filter panels, buy box column, checkout header), none of which needs new data. The price colour change reverses one spec 0003 choice deliberately: Eneba shows a large white price and a green discount, and the new `saving` token passes AA on every surface (lowest 5.2:1 on `panel`).

The cards stay one link with no Add to cart or View offers button, because cards do not carry an offer id and adding one would be an API and scope change. The focused checkout header follows the references and lowers distraction during payment; on the confirmation page the stepper lives in the page, not the header, because the "just paid" signal is page state that the layout cannot see once the page clears it.

## Amendments (2026-11-14, after the build)

The developer approved these changes after reviewing the built pages. The spec now matches the shipped code.

- **AC-5 and AC-6, single row header from `md`.** The planned second row of platform links repeated the homepage shortcuts (AC-7) and the store Platform filter, and made the sticky header about 44px taller on every page. One row keeps Eneba's logo, search, cart, and account rhythm with less chrome. The phone header keeps search on its own line because a 360px row cannot fit a usable field next to three icons. `--header-h` keeps one value per layout, and both values change together with the header.
- **AC-11, one compact featured banner below `lg`.** The portrait rail of every banner competed with the product rails below it and did not use the purpose made art. Reusing the first banner and its wide art keeps desktop and mobile telling the same story, adds no asset, and avoids a carousel (motion, controls, and focus management for little gain). Below `sm` the text sits under the art, because over a 2:1 crop it would cover the subject; from `sm` there is room for the desktop style overlay. The tagline is dropped to keep the banner short on phones.
- **AC-9 amendment (2026-11-15), tagline only from `xl`.** From 1024px to 1279px the featured slot is narrow, so `object-right` crops the art and moves the subject left; the tagline then ran over the subject's hair, where its contrast is not guaranteed. Hiding it below `xl` keeps the title, price, discount, CTA, art, and gradient unchanged and matches the compact banner, which already drops the tagline. Rejected: a stronger gradient, which would darken the art at every width.
- **AC-6 amendment (2026-11-15), checkout header height.** Cart and checkout render `CheckoutHeader`, a single 69px row at every width. Without an override, phones would keep the two row shop value (121px), so the sticky summaries and scroll padding would sit about 52px too low. The rule `:root:has([data-header="checkout"])` sets `--header-h` to `4.3125rem` while that header is in the page, so one variable still drives every offset. Rejected: a second variable for the checkout layout, which every sticky consumer would have to choose between.
- **AC-16 wording fix (2026-11-15), price comparison.** The criterion said the lowest price was compared with the `lib/money` helpers, but `lib/money` only formats (`formatPrice`). The code compares the integer cent `price.amount` values directly, which is exact because money is never a float. Behaviour is unchanged; only the wording was corrected.
- **AC-16 amendment (2026-11-15), no `scroll-mt` on `#offers`.** Scroll margin on the target adds to the `html` `scroll-padding-top`, so the jump left about two header heights of empty space above All offers. The page level padding alone already clears the sticky header (measured: the section lands 8px below it at 360px and 1280px).
- **AC-12, art size.** The supplied art is 2172 by 724 (true 3:1) and 249 KB. At the 22.5rem desktop hero it is at least 1x on a 1440 screen and only slightly soft at 2x; regenerating it larger would cost a new asset for a small gain. The developer accepted it as the minimum for this asset; the other rules (text free, 3:1, WebP, at most 300 KB, subject on the right) still hold.
- **AC-13, result count copy.** An existing store test asserts "1 result" at desktop width, and AC-22 forbids changing test intent. Keeping `resultCountLabel` ("1 result" / "N results") keeps one copy source for the page, the dialog button, and the tests.
- **AC-13, custom sort control.** The native `<select>` could not match Eneba's yellow icon trigger and white option list across browsers. The built `SortSelect` follows the WAI-ARIA APG select only combobox pattern, keeps the same option values and URL behaviour, and is covered by its own tests and `design.md` contrast rows. Store tests that used `selectOptions` now click the option; their assertions are unchanged, which AC-22 now allows.

## Evidence: reference inventory

| Reference file | App page | Viewports |
|---|---|---|
| `hero.png`, `homepage.png`, `homepage_store_shortcuts.png` | `/` | desktop; `homepage.png` also mobile |
| `main_hero.png` | `/` hero (generated mockup, not an Eneba capture) | desktop |
| `store.png` | `/store` | desktop, mobile |
| `search.png` | `/store?q=` | desktop, mobile |
| `product-card.png` (a full product page) | `/products/:slug` | desktop, mobile |
| `product-card_active.png` (card hover and wishlist states) | `ProductCard` | desktop |
| `cart.png` | `/cart` | desktop, mobile |
| `checkout.png` | `/checkout` | desktop, mobile |
| `login.png` | `/login`, `/register` | desktop, mobile |
| `orders_history.png` | `/orders` | desktop, mobile |
| `order_history.png` | `/orders/:ulid` | desktop, mobile |
| `my_account.png` | none (no account page; out of scope) | desktop, mobile |

## Evidence: audit (current UI at 1440 and 360 against the references)

| Area | Eneba reference | Current app | Gap | Covered by |
|---|---|---|---|---|
| Header | Logo, search, cart badge, account; second row of category links; mobile icon only row | One row: wordmark, search, Store text, cart, Sign in; mobile Store text link | Missing nav row (later dropped in favour of one row, see Amendments); mobile mixes text and icons | AC-5, AC-6 |
| Homepage hero | One wide featured banner with a real button, three portrait tiles; mobile four portrait tiles | Six equal portrait tiles with text overlays, full bleed | No dominant featured slot | AC-8 to AC-12 |
| Store shortcuts | Icon row (Games, Steam, PSN, Xbox and more) under the hero | None | Missing | AC-7 |
| Price | Large white price; struck list price and green `-NN%` above it | Mint price, pink struck price, pink pill | Colour and order differ | AC-1, AC-2 |
| Product card | Platform strip on cover, region in coloured capitals, teal border on hover | Platform and region as one muted line; mint ring on hover | Hierarchy and strip missing | AC-3, AC-4 |
| Store | Each filter group in its own panel; "Results found" plus icon sort; 4 columns; mobile "Sort and filter" pill | Bare checkbox lists; labelled native select; 5 columns at `xl`; mobile outline button | Panel, toolbar, and sort control structure | AC-13, AC-14 |
| Product page | Breadcrumb; cover with title and info rows; sticky right buy box with "+N offers from"; offers list | Single column; buy box under the title | Layout and buy box | AC-15 to AC-17 |
| Cart and checkout | Focused header with three step stepper; panels | Full shop header | Header | AC-18 to AC-20 |
| Auth | Large greeting, single card | Similar layout | Minor | AC-21 |
| Orders | Light themed account area with sidebar | Dark themed list | Theme differs on purpose | AC-21 (kept dark) |
| Elements not adopted | Wishlist hearts, cashback badges, PayPal buttons, ratings, reviews, payment logos | n/a | These would be fake features | Out of scope |

## Evidence: priority order

| Change | Visual impact | Effort | Regression risk |
|---|---|---|---|
| Price and product card | High (every page) | Medium | Low (tests assert roles and text, not classes) |
| Header nav row and shortcut row | High | Low | Low to medium (header tests) |
| Split featured hero | High | Medium | Medium (seed order, spec 0014 tests) |
| Store panels and toolbar | Medium | Low | Low |
| Product page layout and buy box | Medium | Medium | Low |
| Checkout stepper header | Medium | Low | Low to medium (layout routing) |
| Auth and orders pass | Low | Low | Low |
