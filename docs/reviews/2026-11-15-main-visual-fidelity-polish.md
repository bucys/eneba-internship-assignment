# Review, main (uncommitted), 2026-11-15

**Reviewed by**: Sonnet 5.5 (author on a different session; same family, fresh read)
**Scope**: 62 files (38 tracked changes, 24 untracked), uncommitted vs main
**Verdict**: Approve with nits

## Summary
Feature 16 (spec 0015) restyles the shared price and card, collapses the header, adds the split and compact hero, platform shortcuts, a custom sort combobox, the two column product page, the checkout header with stepper, and a seeded featured banner image. The code follows the spec closely, keeps behaviour, routes and API shapes unchanged, and has solid test coverage for the new logic. No blockers or majors; a handful of minors around scroll offsets, skeleton parity, layering, and an unrequested `.gitignore` change.

## Minor
### 🟡 `.claude/` added to `.gitignore` outside the spec, `.gitignore:13`
**Problem**: The spec (AC-24) only adds `docs/reference/current/`. The diff also ignores all of `.claude/`, and the file now lacks a trailing newline. `.claude/skills/*` is currently tracked and AGENTS.md links to those skills as part of the repo.
**Why it matters**: Tracked files stay tracked, but any new or updated skill file is silently ignored, so skills drift from the repo without warning. It is also an unreviewed scope addition.
**Suggested fix**: Drop the `.claude/` line (or ignore only `.claude/settings.local.json` and similar), and restore the trailing newline.

### 🟡 `scroll-mt` stacks with `scroll-padding-top`, `client/src/components/product/OfferList.tsx:14` and `client/src/index.css` (html rule)
**Problem**: `html` has `scroll-padding-top: calc(var(--header-h) + 0.5rem)` and `#offers` adds `scroll-mt-[calc(var(--header-h)+1rem)]`. Scroll padding and scroll margin are additive, so the "+N offers" jump leaves roughly twice the header height above the heading (about 266px on a phone, about 160px on desktop).
**Why it matters**: The heading is not hidden (so verify passes), but the jump wastes a large part of a phone viewport and the spec's intent is "just under the header".
**Suggested fix**: Remove the `scroll-mt` on `#offers` (the global padding already covers it) or lower the global padding, and re-check at 360px.

### 🟡 Home skeleton lacks the shortcuts row, `client/src/components/home/HomePageSkeleton.tsx:11`
**Problem**: The loaded page now has a `PlatformShortcuts` row (about 7 to 8rem tall) under the hero, but the skeleton goes straight from hero to the first band.
**Why it matters**: Content shifts down when data arrives, which AC-8 explicitly tries to avoid for the hero.
**Suggested fix**: Add a static placeholder of the same height under `HeroSkeleton`.

### 🟡 Component imports from the pages layer, `client/src/components/product/BuyBox.tsx:3`
**Problem**: `BuyBox` imports `otherOffersSummary` from `pages/productPageView`, which also pulls in `ApiError` and `lib/env`. That is why `BuyBox.test` must mock env.
**Why it matters**: Inverted dependency (component to page module); other components do not do this.
**Suggested fix**: Move `otherOffersSummary` (and its test) into `lib/` or next to the offer components.

### 🟡 Featured text can overlap the art's subject, `client/src/components/home/FeaturedBanner.tsx:39-40`
**Problem**: The gradient is transparent at 60% of the slot width, but the text column (32px padding plus 26rem) reaches about 71% of the slot at 1024px. Tagline and price can sit over unfaded art where the subject begins.
**Why it matters**: The design.md contrast row assumes the worst case at the left edge only; the tagline's right end is not covered. Depends on the art, so uncertain.
**Suggested fix**: Check at 1024 to 1100px; if it overlaps, cap the text column width in percent or extend the gradient stop.

### 🟡 No tests for new product page parts, `client/src/components/product/ProductBreadcrumb.tsx`, `ProductInfoRows.tsx`, `ProductTitleBlock.tsx`
**Problem**: There is no `ProductPage` test and none of these three components is covered (breadcrumb `aria-current="page"`, plain `/store` link, the three info rows' copy, no extra claims). `PlatformShortcuts` is covered only through `HomePage.test`.
**Why it matters**: AC-15 and AC-17 are the only new ACs with no automated check; they rely on the manual verify.md pass.
**Suggested fix**: Add one small test file covering breadcrumb markup and the three info rows.

### 🟡 Page grid leaves an empty fourth row, `client/src/pages/ProductPage.tsx:1231`
**Problem**: The buy box spans `row-span-4`, but the left column has only three items (title, info rows, offers and about), so an empty implicit row adds an extra `gap-8` below the content from `lg`.
**Why it matters**: A 2rem trailing gap and, if the buy box is taller than the left column, extra height is distributed across the spanned rows.
**Suggested fix**: Span `row-span-3`.

## Nits
- ⚪ `client/src/components/product/ProductInfoRows.tsx:29`, key `title + text` is fine but `title` alone is unique; simplify.
- ⚪ `client/src/pages/productPageView.ts:61`, spec says compare with `lib/money` helpers; none exists, so comparing `.amount` is fine, but note it in the spec.
- ⚪ `client/src/components/layout/CheckoutHeader.tsx:13`, height equals the `md` `--header-h` only by coincidence of padding; on mobile `--header-h` (two lines) is larger than this one line header, so `scroll-padding-top` is oversized on `/cart` and `/checkout`.
- ⚪ `client/src/components/store/SortSelect.tsx:122`, Space on a button can fire `click` on keyup in some browsers after `keydown` already opened the list; worth a manual Firefox check (unverified).
- ⚪ `docs/specs/0015-visual-fidelity-polish/index.md`, Follow-up items (`/sync`, `/scope` reconciliation) are still open.

## Strengths
- Spec traceability is excellent: comments cite ACs, design.md has a contrast row for every new colour pair, and invariants (one hero layout mounted, one link per card, text never baked into art) are respected.
- `SortSelect` is a careful APG combobox with thorough keyboard and focus tests; existing store tests were changed only to drive the new control, preserving assertion intent.
- `HomeSeeder` validates the image file before any write, is covered by a clear failure test, and keeps the API shape unchanged; money stays integer cents.
- Route handle based `checkoutStep` with `useMatches` is a clean way to swap the header without touching loaders or guards.

## Test coverage
Good. New logic with branching is tested: `Price`, `ProductCard`, `Header`, `AppLayout` (checkout header), `Stepper`, `HeroBanners` (split, compact, errors), `SortSelect`, `BuyBox` (including null best offer), `otherOffersSummary`, `platformLinks`, `HomePage` (shortcuts, split mount), `OrderConfirmationPage` (stepper only when just paid), and `HomeSeedersTest` (featured image, missing file). Gaps: product breadcrumb, info rows and title block (see Minor); `BannersTest` is unchanged and still valid since it builds its own data. The `.webp` is 2172x724 and 249 KB, matching the amended AC-12.

## Resolution (feature 17, 2026-11-16)

States from [spec 0016](../specs/0016-performance-reliability/rationale.md#closeout-decision-2026-11-16): DONE (resolved or fixed), DEFER (not done, carried as a follow up), SKIP (won't fix).

- `.claude/` in `.gitignore`: DONE, removed.
- `scroll-mt` stacks with `scroll-padding-top`: DONE, removed.
- Home skeleton lacks the shortcuts row: DONE in `b8293a7`. No layout shift at 1440 or 390 px.
- Component imports from the pages layer: DEFER. Refactor only.
- Featured text can overlap the art: DONE in `b8293a7`. The check found a tagline contrast failure from `xl`, and the gradient was strengthened.
- No tests for the new product page parts: DEFER. Test coverage only.
- Empty fourth grid row: DONE (`lg:row-span-3`).
- Nit, `ProductInfoRows` key: SKIP. Style only.
- Nit, money compare note: DONE, in spec 0015.
- Nit, `CheckoutHeader` height: DONE, one row height rule.
- Nit, `SortSelect` Space in Firefox: SKIP. Checked in Firefox 159, the problem does not occur.
- Nit, spec 0015 follow ups: DONE, ticked.
