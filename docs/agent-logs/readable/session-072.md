# Session 072: Store results toolbar

- Session ID: `a11cf648-ea5b-4d39-8498-d26baf09ef47`
- Source: `a11cf648-ea5b-4d39-8498-d26baf09ef47.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-14 20:58 UTC → 2026-11-14 21:36 UTC
- Prompts: 6
- Full technical transcript: [full/session-072.md](../full/session-072.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-14 20:58 UTC · [open in full transcript](../full/session-072.md#prompt-1) · record `c64d918e-77f1-476d-9531-faed21503e94`</sub>

`/develop`

visual fidelity & polish

## CLAUDE · 1

I'll start with the freshness check and the scope entry for this feature.

*[3 tool calls: Bash ×3]*

The art file is there now, but it is 383 KB (the spec caps it at 300 KB). The server side of step 7 isn't built yet. Next I'll run the client checks to see how solid the existing client work is.

*[4 tool calls: Bash ×4]*

Now the seeder. I'm splitting `run()` so the tests can pass in their own data for the missing file case.

*[1 tool call: Bash]*

Server step 7 passes (13 tests, Pint, PHPStan). Now I'll check the existing client work against the spec's specific requirements, since only milestone 1 was ticked.

*[2 tool calls: Bash ×2]*

**Claude asked — Hero art** (select one):

> The featured art (server/public/images/banners/cyberpunk-2077-featured.webp) is 2172×724 and 383 KB. Spec 0015 AC-12 asks for at least 2400×800 and at most 300 KB. How should I handle it?
> - **Re-encode, accept size (Recommended)** — I re-encode the same image with cwebp to fit under 300 KB and keep 2172×724. Still 3:1 and sharp at 1440px wide (the slot is about 900px wide). verify.md notes the size gap against AC-12.
> - **I'll supply a bigger one** — You export a new file at 2400×800 or larger, under 300 KB. I keep building the rest and pause the asset commit until it's in place.
> - **Keep file as is** — Use it unchanged. verify.md marks AC-12 as failing on both size and weight.

**USER answered:**

Re-encode, accept size (Recommended)

*[4 tool calls: Bash ×4]*

Everything passes (460 Pest tests, the client build). Both dev servers are already running. Next I'll reseed the local home banners and open the app in the browser.

*[10 tool calls: Bash ×3, ToolSearch ×2, mcp__playwright__browser_resize, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, Read, mcp__playwright__browser_run_code_unsafe]*

None of the public pages scroll sideways at 360. The cart, checkout, confirmation, and orders pages need a signed in user, so I'll make a throwaway one on the local database.

*[6 tool calls: Bash ×5, mcp__playwright__browser_run_code_unsafe]*

Quick update: the full purchase journey works at both sizes, with no sideways scroll on any page. All 18 screenshots are saved. Next I'll look at a few of them and the console log for problems.

*[8 tool calls: Read ×4, Bash ×4]*

I've finished building visual fidelity & polish. Feature 16 stays `in-progress` and spec 0015 stays `In Progress` until `/check verify` closes them.

- **Client (steps 4 to 11):** already in your working tree from an earlier session. I checked it against the spec and didn't change it. Format, lint, typecheck, all 413 tests and the build pass.
- **Seed data and featured art (step 7, AC-12), new this session:** [home.php](server/database/data/home.php) now puts Cyberpunk 2077 first with its art file. [HomeSeeder.php](server/database/seeders/HomeSeeder.php) checks the file exists before it writes anything and builds the image URL from `APP_URL`. [HomeSeedersTest.php](server/tests/Feature/Seed/HomeSeedersTest.php) gained a test for the missing file case. All 460 Pest tests, Pint and PHPStan pass.
- **Featured art:** I re-encoded it to 249 KB, as you chose. It is still 2172 by 724, under the spec's 2400 by 800 minimum, and `verify.md` records that you accepted it. Your original is backed up at /private/tmp/claude-501/-Users-[REDACTED:user]-AI-WORKSPACE-Projects-eneba/a11cf648-ea5b-4d39-8498-d26baf09ef47/scratchpad/featured-original.webp.
- **Screenshots (AC-25):** I took 18, at 1440 and 360 wide, in `docs/reference/current/` (gitignored). Cart, checkout, confirmation and orders come from a real 4242 test payment. No page scrolls sideways at 360, and the console showed no errors. I looked closely at 5 of them (home at both sizes, product, mobile checkout, confirmation); the other 13 are marked for `/check verify` to review.
- **Scope and docs:** I ticked `Build it` and its three remaining sub steps in [scope.md](docs/scope/scope.md). [verify.md](docs/specs/0015-visual-fidelity-polish/verify.md) now holds the screenshot table and the updated test counts.
- **Two things for `/architect`:** whether to lower the art size minimum in AC-12, and whether to change AC-13's copy to "N results". The page shows "N results" because an existing test checks that text and AC-22 doesn't allow editing it, so the spec still says "Results found: N".
- **Local leftovers:** a throwaway user `visual-check-…@example.com` with two test orders is in your local database. The "Needs from you" line in the scope is now out of date; `/sync` can remove it.

Nothing is committed yet. My suggested next steps:
```
/check verify visual fidelity & polish
```
After you merge, rerun `php artisan db:seed --class=HomeSeeder` on production and check that Render's `APP_URL` is the public API address.

---

## USER · 2

<sub>2026-11-14 21:17 UTC · [open in full transcript](../full/session-072.md#prompt-2) · record `caf29130-356e-4cf1-b139-68e118374cf8`</sub>

Feature 16 visual polish correction — Store toolbar.

Compare the current Store page with the local Eneba desktop reference in docs/reference/desktop/.

The current sort control is visually disconnected from the results count and creates excessive empty space above the product grid.

Adjust only the Store results toolbar:

- Place the results count on the left and sorting control on the right, aligned in one compact row directly above the product grid.
- Remove the separate visible "Sort by" label while preserving an accessible name.
- Style the sort trigger closer to Eneba: compact, yellow accent text/icon, without a large outlined form field.
- Keep all existing sort options, query parameters, pagination and filtering behavior unchanged.
- Reduce unnecessary vertical spacing above the product grid.
- Preserve mobile usability at 360px and keyboard accessibility.

Prefer the existing select implementation unless a custom dropdown is necessary. Do not introduce dependencies or modify backend APIs.

Verify desktop and mobile screenshots and run relevant Store tests.

Do not commit yet. Report the visual changes for manual approval.

## CLAUDE · 2

I'll compare the current Store screenshot with the reference, then read the store page code.

*[6 tool calls: Read ×2, Bash ×4]*

`cta` on `bg` is 7.2:1, which also passes as text (4.5:1). Next I'll compute the hover pair so I can add both text rows to the contrast table in `design.md`.

*[5 tool calls: Bash ×2, Write, Edit ×2]*

Lint, typecheck and all 26 Store tests pass. The tests still find the control as `combobox` named "Sort by". Next I'll take screenshots and check the keyboard.

*[3 tool calls: mcp__playwright__browser_run_code_unsafe, Read ×2]*

The yellow box in both screenshots is the keyboard focus ring (I tabbed onto the control on purpose). I'll take one more screenshot without focus to confirm there's no field box at rest.

*[7 tool calls: mcp__playwright__browser_run_code_unsafe ×2, Read ×3, Edit, Bash]*

Now that matches the reference. One last full run of the client checks:

*[1 tool call: Bash]*

I've reworked the Store toolbar, and it's ready for you to review. Nothing is committed.

**What changed visually:**
- **One row above the grid:** the result count sits on the left and the sort control on the right. On phones it's the Filters pill on the left and sort on the right, with the count on its own line below, as before.
- **Sort control:** the visible "Sort by" label and the outlined field box are gone. It's now a sort icon, the current option in bold yellow, and a small chevron, 44px tall. At rest it looks like plain text, like the "Popularity: Most popular" control in the reference.
- **Less empty space:** the grid starts 30px higher on desktop (from 299px down to 269px), and the toolbar sits closer to the grid.

**What stayed the same:**
- It's still the native `<select>`, now in a new [SortSelect.tsx](client/src/components/store/SortSelect.tsx). It has the same four options and still updates `?sort=` (I tested choosing `price_asc`). Filters, pagination and the other query parameters are untouched, and no backend or dependency changes.
- Screen readers and tests still find it as "Sort by". Tabbing onto it shows the usual yellow focus ring, and nothing scrolls sideways at 360px.

**Two notes:**
- The control now shrinks to fit the selected label using a newer CSS feature, `field-sizing-content`. Browsers without it (Firefox, for example) show it as wide as the longest option, so the chevron sits a little further right there.
- I added two contrast rows to [design.md](client/design.md): yellow text on the page background is 7.2:1, and 7.8:1 on hover. Both are well above the 4.5:1 minimum.

All 413 client tests pass (26 of them for the Store page), along with format, lint, typecheck and the build.

Screenshots to compare:
- Desktop: [desktop-store.png](docs/reference/current/desktop-store.png) and the reference [store.png](docs/reference/desktop/store.png)
- Phone at 360px: [mobile-store.png](docs/reference/current/mobile-store.png)
- With keyboard focus: [desktop-store-toolbar.png](docs/reference/current/desktop-store-toolbar.png) and [mobile-store-toolbar.png](docs/reference/current/mobile-store-toolbar.png)

---

## USER · 3

<sub>2026-11-14 21:21 UTC · [open in full transcript](../full/session-072.md#prompt-3) · record `e51c6000-b760-4e33-9f6e-c95fbea2c2a6`</sub>

Feature 16 — Store sort dropdown visual polish.

The native HTML select popup currently uses macOS styling and does not match the Eneba reference.

Replace only the Store sort control presentation with an accessible custom dropdown:

- Compact yellow text/icon trigger, no outlined select field.
- White dropdown panel with dark text, aligned to the trigger's right edge.
- Clear selected state, subtle hover/focus styling, compact option spacing.
- Preserve the existing three sort options, URL query parameters, filtering, pagination, and sorting behavior.
- Support keyboard navigation, Escape, focus management, and screen readers.
- Reuse an existing accessible dropdown/menu primitive if available. Avoid adding a dependency unless necessary.
- Ensure the dropdown is not clipped by surrounding containers and works at 360px.

Update only relevant Store UI and tests. Do not modify backend APIs or unrelated components.

Run relevant tests and inspect the result at desktop and mobile widths. Do not commit yet.

## CLAUDE · 3

First I'll check whether the app already has a dropdown I can reuse (the account menu in the header is one), and how the Store tests drive the sort control.

*[5 tool calls: Bash ×4, Read]*

The colours work: dark text on the white panel is 17.4:1, the highlighted row is 12.4:1, and the purple selected text is 7.6:1 even on the highlight. Now the component:

*[2 tool calls: Write, Bash]*

Now I'll update the four places in the Store tests that drove the native select.

*[1 tool call: Bash]*

Next, a focused test file for the picker's own behaviour (keyboard, Escape, outside click, selected state):

*[4 tool calls: Write, Bash ×3]*

All 422 client tests pass, including 9 new ones for the picker. Next I'll add the panel colours to the contrast table, then check the dropdown in the browser.

*[4 tool calls: Bash, mcp__playwright__browser_run_code_unsafe, Read ×2]*

I've replaced the native select with a custom dropdown, and it works at both widths. Nothing is committed.

**What it looks like:**
- **Trigger:** unchanged, the yellow sort icon, the current option and a chevron. The chevron now flips while the list is open (only when the system doesn't ask for reduced motion).
- **Panel:** white, with dark text and compact 40px rows. It lines up with the trigger's right edge: 1128 to 1320px on desktop, 148 to 340px at 360 wide.
- **Selected and highlighted options:** the selected one is bold purple with a check mark. The highlighted one (under the mouse or arrow keys) gets a soft grey background.
- **No clipping:** the panel sits on top of the product cards, and nothing scrolls sideways at 360px.

**How it behaves:**
- **Pattern:** it follows the standard WAI-ARIA "select only combobox" pattern. Screen readers announce it as "Sort by, Name: A to Z" and are told which option is highlighted.
- **Keyboard:**
  - Arrow keys, Enter, Space, Home or End open the list on the right option.
  - Arrows, Home and End move the highlight; Enter or Space picks.
  - Escape closes without changing anything.
  - Tab or a click outside the list also closes it without changing anything.
- **Focus:** stays on the trigger the whole time, so the yellow focus ring is always visible.
- **Sorting:** same options as before (three without a search, plus Relevance with one), and the same `?sort=` behaviour. Picking the current option again changes nothing. In the browser, Enter gave `?sort=price_asc` and a click gave `?sort=price_desc` at both widths.

**One small difference from the standard pattern:** pressing Tab closes the list without picking the highlighted option. The standard pattern would pick it, but I felt that could change your sort by surprise. It's a one line change if you'd rather match the standard.

**Files:**
- [SortSelect.tsx](client/src/components/store/SortSelect.tsx): the dropdown itself. I built it new because the app had no reusable dropdown (`AccountMenu` is a simple show/hide menu).
- [SortSelect.test.tsx](client/src/components/store/SortSelect.test.tsx): 9 new tests for the keyboard, Escape, Tab, outside click, focus and selected state.
- [StorePage.test.tsx](client/src/pages/StorePage.test.tsx): the 4 spots that used the native select now open the dropdown and click an option. What each test checks is unchanged.
- [design.md](client/design.md): 4 new contrast rows, from 7.6:1 to 17.4:1 against a 4.5:1 minimum.

No new dependencies, and no changes to the backend or other components. All 422 client tests pass, plus lint and typecheck.

Screenshots with the list open: [desktop-store-sort-open.png](docs/reference/current/desktop-store-sort-open.png) and [mobile-store-sort-open.png](docs/reference/current/mobile-store-sort-open.png). In the mobile one the chevron is caught halfway through flipping.

---

## USER · 4

<sub>2026-11-14 21:24 UTC · [open in full transcript](../full/session-072.md#prompt-4) · record `93144c2c-7a79-417c-8c24-e95f635521a9`</sub>

Feature 16 — Mobile homepage hero refinement.

The current mobile hero uses a horizontal carousel of large portrait cards. It occupies too much vertical space and exposes partially clipped neighboring cards.

Change only the mobile/tablet hero presentation:

- Below 1024px, show a single featured Cyberpunk 2077 hero instead of the portrait carousel.
- Preserve the existing desktop split hero at 1024px and above.
- Use the existing Cyberpunk portrait cover or another suitable existing asset for mobile; do not crop the 3:1 desktop artwork into a portrait.
- Keep the featured product linked to its real product page.
- Display title, current price, optional original price/discount, and a real "Shop now" CTA.
- Hide the long description on mobile.
- Make the hero compact enough that platform shortcuts and Best sellers appear sooner.
- Remove mobile hero carousel navigation and scrolling behavior.
- Preserve existing API contracts and homepage block loading/error states.
- Ensure no horizontal overflow at 360px.

Update relevant tests and capture screenshots at 360px and 768px.

Do not change desktop hero, backend, or unrelated homepage sections. Do not commit yet. Report the result for visual approval.

## CLAUDE · 4

This overrides spec 0015 AC-11 (which said the mobile rail shows every banner). You've asked for it directly, so I'll build it and note the change for `/architect`. I'll start by reading the hero code and its tests.

*[6 tool calls: Bash ×6]*

Now the showcase, the hero tests, and deleting `BannerTile`:

*[1 tool call: Bash]*

One type error in my new test: the discounted banner needs a `Banner` type annotation. Also, `git rm` staged the deletion, so I'll unstage it to keep everything unstaged as before.

*[4 tool calls: Bash, mcp__playwright__browser_run_code_unsafe, Read ×2]*

The mobile hero now shows just the Cyberpunk 2077 tile, and the desktop split hero is unchanged. Nothing is committed.

**At 360px:**
- One tile, 176px tall: title, struck price €59.99 with -66%, current price €20.39, and a yellow "Shop now" pill on the left, with the portrait cover on the right.
- The whole tile is one link to `/products/cyberpunk-2077-xbox-europe`.
- No tagline, no carousel, no arrows, no sideways scroll.
- Things move up a lot: "Best sellers" now starts at 477px instead of about 707px, so the platform shortcuts and the first best seller show on the first screen.

**At 768px:** the same tile at 208px tall. "Best sellers" starts at 533px and nothing scrolls sideways. The tile is wide here, so there's a lot of empty dark space between the text and the cover. If you'd like it fuller at tablet width, I could cap its width or enlarge the title.

**At 1440px:** the split hero is unchanged (3 links, 360px tall).

**How I built it:**
- The compact hero reuses `BannerSideTile` (the desktop side tile) with a fixed height. It gained an optional `coverLoading` prop, so this one image loads right away; the desktop tiles keep the default.
- It shows the first banner from the existing API, not a hardcoded Cyberpunk. Cyberpunk comes first because of the seed order.
- The loading skeleton is the same height, and the error and empty states still come from the shared homepage block code.
- I deleted [BannerTile.tsx](client/src/components/home/BannerTile.tsx), the carousel card, because nothing else uses it. `ScrollRail` stays, since the product rails use it.
- The dev only `/ui` showcase now shows the compact hero instead of the carousel.

**Tests:** the old carousel test is replaced by 3 for the compact hero: one link with no tagline and an eagerly loaded cover, no carousel controls, and the discount display. All 424 client tests pass, plus format, lint and typecheck. No backend or API changes.

**Spec note:** this replaces spec 0015 AC-11, which says phones show every banner in a rail. Banners 2 to 8 no longer appear anywhere on phones or tablets. I'd suggest `/architect` updates AC-11 before `/check verify`, or verify will mark it failed.

Screenshots: [mobile-home.png](docs/reference/current/mobile-home.png), [tablet-home.png](docs/reference/current/tablet-home.png), and [desktop-home.png](docs/reference/current/desktop-home.png) for the unchanged desktop.

---

## USER · 5

<sub>2026-11-14 21:28 UTC · [open in full transcript](../full/session-072.md#prompt-5) · record `b399afca-92e9-4ec4-85c1-6a4f1ab6673f`</sub>

Feature 16 — Remove redundant desktop navigation row.

The second header navigation row (Store, Steam, PlayStation, Xbox, Nintendo) duplicates the platform shortcuts already displayed below the homepage hero.

Simplify the shared header:

- Remove the second navigation row on desktop and tablet.
- Keep the primary header with logo, search, cart, and account controls.
- Preserve the mobile Store icon as the main entry point to the catalog.
- Keep the existing homepage platform shortcuts unchanged.
- Ensure Store remains reachable from desktop, either through a compact existing header control or another clearly discoverable entry point. Do not rely on homepage shortcuts as the only navigation path.
- Update sticky header height and related scroll offsets so no unnecessary space remains.
- Preserve navigation functionality, responsive behavior, and accessibility.
- Update relevant tests and inspect homepage, Store, and Product pages at 1440px and 360px.

Do not change backend APIs or unrelated UI. Do not commit yet. Report the result for visual approval.

## CLAUDE · 5

This reverses spec 0015 AC-5 (the second nav row), so I'll note it for `/architect` like the hero change. I'll start by reading the header, its tests, and the `--header-h` variable.

*[5 tool calls: Bash ×5]*

Now the leftover helper in that test, the header tests, the AppLayout tests, and the CSS:

*[2 tool calls: Bash ×2]*

The footer also has a "Store" link, so I'll limit these checks to the header (`banner`).

*[1 tool call: Bash]*

Tests pass. Now the browser: I'll measure the real header height against `--header-h` and screenshot home, Store and Product at both widths.

*[1 tool call: mcp__playwright__browser_run_code_unsafe]*

The header is 69px at 768 and up and 121px on mobile, exactly matching `--header-h` both times. The sticky buy box now sits at 85px, which is the header plus 1rem. Next I'll check the screenshots.

*[4 tool calls: Read ×4]*

All six screenshots look right. Last, I'll check whether `design.md` still describes the nav row.

*[2 tool calls: Bash ×2]*

I've removed the second navigation row, and it's ready for you to review. Nothing is committed.

**What changed:**
- **One row from 768px up:** logo, search, Store, cart and account. The header is now 69px tall instead of 113px, so every page starts about 44px higher.
- **Store on desktop:** a compact "Store" link with an icon sits right before the cart, styled like the account menu. It turns yellow and gets `aria-current="page"` on `/store`, including with a search or filters.
- **Phones:** unchanged. The header is still the Store icon, cart and account, with search on its own line underneath. The Store icon also turns yellow on `/store` now.
- **Homepage shortcuts:** unchanged. They're now the only place with Steam, PlayStation, Xbox and Nintendo links. The Store page's own platform filter still covers those on every page.

**Scroll offsets:** I measured the real header in the browser, and it matches `--header-h` exactly (69px from 768px, 121px on mobile). That one variable drives every sticky offset, so they all updated:
- The product buy box now sticks at 85px (the header plus 1rem).
- The cart and checkout summaries use the same offset.
- The "+N offers" jump still lands below the header.

No page scrolls sideways at 360px.

**Code:**
- [Header.tsx](client/src/components/layout/Header.tsx): removed the nav row and added the `StoreLink` component.
- [platformLinks.ts](client/src/lib/platformLinks.ts) and [its test](client/src/lib/platformLinks.test.ts): removed `currentNavKey`, which only the nav row used.
- [index.css](client/src/index.css): `--header-h` is now 4.3125rem from `md` up.
- [Header.test.tsx](client/src/components/layout/Header.test.tsx): now checks there's no nav row, that Store links to `/store`, and that it's current on `/store`, `/store?q=x` and `/store?platform=steam` but not on `/`.
- [AppLayout.test.tsx](client/src/components/layout/AppLayout.test.tsx): checks the header's Store link instead of the nav (limited to the header, because the footer also has a "Store" link).
- [design.md](client/design.md): updated the header description and swapped the nav row contrast entry for the Store link (7.2:1).

All 423 client tests pass, plus format, lint and typecheck. No backend changes.

**Spec note:** this reverses spec 0015 AC-5 (the two row header). Together with the earlier mobile hero change (AC-11), I'd suggest one `/architect` pass to amend both before `/check verify`.

Screenshots: [desktop-home.png](docs/reference/current/desktop-home.png), [desktop-store.png](docs/reference/current/desktop-store.png), [desktop-product.png](docs/reference/current/desktop-product.png), [mobile-home.png](docs/reference/current/mobile-home.png), [mobile-store.png](docs/reference/current/mobile-store.png), [mobile-product.png](docs/reference/current/mobile-product.png).

---

## USER · 6

<sub>2026-11-14 21:31 UTC · [open in full transcript](../full/session-072.md#prompt-6) · record `9dc7fb2e-3a85-4a77-a753-35e3190891d9`</sub>

Feature 16 — Final mobile hero visual refinement.

The current mobile hero reuses BannerSideTile and looks like a wide product card. I want the mobile homepage to reuse the exact same Cyberpunk featured artwork as desktop instead.

Requirements:
- Reuse the existing cyberpunk-2077-featured.webp asset and featured banner data.
- Below 1024px, render one responsive promotional hero using that artwork, not a portrait product card or carousel.
- Keep the desktop split hero unchanged.
- Preserve the real product link, title, price, discount and CTA.
- Keep text as React elements, not baked into the image.
- Use responsive image positioning/cropping and a gradient overlay for readability.
- Avoid covering the main character with text.
- Do not create another image asset or introduce dependencies.
- Preserve loading, error and empty states.

Inspect screenshots at 360px, 390px, 768px and 1440px. Pay particular attention to artwork cropping, text legibility and hero height.

Do not update the spec or commit yet. Report screenshots and any tradeoffs for manual approval.

## CLAUDE · 6

First I'll read the desktop `FeaturedBanner`, since the mobile hero should use the same artwork and data.

*[3 tool calls: Bash ×2, Write]*

`BannerSideTile` isn't tracked in git, so I'll undo the `coverLoading` prop by hand, then wire up the hero and the tests.

*[1 tool call: Bash]*

Checks pass (424 tests). Next I'll take screenshots at the four widths and measure the hero, so the skeleton height matches.

*[5 tool calls: mcp__playwright__browser_run_code_unsafe, Read ×4]*

The page was scrolled down in those screenshots, because the browser kept an earlier scroll position. I'll scroll to the top and retake them.

*[5 tool calls: mcp__playwright__browser_run_code_unsafe, Read ×3, Bash]*

Below 1024px the homepage now uses the same Cyberpunk artwork and banner data as the desktop hero. Desktop is unchanged, and I haven't touched the spec or committed anything.

| Width | Layout | Hero height | "Best sellers" starts at |
|---|---|---|---|
| 360 | Art on top, text strip below | 212px | 513px |
| 390 | Same | 227px | 528px |
| 768 | Text on a left gradient, art on the right | 256px | 537px |
| 1440 | Desktop split hero, unchanged | 360px | 649px |

**Cropping:**
- **Below 640px:** the art is a 2:1 band showing the character's full head and shoulders, plus some neon city on the left. Title, prices and "Shop now" sit in a dark strip under the art. The strip overlaps only the bottom 32px of the art (the jacket), never the face.
- **640px to 1023px:** it matches desktop. The text stays in the left 45% over a dark gradient, the character is fully visible on the right, and the right edge of her jacket is slightly cut off.

**Text and accessibility:** all the text is real page text in our existing styles (white title, struck price, green discount, the yellow button), sitting on 95% dark backgrounds. The whole hero is one link to the product page. The image loads right away at high priority and is marked decorative (`alt=""`).

**States:**
- **Loading:** the skeleton matches the real size (2:1 block plus a 52px strip on phones, 256px from 640px), so nothing jumps.
- **Image error:** the art disappears and the text and link stay, now covered by a test.
- **Error and empty:** handled by the same shared homepage block code as before.

Nothing scrolls sideways at any width, and I used no new image or dependency.

**Tradeoffs to check:**
- **Taller than last round:** about 212px at 360 instead of 176, so "Best sellers" starts about 36px lower, but still well inside the first screen (513 of 780px).
- **No tagline on phones:** the strip only has room for title, price and button. The tagline still shows on desktop.
- **Shared image file:** a desktop sized WebP (249 KB) now loads on phones too. Using the existing asset means no smaller mobile version.
- **Between 640px and 767px** (large phones in landscape): the text column gets closer to the character's shoulder. It's readable on the gradient, but tighter than at 768.
- **Banners 2 to 8** still don't appear below 1024px, as after the last change.

**Code:**
- New [CompactFeaturedBanner.tsx](client/src/components/home/CompactFeaturedBanner.tsx): the hero.
- [HeroBanners.tsx](client/src/components/home/HeroBanners.tsx): uses it, with the matching skeleton.
- [BannerSideTile.tsx](client/src/components/home/BannerSideTile.tsx): back to its desktop only version (I removed the prop I added last round).
- [HeroBanners.test.tsx](client/src/components/home/HeroBanners.test.tsx): now checks the shared art, the eager loading, that there's no tagline or carousel, the discount, and the image error case.

All 424 client tests pass, plus format, lint and typecheck.

Screenshots: [home-hero-360.png](docs/reference/current/home-hero-360.png), [home-hero-390.png](docs/reference/current/home-hero-390.png), [home-hero-768.png](docs/reference/current/home-hero-768.png), [home-hero-1440.png](docs/reference/current/home-hero-1440.png).
