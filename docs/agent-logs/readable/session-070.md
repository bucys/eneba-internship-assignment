# Session 070: (untitled) “/architect visual fidelity & polish”

- Session ID: `e094a54e-9e18-4042-8b7b-e80ac08a2f36`
- Source: `e094a54e-9e18-4042-8b7b-e80ac08a2f36.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-13 21:11 UTC → 2026-11-14 20:37 UTC
- Prompts: 1
- Full technical transcript: [full/session-070.md](../full/session-070.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-14 20:13 UTC · [open in full transcript](../full/session-070.md#prompt-1) · record `4ce4c1d9-92da-440a-9898-a66643343dfa`</sub>

/architect visual fidelity & polish

All reference screenshots are stored locally in:
- docs/reference/desktop/
- docs/reference/mobile/

Our custom-generated homepage hero image is:
- docs/reference/desktop/main_hero.png

Before writing the spec:

1. Inventory all reference screenshots and map them to the existing application pages.

2. Audit the current UI against the references across desktop and mobile. Identify gaps in layout, navigation, typography, spacing, colors, product cards, responsive behavior, and interaction states.

3. Identify shared design patterns and propose a consistent visual system across all pages.

4. Evaluate the homepage hero separately:
   - Compare the current six-card hero with the Eneba reference and our generated main_hero.png.
   - Assess whether to use the generated image as-is, crop or split it into separate assets, or use another layout.
   - Consider image quality, responsive behavior, mobile cropping, performance, and accessibility.
   - The CTA button should be implemented as a real React element, not baked into the image.
   - Avoid duplicating text already embedded in the image.
   - Preserve existing product links and functionality.
   - Recommend the best approach rather than assuming the generated image must be used.

5. Prioritize changes by visual impact, implementation effort, and regression risk.

6. Propose bounded acceptance criteria and an implementation plan that can be verified at desktop and 360px mobile widths.

Constraints:
- Preserve existing functionality, API contracts, and user journeys.
- Keep all reference images local and gitignored.
- Do not implement changes yet.
- Present the audit findings, hero recommendation, design decisions, and acceptance criteria for my approval before finalizing the spec.

## CLAUDE · 1

*[5 tool calls: Skill, Bash ×4]*

I'm going through the reference screenshots now. Next I'll capture the current UI so I can compare the two.

*[18 tool calls: Read ×16, Bash ×2]*

I've reviewed the homepage, product, store and cart references. Next come checkout, login, account and the mobile references, then screenshots of the current app.

*[8 tool calls: Read ×8]*

I have a good picture of the references now. Next I'll capture the current app at 1440px and 360px.

*[8 tool calls: Bash ×2, ToolSearch, mcp__playwright__browser_run_code_unsafe, Read ×4]*

The current UI is captured. Now I'll read the hero, card and token code so the audit is based on facts.

*[9 tool calls: Bash ×4, mcp__playwright__browser_run_code_unsafe, Read ×4]*

Audit done. Below are my findings, then the decisions I need from you before I write the spec.

**Framing:** I'm treating this as an **ENHANCEMENT** of the existing React client. It's client only: no API, schema or route changes, with the Journey build approach. The spec will go in `docs/specs/0015-visual-fidelity-polish/`.

## 1. Reference inventory → app pages

| Reference | App page | Notes |
|---|---|---|
| `hero`, `homepage`, `homepage_store_shortcuts`, `main_hero` | `/` | desktop + mobile |
| `store`, `search` | `/store`, `/store?q=` | desktop + mobile |
| `product-card` (full product page), `product-card_active` (hover/wishlist state) | `/products/:slug`, card component | desktop + mobile |
| `cart`, `checkout` | `/cart`, `/checkout` | desktop + mobile |
| `login` | `/login`, `/register` | desktop + mobile |
| `orders_history`, `order_history` | `/orders`, `/orders/:ulid` | light themed account area |
| `my_account` | none | out of scope (no account page) |

The order screenshots show your real email, so they must stay local. They're already gitignored.

## 2. Audit: biggest gaps

- **Header:** ours is a single row (text wordmark, search, Store, cart, Sign in). Eneba has a second nav row and a cart badge. Its mobile header is icon only.
- **Product card:** this is the most repeated element and the biggest gap. Eneba puts a platform strip on the bottom of the cover art and shows the region in coloured capitals. Its price is **large and white**, with the discount as green text. Cards have a thin teal border on hover. Ours shows a mint price with a pink pill and has no hover border.
- **Store:** Eneba wraps each filter group in its own panel and shows a "Results found: N" line plus a sort control with an icon. It uses 4 columns, and on mobile the filters sit behind a "Sort and filter" pill. Ours has bare checkbox lists, a labelled select and 5 columns.
- **Product page:** Eneba uses a breadcrumb, a cover plus a title and info bullets, and a sticky **right side buy box** with "+N offers from €X". Ours stacks everything in one column, and the buy box floats mid page.
- **Cart and checkout:** Eneba hides the main nav and uses a focused header with a 3 step stepper (Cart → Payment → Get your product). Ours uses the full shop header.
- **Homepage:** Eneba has a row of store shortcut icons under the hero that we don't have. Our section bands, rails and mobile list cards already match closely.
- **Auth and orders:** layouts are already close. Copy and spacing tweaks only.

## 3. Proposed shared visual system

- Keep the current tokens and Metropolis font. Add only what the gaps need: a card hover border colour and a price style.
- Use one card component everywhere (store grid, home rails, mobile list rows). It gets new parts: a platform strip, a region label and a hover/focus border.
- Use one panel style for the filter groups, cart summary and buy box.
- Keep our text wordmark. Copying Eneba's logo mark would impersonate the brand.

## 4. Hero recommendation: don't ship `main_hero.png`

- **Baked text for a product we don't sell:** the image says "Grand Theft Auto VI", but the catalog only has GTA V.
- **A tile with nowhere to go:** the "Gift Cards" tile has no truthful destination, because the catalog has no gift cards.
- **Unreadable on mobile:** at 360px the 3:1 image is about 120px tall, so the baked text shrinks to roughly 8px. Cropping for mobile would cut off the two side cards.
- **Accessibility:** baked text can't reflow, and you can't translate it.
- **Quality and weight:** it's 2172px wide, so it looks soft on retina screens at 1440px. The PNG is 2 MB.

**Recommended instead:** a **split featured hero** built from the existing `/home/banners` data, with no API change.
- **Desktop:** banner 1 becomes one wide featured slot, with real React title, tagline, live price and CTA over a darkened, blurred cover backdrop. Banners 2 and 3 sit as two stacked tiles beside it. This matches the composition of both Eneba's hero and your image.
- **Mobile:** keep the portrait rail, which already matches Eneba mobile.

All banner links stay as they are.

## 5. Priorities (impact vs effort vs risk)

1. Product card: high impact, medium effort, low risk (visual only, tests assert roles and text)
2. Header nav row and shortcut row: high impact, low effort
3. Featured hero: high impact, medium effort
4. Store filter panels and toolbar: medium impact, low effort
5. Product page two column layout with sticky buy box: medium impact, medium effort
6. Checkout stepper header: medium impact, low effort
7. Auth and orders spacing: low impact, low effort

Separate from this work: the uncommitted change in `ScrollRail.tsx` swaps a valid class for `[scrollbar-none]`, which isn't a valid Tailwind arbitrary property. The scrollbar will probably show again.

The dev servers are still running from the audit.

**Claude asked — Hero** (select one):

> Homepage hero: which approach should the spec use? (The generated main_hero.png bakes in 'Grand Theft Auto VI' and 'Gift Cards', but the catalog has neither, and its text becomes unreadable at 360px.)
> - **Split featured hero (recommended)** — Desktop: one wide featured slot from banner 1 plus 2 stacked tiles, with React text, live price and CTA over cover art. Mobile keeps the portrait rail. No new assets, no API change.
> - **Split hero + text free art** — Same layout, but you supply a regenerated image with no baked text, for a product that is in the catalog. The banner seed points image_url at it.
> - **Use main_hero.png as is** — One image with a React CTA on top. Not recommended: the text is baked in, the tiles link nowhere truthful, and it fails on mobile.
> - **Keep current 6 tile strip** — Polish spacing and type only. Lowest risk, least visual gain.

**USER answered:**

Split hero + text free art

**Claude asked — Price style** (select one):

> Price styling: should we match Eneba (large white price, green '-48%' text, muted strikethrough) instead of the current mint price with a pink pill?
> - **Match Eneba (recommended)** — White bold price and green discount text, applied everywhere through the Price component. Changes a spec 0003 token decision, so the contrast table gets updated.
> - **Keep current colours** — Mint price and pink pill. Only spacing and size change.

**USER answered:**

Match Eneba (recommended)

**Claude asked — Card** (select one):

> Product card: how close should it get to the Eneba card?
> - **Visual parity, no new actions (recommended)** — Platform strip on the art, coloured region capitals, white price, teal hover/focus border. The whole card stays one link, so behaviour doesn't change.
> - **Add 'View offers' button** — An explicit secondary button that links to the product page. A small layout change, no new behaviour.
> - **Add 'Add to cart' on cards** — New functionality: picks the cheapest offer from the card. Needs an offer id the card API doesn't return today, so it's a scope and API change.

**USER answered:**

Visual parity, no new actions (recommended)

**Claude asked — Nav** (select one):

> Header and navigation: what goes in the new rows? (Only real links, no fake categories.)
> - **Platform nav + shortcuts (recommended)** — Desktop second row: Store, Steam, PlayStation, Xbox, Nintendo, linking to existing /store filters. The same set appears as a homepage icon shortcut row. Mobile header goes icon only.
> - **Shortcut row only** — Homepage icon row only. Header unchanged.
> - **No navigation changes** — Polish the existing header spacing only.

**USER answered:**

Platform nav + shortcuts (recommended)

Noted. I'll use the split hero with text free generated art, the Eneba price style, visual parity cards, and the platform nav plus shortcuts.

**Claude asked — Featured** (select one):

> Which catalog product should the featured hero slot (banner 1) promote? Your text free art must depict that product, because the slot's title, price and CTA come live from it.
> - **Grand Theft Auto V (recommended)** — Closest to the style of your existing main_hero.png. Regenerate it as GTA V themed (it's in the catalog), with no text and no GTA VI branding.
> - **Elden Ring: Shadow of the Erdtree** — Current banner 1, so no reordering in the seed. Needs entirely new art.
> - **Cyberpunk 2077** — Neon look that suits the purple palette. Needs new art.

**USER answered:**

Cyberpunk 2077

**Claude asked — Asset host** (select one):

> Where should the featured art file live? Banners already return an absolute image_url, so the API shape stays the same either way.
> - **server/public, seeded URL (recommended)** — Commit a WebP to server/public/images/banners/. home.php gets an optional image override, and the seeder builds an absolute URL from APP_URL. The backend keeps owning content (spec 0014).
> - **client/public on Vercel** — Vercel's CDN is faster, but the seed would need the client origin, which couples the server to the frontend URL.

**USER answered:**

server/public, seeded URL (recommended)

**Claude asked — Pages** (select any):

> Which pages are in this spec? (Shared work, meaning the shell, tokens and product card, is always in.)
> - **Homepage (hero + shortcuts)** — Recommended. Split hero and icon shortcut row.
> - **Store and search** — Recommended. Filter panels, results toolbar, 4 columns, mobile 'Sort and filter' pill (the existing FiltersDialog).
> - **Product page** — Recommended. Breadcrumb, info bullets, sticky right side buy box with '+N offers from €X' (data already in the offers response).
> - **Cart, checkout, auth, orders** — Recommended. Checkout stepper header on cart and checkout, plus spacing polish on auth and orders.

**USER answered:**

Homepage (hero + shortcuts), Store and search, Product page, Cart, checkout, auth, orders

**Claude asked — Verify** (select one):

> How should fidelity be verified? (No pixel matching. Close, not pixel perfect, per the scope row.)
> - **Paired screenshots in verify.md (recommended)** — Playwright MCP screenshots at 1440 and 360 for each page, kept local next to the reference, plus a per AC checklist. No new dependencies; existing Vitest and CI unchanged.
> - **Add Playwright visual tests to CI** — Snapshot baselines in the repo. A new dev dependency and CI job; flaky with live data.

**USER answered:**

Paired screenshots in verify.md (recommended)

**Claude asked — Banners 4+** (select one):

> There are 8 seeded banners. On desktop, the split hero shows the featured slot plus 2 side tiles, so 3 in total. What happens to banners 4 to 8 on desktop?
> - **Desktop shows 3; mobile rail shows all (recommended)** — Matches both Eneba and your image (one big slot, two tiles). Mobile keeps the full swipeable rail, so nothing is lost there.
> - **Side tiles become a scrolling rail** — Featured slot fixed, with banners 2 to 8 scrolling beside it in a narrow vertical or horizontal rail. More reach, busier.
> - **Reseed to exactly 3 banners** — Desktop and mobile show the same 3. Shrinks the mobile rail.

**USER answered:**

Desktop shows 3; mobile rail shows all (recommended)

**Claude asked — Stepper** (select one):

> Cart and checkout: should they use the focused Eneba header (wordmark plus a 3 step stepper: Cart → Payment → Done, with no search or nav)?
> - **Cart, checkout and confirmation (recommended)** — Step 1 on /cart, 2 on /checkout, 3 on /orders/:ulid right after purchase only. The wordmark still links home, and the full footer stays.
> - **Checkout only** — Cart keeps the full shop header, so search stays reachable from the cart.
> - **No stepper** — Keep the shop header everywhere.

**USER answered:**

Cart, checkout and confirmation (recommended)

**Claude asked — References** (select one):

> Add a References section to the spec? The full reasoning stays either way.
> - **No references, keep it clean (recommended)** — Rationale only.
> - **Sources only** — Names the reference screenshots and the project specs, with no web fetch.

**USER answered:**

No references, keep it clean (recommended)

Decisions are settled. I'll check a few code facts the spec depends on before writing it.

*[6 tool calls: Bash ×5, Read]*

I'm writing the spec now: `index.md` (the build contract) and `rationale.md` (the audit evidence and hero evaluation).

*[6 tool calls: Bash ×3, Write ×2, Edit]*

The draft spec is written. One quick choice before you review it.

**Claude asked — Cross check** (select one):

> Cross check this spec before you review it? (Recommended: Another model. The feature is Alpha tier, but it touches the seed data and the header layout every page uses, so a fresh read is cheap insurance.)
> - **Another model (recommended)** — A read only critique on a different model that looks for values with no named source and decisions the builder would have to invent.
> - **Same model** — A read only critique on this same model, with fresh eyes on its own work.
> - **I'll review it myself** — No AI critique. You read the spec.
> - **Skip** — Go straight to accept or change.

**USER answered:**

Another model (recommended)

*[1 tool call: Agent · 1 subagent]*

A second model is now checking the draft spec. I'll share what it finds, then ask you to accept or change the spec.

The draft is at [docs/specs/0015-visual-fidelity-polish/index.md](docs/specs/0015-visual-fidelity-polish/index.md). The audit evidence is in [rationale.md](docs/specs/0015-visual-fidelity-polish/rationale.md).

_⚙ Automated `peer` message (not written by the developer; content is in the full transcript)._

## CLAUDE · 1 (continued)

The cross check is done. It found no problem with the design itself, but it did find about 25 gaps where the spec leaves the builder to guess. I've grouped them below, each with the fix I recommend.

**Claims in the spec that the code contradicts**
- **Header tests:** there is no `Header.test.tsx`, and the Header's existing `<nav aria-label="Primary">` holds only Store. **Fix:** move that nav into row 2, show the mobile Store icon outside it, hide row 2 with CSS (`hidden md:flex`), and drop "header test edits" from AC-22.
- **"Just paid" signal (AC-19):** the confirmation page already reads it, but its arrival helper (`useArrival`) doesn't expose it. **Fix:** return `justPaid` from `useArrival`, and render the stepper in the loaded state only.
- **Seeder test:** `HomeSeedersTest.php:52` asserts `image_url` equals the cover for all 8 banners. **Fix:** assert that for the other 7, and `url(...)` for Cyberpunk.
- **Cover fallback (AC-11):** `cover_image_url` is non-null in the client type, so the fallback can never run. **Fix:** drop it. Portrait tiles move to a 2:3 frame to fit the covers.
- **Missing anchor (AC-16):** the offers section has no `id="offers"` yet. **Fix:** add the id plus a scroll margin so the sticky header doesn't cover it.
- **Price colour in three more files:** `text-price` is also used in `CartLineRow`, `CheckoutLineRow` and `OrderItemRow`. **Fix:** swap those spans to `<Price>`, and add the three files to the build plan.

**Values or decisions the spec never names**
- **Price layout:** list price at `text-xs`/`text-sm`, `-NN%` as plain `saving` text with no pill, and Price becomes a column (`flex-col`).
- **Region text:** uppercase through CSS, so tests still see the original case.
- **Sticky offsets:** add one `--header-h` CSS variable, used by the buy box, `scroll-mt` and the existing `md:top-24` summaries.
- **Nav current state:** a platform link is current when exactly one `platform` value is set and it matches. Store is current only on `/store` with no single platform set. This needs `useSearchParams`, because `NavLink` ignores the query string.
- **"Results found: N":** comes from `meta.total`. Keep a single sort select in the DOM and move it with CSS.
- **"Filters (N)":** counts selected values, using the existing `activeFilterCount`. Check the store test that finds that button by name.
- **Icons:**
  - Store: `LayoutGrid`.
  - Shortcuts: All games `Gamepad2`, Steam `Monitor`, PlayStation `Gamepad`, Xbox `Joystick`, Nintendo `Puzzle`.
  - The shortcut row is a plain `overflow-x-auto` list, not `ScrollRail`.
- **Split hero edge states:**
  - With 2 banners, the tile spans both rows.
  - Featured text gets a width limit and steps from `text-3xl` at `lg` to `text-4xl` at `xl`.
  - A desktop skeleton block is added so the page doesn't jump while banners load.
  - React's attribute is `fetchPriority`.
  - First paint still waits on the banners API call. That's accepted and noted.
- **Buy box, out of stock (`best_offer_id` null):** show "Out of stock" and hide "Sold by" and "+N offers". The seller comes from `offers.find(id === best_offer_id)`.
- **Info rows:** shown for all product types. The catalog only has games and DLC.
- **Checkout header:**
  - A separate `CheckoutHeader`, chosen in `AppLayout` with `useMatches()`.
  - Router handles: `checkoutStep: 1` on `/cart`, `2` on `/checkout`.
  - It also shows in error states.
  - The completed Cart step is a link back to `/cart`, and completed steps get screen reader text ("completed").
- **Art asset:** keep the seeder's hard failure, but reorder the build so the split hero ships first using current data. The seeder change waits for your WebP.
- **AC-23:** remove the "hover zoom" wording. Breadcrumb links and "+N offers" also get `min-h-11` (44px).
- **Contrast table:** add `cta` on `surface` (nav current link) and `fg-muted` on `surface` (struck price).
- **verify.md:** goes in the spec folder. Cart rows are checked at 360px, since the taller Price block could crowd the row controls.

Already fine: `docs/reference/desktop/` and `mobile/` are already gitignored, and `HomeSeeder` runs on its own.

**Claude asked — Gaps** (select one):

> The cross check found ~25 gaps (spec claims that don't match the code, plus unnamed values like sticky offsets, nav current state, icons, and the out of stock buy box). How should I handle them?
> - **Apply recommended fixes (recommended)** — Edit the spec with each fix listed above, then show you the final acceptance criteria to accept or change.
> - **Let me answer each one** — Go through the gaps one by one with a recommended pick each.
> - **Leave them for now** — Keep the draft as is. /develop will stop and ask when it hits them.

**USER answered:**

Apply recommended fixes (recommended)

Applying the fixes. First I'll confirm two names the fixes depend on.

*[10 tool calls: Bash, Edit ×9]*

Now the build plan, value sourcing and follow-up, to match the fixes.

*[6 tool calls: Edit ×6]*

I've applied all the cross check fixes to the spec.

Draft spec: [docs/specs/0015-visual-fidelity-polish/index.md](docs/specs/0015-visual-fidelity-polish/index.md)

**Decision:** polish the existing parts in place, and replace the desktop hero with a split layout fed by the existing banners endpoint. The featured slot uses a new text free Cyberpunk 2077 image.

**Main tradeoff:** desktop shows only 3 of the 8 banners, and the spec now depends on one committed image file plus a correct `APP_URL` in production. `APP_URL` is the server's own public address, which the seeder uses to build the image link.

**Cross check:** a different model found about 25 gaps. Most were values the spec never named; a few were claims the code contradicts. All are fixed.

**Acceptance criteria (25 in total):**
- **AC-1 to AC-4, shared system:** tokens `accent` and `saving`, with a contrast row for every new pair. Price becomes a white price with the struck list price and `-NN%` on the line above. Cards get a platform strip, an uppercase region and an accent ring on hover and focus.
- **AC-5 to AC-7, navigation:**
  - A second header row with Store and the four platform links.
  - Rules for when each link shows as current.
  - An icon only header on mobile.
  - One `--header-h` variable for every sticky offset.
  - A "Shop by platform" icon row on the homepage.
- **AC-8 to AC-12, hero:**
  - A desktop split of the featured slot plus 2 tiles, with a matching loading skeleton.
  - An image load error keeps the text readable.
  - Defined layouts for 0, 1 and 2 banners.
  - The mobile rail keeps all banners, now using cover art.
  - A seeder change that moves Cyberpunk to the top and fails clearly if the image file is missing.
- **AC-13 to AC-17, store and product page:**
  - Filter panels, a "Results found" count and a single sort select.
  - A 4 column grid at the widest breakpoint (`xl`).
  - A two column product page with a breadcrumb and a sticky buy box.
  - "+N offers from €X" in the buy box, with an out of stock state.
  - Info rows built only from real data.
- **AC-18 to AC-21, purchase journey and account:**
  - A checkout header with a 3 step stepper on cart and checkout. On checkout, the Cart step links back to the cart.
  - The stepper also shows on the confirmation page right after payment.
  - The `<Price>` component in the cart, checkout and order rows.
  - Auth and orders change only through the shared styles.
- **AC-22 to AC-25, guards:**
  - No changes to behaviour or the API.
  - At 360px: no sideways scroll, a working keyboard order and touch targets of at least 44px.
  - Reference images stay gitignored.
  - `verify.md` gets paired screenshots at 1440px and 360px.

The build is ordered by journey. The hero layout ships before the image arrives, so the build only pauses at step 7 if you haven't added the WebP yet.

**Claude asked — spec** (select one):

> Accept spec 0015 (visual fidelity & polish), or change it?
> - **Accept, looks solid (recommended)** — The spec stays Proposed. I link it on scope feature 16 with build milestones and a Verify box (Alpha tier).
> - **Change something** — Tell me which part to change, and I'll make targeted edits.
> - **Rethink the approach** — Go back to the hero or scope decisions.

**USER answered:**

Accept, looks solid (recommended)

Accepted. Now I'll link the spec on scope feature 16.

*[3 tool calls: Bash, Edit ×2]*

Spec 0015 is written and accepted. Its status stays Proposed until `/develop` builds it.

**What we decided:** we'll polish the existing pages in place to look like Eneba, with no change to behaviour or the API. The biggest change is a desktop hero with one wide featured slot plus two side tiles. Phones keep the swipeable rail. All hero text, prices and buttons are real React elements.

**Why not your generated image as it is:** `main_hero.png` advertises GTA VI and gift cards, which the catalog doesn't sell. Its baked in text would also shrink to about 8px at 360px. A text free Cyberpunk 2077 image, seeded into the existing banner `image_url`, gets the look without either problem.

**Scope:** feature 16 is now in progress, linked to the spec, with four build milestones and a Verify box.

**What I need from you:**
- **The image:** `server/public/images/banners/cyberpunk-2077-featured.webp`, text free, 3:1, at least 2400 by 800px, subject on the right, at most 300 KB. The build can run up to that step without it.
- **`ScrollRail.tsx`:** your uncommitted change uses `[scrollbar-none]`, which isn't a valid Tailwind class. Please fix or revert it before the build starts (step 0).

**Next:** run `/clear`, then `/develop visual fidelity & polish`.

The dev servers I started for the audit are still running on ports 5173 and 8000.
