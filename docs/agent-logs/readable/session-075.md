# Session 075: Feature 16 review findings

- Session ID: `424d2a90-353e-4866-a030-aefb6b6e4ec6`
- Source: `424d2a90-353e-4866-a030-aefb6b6e4ec6.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-14 22:06 UTC → 2026-11-14 22:25 UTC
- Prompts: 7
- Full technical transcript: [full/session-075.md](../full/session-075.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-14 22:06 UTC · [open in full transcript](../full/session-075.md#prompt-1) · record `75ee732c-cf3b-48c1-89b6-3336ecd97d2c`</sub>

`/check`

review visual fidelity & polish

## CLAUDE · 1

*[2 tool calls: Bash ×2]*

**Claude asked — Author model** (select one):

> Which model wrote the visual fidelity & polish code? I'll review on a different one.
> - **opus (detected, recommended)** — I'll review with sonnet for a fresh perspective
> - **sonnet** — Review will run on opus
> - **fable** — Review will run on opus

**USER answered:**

opus (detected, recommended)

Author on `opus`. I'm running the review on `sonnet`, because a second model catches what the author model misses.

*[2 tool calls: Bash, Agent · 1 subagent]*

The review is now running on `sonnet` in the background. It covers 61 changed files for feature 16 (spec 0015). I'll pass on the verdict and findings as soon as it finishes.

_⚙ Automated `peer` message (not written by the developer; content is in the full transcript)._

## CLAUDE · 1 (continued)

## /check review visual fidelity & polish · Approve with nits

There are no blockers and no majors.

There are 7 minors and 5 nits:
- `.claude/` was added to `.gitignore`. Check this one first: AGENTS.md links to skills under `.claude/skills/`, so you probably want those to stay tracked.
- `scroll-mt` adds to `scroll-padding-top` instead of replacing it, so scrolled-to sections land lower than intended.
- The home skeleton has no row for the platform shortcuts.
- `BuyBox` imports from the pages layer.
- The featured banner text may overlap the art.
- The new breadcrumb, info rows and title block components have no tests.
- The product page grid has an empty fourth row.

Strengths: the code traces closely to spec 0015, and `design.md` records a contrast check for every new colour pair. `SortSelect` is a careful accessible combobox with thorough tests. The home seeder checks the banner image before writing anything. The checkout header swap leaves loaders and auth guards alone.

`sonnet` reviewed 62 files. The full findings are in [docs/reviews/2026-11-15-main-visual-fidelity-polish.md](docs/reviews/2026-11-15-main-visual-fidelity-polish.md).

Scope: feature 16's row in [docs/scope/scope.md](docs/scope/scope.md) has no `Review it` box, so I didn't tick anything. You could add the box by hand if you want the review recorded there.

_⚙ Automated `task-notification` message (not written by the developer; content is in the full transcript)._

---

## USER · 2

<sub>2026-11-14 22:10 UTC · [open in full transcript](../full/session-075.md#prompt-2) · record `2bd1f7d1-475e-46d9-a3a3-ef68df69b95e`</sub>

Feature 16 — Address actionable review findings before closing.

Use docs/reviews/2026-11-15-main-visual-fidelity-polish.md as the source of truth.

Prioritize:
2. Fix double scroll offsets caused by scroll-mt and scroll-padding-top.
3. Remove the unintended empty desktop product grid row.
4. Inspect featured banner text overlap at responsive widths.
5. Check whether the missing platform shortcuts skeleton causes measurable layout shift.

Keep changes minimal and within Feature 16.

Do not refactor BuyBox or add broad test coverage unless required by a fix. Add focused regression tests for changed behavior.

Run relevant checks and report which findings are resolved or intentionally deferred.

Do not commit or mark Feature 16 done yet.

## CLAUDE · 2

*[5 tool calls: Bash ×5]*

I've read the review. Next I'll fix the scroll offset and the empty grid row, then check the banner overlap and skeleton shift in the real app.

*[1 tool call: Bash]*

Changes: `OfferList.tsx` (drop the extra `scroll-mt`, since the html padding already clears the header) and `ProductPage.tsx` (the buy box spans 3 rows to match the 3 left items).

*[6 tool calls: Edit ×2, ToolSearch, mcp__playwright__browser_run_code_unsafe ×3]*

The offers jump now lands 8px under the header at 360px and at 1280px, and the desktop grid has 3 rows. Next I'm checking the banner.

*[5 tool calls: mcp__playwright__browser_run_code_unsafe ×2, Read ×2, Bash]*

CLS is 0 at 360px and at 1280px. The shortcuts arrive in the same render as the hero, which replaces the skeleton, so nothing visible shifts. Next I'm adding a regression test and running the checks.

*[5 tool calls: Bash ×4, Write]*

I fixed the two layout findings, confirmed them in the browser, and measured the other two. Nothing is committed and feature 16 isn't marked done.

| Finding | Status |
|---|---|
| Double scroll offset on `#offers` | **Fixed.** I removed the `scroll-mt` in [OfferList.tsx](client/src/components/product/OfferList.tsx), so the page's own scroll padding is the only offset. After clicking "+N offers", the section now lands 8px under the header, at both 360px and 1280px. |
| Empty fourth row on the product page (desktop) | **Fixed.** The buy box in [ProductPage.tsx:93](client/src/pages/ProductPage.tsx#L93) now spans 3 rows instead of 4. At 1280px the grid has exactly 3 rows. |
| Featured banner text overlap | **Confirmed, not fixed yet.** At 1024px the tagline ("carve a … Night City") runs over the pink hair, and at 1280px it's clean. Fixing it changes how the banner looks, so it needs your call (options below). |
| Missing shortcuts row in the home skeleton | **Deferred, no measurable shift.** I slowed the home API calls by 700ms and measured layout shift (CLS): 0 at 360px, 0.002 at 1280px, and that 0.002 comes from the header account area. The real page replaces the skeleton in one render, so nothing that was already on screen moves down. |

**Tests and checks**
- I added [OfferList.test.tsx](client/src/components/product/OfferList.test.tsx), which checks that `#offers` has no `scroll-mt`.
- I didn't add a test for the grid row. There's no `ProductPage` test file yet, and the browser check covered it.
- Prettier, oxlint, typecheck and the build all pass. Vitest: 425 of 425 tests pass across 45 files.

**Spec mismatch:** AC-16 in spec 0015 still requires the `scroll-mt` on `#offers`. The spec now needs a one line amendment through `/architect` to match the code.

**Deferred, as you asked:** the `.gitignore` `.claude/` line, the `BuyBox` import from the pages layer, the tests for the breadcrumb, info rows and title block, and the nits.

**Banner overlap: which fix do you want?** Both only change the 1024px to 1279px range in practice.
1. Hide the tagline below `xl` (1280px). This matches how the compact banner already drops its tagline. It's my recommendation.
2. Make the gradient stronger (add a `via-surface-deep/80` stop around 45%). This keeps the tagline but darkens the art at every width.

Either one also needs AC-9 in spec 0015 updated.

---

## USER · 3

<sub>2026-11-14 22:16 UTC · [open in full transcript](../full/session-075.md#prompt-3) · record `facb8121-0713-40bb-9cfa-b1750f4bce96`</sub>

Feature 16 — Final banner overlap fix.

Approve option 1: hide the desktop featured banner tagline below the xl breakpoint (1280px).

Requirements:
- At 1024–1279px, preserve the title, price, discount, CTA and artwork, but hide the tagline.
- At 1280px and above, preserve the complete desktop hero with tagline.
- Do not change the artwork, gradient, compact mobile hero, or backend.
- Verify at 1024, 1279, 1280 and 1440px.
- Add or update a focused regression test if appropriate.

Do not commit or mark Feature 16 done.

Report the result and any remaining visual issues.

## CLAUDE · 3

Change: in [FeaturedBanner.tsx](client/src/components/home/FeaturedBanner.tsx), the tagline gets `hidden xl:line-clamp-2`. Below 1280px it's hidden, and from 1280px it keeps the 2 line clamp.

*[8 tool calls: Edit ×2, Bash ×2, Read ×3, mcp__playwright__browser_run_code_unsafe]*

The tagline is now hidden from 1024px to 1279px and shows again from 1280px. Nothing is committed and feature 16 isn't marked done.

**Change:** in [FeaturedBanner.tsx](client/src/components/home/FeaturedBanner.tsx), the tagline went from `line-clamp-2` to `hidden xl:line-clamp-2`. The artwork, gradient, compact mobile hero and backend are untouched.

**Browser check** (desktop hero, at each width):

| Width | Title | Tagline | Price and discount | Button | Art | Sideways scroll |
|---|---|---|---|---|---|---|
| 1024 | ✓ | hidden | ✓ | ✓ | ✓ | none |
| 1279 | ✓ | hidden | ✓ | ✓ | ✓ | none |
| 1280 | ✓ | ✓ | ✓ | ✓ | ✓ | none |
| 1440 | ✓ | ✓ | ✓ | ✓ | ✓ | none |

The gradient is the same at all four widths. Below 1280px the banner link's accessible name drops the tagline, which is expected because it only reads visible text.

**Test:** I added one case to [HeroBanners.test.tsx](client/src/components/home/HeroBanners.test.tsx) that checks the tagline has `hidden` and `xl:line-clamp-2`. jsdom doesn't apply Tailwind styles, so the test checks the classes rather than real visibility.

**Checks:** Prettier, oxlint, typecheck and the build all pass. Vitest: 426 of 426 tests pass.

**Remaining visual issues**
- At 1024px the end of the title ("2077") almost touches the tips of the pink hair. It's still clearly readable (bold white text on the dark gradient), so I left it alone.
- Spec 0015 is now behind the code in two places. AC-9 should say the tagline shows only from `xl`, and AC-16 should drop the `scroll-mt` on `#offers`. The [design.md](client/design.md) row for `FeaturedBanner` should mention the `xl` tagline too. Those are spec and doc edits, so I'd do them through `/architect` (or `/sync` for design.md) before you close the feature.

Screenshots are in `/private/tmp/claude-501/-Users-[REDACTED:user]-AI-WORKSPACE-Projects-eneba/424d2a90-353e-4866-a030-aefb6b6e4ec6/scratchpad/` (`featured2-1024.png`, `featured2-1279.png`, `featured2-1280.png`, `featured2-1440.png`).

---

## USER · 4

<sub>2026-11-14 22:17 UTC · [open in full transcript](../full/session-075.md#prompt-4) · record `7326825f-7377-44d2-a8a1-f9369260738a`</sub>

/architect visual fidelity & polish

Apply two final amendments to spec 0015 based on the approved implementation:

1. AC-9: The desktop FeaturedBanner tagline is hidden from 1024px to 1279px and visible from 1280px (xl) upward. Preserve the existing title, price, discount, CTA and artwork requirements.

2. AC-16: The #offers section no longer uses scroll-mt. The page-level scroll-padding-top provides the scroll offset, preventing double spacing. The section must land visibly below the sticky header.

Update the corresponding verification steps and rationale only where needed.

Also update the FeaturedBanner entry in client/design.md to document the xl tagline breakpoint, if permitted by the workflow.

Do not change application code, expand scope, rerun unrelated tests, or commit.

Report the exact documentation changes.

## CLAUDE · 4

*[1 tool call: Skill]*

This is an in place update of spec 0015, so I'm skipping the design interview. First I'm finding every line that mentions these two rules.

*[1 tool call: Bash]*

I'll edit spec 0015's `index.md`, `rationale.md` and `verify.md`, plus `client/design.md`. The changes are text amendments for AC-9 and AC-16 only.

*[2 tool calls: Bash ×2]*

**Claude asked — Cross check** (select one):

> Should I cross check the spec 0015 amendments (AC-9 tagline only from xl, AC-16 no scroll-mt on #offers) before you accept them? (Recommended: Skip, because both amendments only record code you already approved, and I measured it in the browser.)
> - **Skip (Recommended)** — Two small text amendments that match approved, measured code
> - **Another model** — A read only Sonnet pass over the amended spec, returning a critique only

**USER answered:**

Skip (Recommended)

**Claude asked — Accept** (select one):

> Accept the spec 0015 amendments as written? AC-9: the featured banner tagline shows only from 1280px (xl) and is hidden from 1024px to 1279px. AC-16: #offers has no scroll-mt, and the html scroll-padding-top sets the jump offset.
> - **Accept** — Keep the edits as written; spec status stays In Progress
> - **Change something** — Tell me which wording to adjust

**USER answered:**

Accept

I've amended spec 0015 for AC-9 and AC-16 and updated `client/design.md`. You skipped the cross check and accepted the wording. No code changed, I ran no tests, and nothing is committed. The status stays `In Progress`, and the scope row already links the spec, so I didn't touch the scope.

**[docs/specs/0015-visual-fidelity-polish/index.md](docs/specs/0015-visual-fidelity-polish/index.md)**
- **AC-9:** the heading is now `**AC-9** (amended 2026-11-15)`, and the tagline text reads:
  > the tagline (`fg-soft`, 2 lines max, shown only from `xl` (1280px) and hidden from 1024px to 1279px, where the narrower slot puts it over the art's subject)

  The title, price, discount, CTA, art and gradient wording is unchanged.
- **AC-16:** the heading is now `**AC-16** (amended 2026-11-15)`, and the last sentence is now:
  > The offers section gets `id="offers"` and no `scroll-mt` of its own: the `html` `scroll-padding-top` (AC-6) already sets the jump offset, and a scroll margin would add to it and double the gap. After the jump, the section lands visibly below the sticky header.
- **Values table row:** `Sticky offsets, scroll-mt` is now `Sticky offsets, html scroll-padding-top`.
- **Test list:** I added two lines.
  - "Featured tagline carries `hidden xl:line-clamp-2`, verifies **AC-9**"
  - "The `#offers` section has no scroll margin class, verifies **AC-16**"

**[rationale.md](docs/specs/0015-visual-fidelity-polish/rationale.md)**
- **AC-9 amendment:** explains why. Between 1024px and 1279px the art is cropped so the subject sits further left, and the tagline ran over the hair. It also notes the rejected option, a stronger gradient, which would darken the art at every width.
- **AC-16 amendment:** scroll margin adds to the page's scroll padding. Measured result after the fix: the section lands 8px below the header at 360px and 1280px.

**[verify.md](docs/specs/0015-visual-fidelity-polish/verify.md)**
- **Opening note:** now also lists "2026-11-15 (AC-9, AC-16)".
- **AC-9 step:** adds the width checks. The tagline is hidden at 1024px and 1279px with everything else kept, and shown at 1280px and 1440px.
- **AC-16 step:** now says the section "lands just below the sticky header (no doubled gap) at 360px and desktop".

**[client/design.md](client/design.md)**
- **Header height note:** `scroll-mt` is no longer listed among the offsets. I added: "Do not add `scroll-mt` to jump targets such as `#offers`: scroll margin adds to the `html` padding and doubles the gap."
- **`FeaturedBanner` row:** the tagline is now described as "only from `xl`; hidden from `lg` to just under `xl`, where it would run over the art's subject".

**Still open**
- AC-6 still says "every sticky offset and `scroll-mt` in this spec" reads `--header-h`. That's still true, just slightly out of date now that no `scroll-mt` is left, so I left it.
- The spec's Follow-up list still has the `/scope` and `/sync` items. When you're ready to close feature 16, running `/sync` next would cover them.

---

## USER · 5

<sub>2026-11-14 22:19 UTC · [open in full transcript](../full/session-075.md#prompt-5) · record `44d598fa-06bc-4da7-8071-f72cdb72d10c`</sub>

/sync

Synchronize project documentation after the completed Feature 16 implementation and verification.

Pay particular attention to:
- client/AGENTS.md: current Store components, including SortSelect, and the product page structure.
- Specs 0012 and 0014: mark requirements partly superseded by spec 0015 where applicable.
- Spec 0015 AC-6: remove the stale scroll-mt reference while preserving the correct shared scroll-padding-top behavior.
- Resolve completed /sync follow-ups in spec 0015.

Do not change application code, tests, acceptance criteria behavior, or feature status.

Report remaining documentation inconsistencies. Do not commit.

## CLAUDE · 5

*[2 tool calls: Skill, Bash]*

I'm now checking the context files and spec 0015's follow-ups against what changed.

*[4 tool calls: Bash ×4]*

**Claude asked — Spec edits** (select one):

> /sync can only edit a spec's Status line, and spec content belongs to /architect. Should I apply your spec edits now as /architect amendments? They are: 'partly replaced by 0015' notes on specs 0003, 0012 AC-6 and 0014 AC-10, removing the stale scroll-mt mention from 0015 AC-6, and ticking the /sync follow-up in 0015.
> - **Apply as /architect (Recommended)** — Text notes only: no AC behaviour or status changes, each edit listed in the report
> - **Flag only** — Leave spec content untouched and list the stale points for a later /architect run

**USER answered:**

Apply as /architect (Recommended)

*[4 tool calls: Bash ×4]*

## /sync complete · reconciled the feature 16 changes

I updated `client/AGENTS.md`, `server/AGENTS.md` and four specs, with your go ahead for the spec content. No code, tests, AC behaviour, spec status or feature status changed, and nothing is committed.

**What changed**
- **[client/AGENTS.md](client/AGENTS.md):** the components row now lists `SortSelect`, `Stepper`, and `CheckoutHeader` (with how `handle.checkoutStep` swaps it in). The product page parts now read breadcrumb, title block, info rows, sticky `BuyBox`, and `OfferList` (`#offers`); the deleted "hero" entry is gone. The homepage row explains the split versus compact hero and `PLATFORM_LINKS`. I also added one convention: offsets read `--header-h`, and jump targets get no `scroll-mt`.
- **[server/AGENTS.md](server/AGENTS.md):** a banner with an `image` key needs its file under `public/`, or the seeder fails. Its `image_url` comes from `url()`, so `APP_URL` must be the public API origin.
- **Specs 0003, 0012 and 0014:** each now has a "Partly superseded by spec 0015" note under its Status line, following the note style 0012 already uses.
  - 0003: the price token, `Price` look, card parts and 5 column grid.
  - 0012: AC-6 sort `Select` replaced by `SortSelect`, plus the filter panels.
  - 0014: AC-10 portrait strip replaced by the split and compact hero, plus the shortcuts row.
- **Spec 0015:**
  - AC-6 drops the stale `scroll-mt` wording. It now says `html` `scroll-padding-top` is the only offset for jump targets, and is marked amended 2026-11-15.
  - The `/sync` follow-up is ticked.
  - `verify.md` lists the AC-6 wording change.

**Heads up (needs you)**
- **Scope text, for `/scope`:** feature 16 still says "two row header", asks for art "at least 2400 by 800", and keeps the "Needs from you" art line, but the art has been supplied. Spec 0015's `/scope` follow-up stays open for this.
- **Feature 16 status:** Design, Build with all its milestones, and Verify are all ticked. By the sync rule it could move to `done`, but you asked me to leave status alone, so it stays `in-progress`.
- **Spec 0015 AC-16 wording, for `/architect`:** it says X is "compared and formatted with the `lib/money` helpers", but there is no compare helper; the code compares `.amount` directly. This was a review nit.
- **Mobile `/cart` and `/checkout`:** the one line `CheckoutHeader` is shorter than the two line `--header-h` value, so the scroll padding there is larger than it needs to be. It isn't documented anywhere, and it's code, not docs (review nit).
- **Still open in spec 0015 Follow-up:** reseed the production home banners after merge, and confirm Render's `APP_URL`.

---

## USER · 6

<sub>2026-11-14 22:22 UTC · [open in full transcript](../full/session-075.md#prompt-6) · record `97037096-6b3f-4c4c-b9e1-1b13bbf566cd`</sub>

/scope

Reconcile Feature 16 in docs/scope/scope.md with the approved and verified spec 0015.

- Replace the outdated two-row desktop header description with the single-row header.
- Update the artwork requirement to reflect the approved 2172×724 WebP.
- Mark the artwork dependency as supplied.
- Preserve the existing completed Design, Build and Verify checkboxes.
- Keep Feature 16 in-progress until final approval.

Update the corresponding /scope follow-up in spec 0015 if appropriate.

Do not modify application code, tests, or commit.

## CLAUDE · 6

*[2 tool calls: Skill, Bash]*

I'm making three line edits to `docs/scope/scope.md`, all inside feature 16 and nothing else, plus ticking the `/scope` follow-up in spec 0015.

*[1 tool call: Bash]*

I've updated feature 16 in the scope to match spec 0015, and ticked the matching follow-up in the spec. No code or tests changed, and nothing is committed.

**[docs/scope/scope.md](docs/scope/scope.md) (feature 16 only)**
- **Browse milestone:** "two row header" now reads "single row header from `md` (two lines below it)", matching AC-5 and AC-6.
- **Artwork line:** "Needs from you … at least 2400 by 800" is now "Supplied: `cyberpunk-2077-featured.webp` (text free, 3:1 WebP, 2172 by 724, 249 KB, subject on the right; approved minimum per spec 0015 AC-12)".
- **Kept:** Design, Build with its four milestones, and Verify stay ticked. The status stays `in-progress`, both in the table and beside the heading.

**[spec 0015 index.md](docs/specs/0015-visual-fidelity-polish/index.md):** the `/scope` follow-up is ticked, with a note saying what was reconciled on 2026-11-15.

**Still open**
- **Spec 0015 Follow-up:** after merge, reseed the production home banners and confirm Render's `APP_URL`. That's a deploy step, not a doc fix.
- **Spec 0015 AC-16:** it mentions a `lib/money` compare helper that doesn't exist; that wording needs `/architect`.
- **Closing feature 16:** every box it has is ticked. When you give final approval, I'd recommend running `/sync` or `/develop` to move it to `done`, and the spec's Status to `Accepted`.

---

## USER · 7

<sub>2026-11-14 22:23 UTC · [open in full transcript](../full/session-075.md#prompt-7) · record `cd8bde38-8ecc-4c1e-a975-3536d874bfab`</sub>

Feature 16 — Fix mobile checkout header scroll offset.

On /cart and /checkout below 768px, CheckoutHeader is 69px tall but the shared --header-h remains 121px.

Fix the scroll offset specifically for the checkout-header layout without changing the normal mobile header or desktop behavior.

Requirements:
- Use the actual header height for scroll padding and sticky elements.
- Preserve cart and checkout navigation, responsive layout and accessibility.
- Verify at 360px, 768px and 1280px.
- Add a focused regression test if practical.

Do not change unrelated UI, backend or spec. Do not commit.

Report the implementation and browser measurements.

## CLAUDE · 7

*[10 tool calls: Bash ×4, mcp__playwright__browser_run_code_unsafe ×3, Edit ×3]*

On `/cart` and `/checkout`, the scroll offset now uses the checkout header's real 69px height at every width. The normal shop header and desktop behave as before. Nothing is committed.

**Implementation**
- **[CheckoutHeader.tsx](client/src/components/layout/CheckoutHeader.tsx):** the `<header>` gets `data-header="checkout"`.
- **[index.css](client/src/index.css):** one new rule, `:root:has([data-header="checkout"]) { --header-h: 4.3125rem; }`. It overrides the two row value only while the checkout header is on the page. The scroll padding and the sticky summaries already read `--header-h`, so they follow it with no other changes and no JavaScript.
- **[AppLayout.test.tsx](client/src/components/layout/AppLayout.test.tsx):** two tests check that `/cart` renders the marked header and `/` doesn't. jsdom can't evaluate the CSS rule itself, so the browser numbers below are the real proof.

**Browser measurements**

| Width | Route | Header height | `--header-h` | Scroll padding | Sticky summary top |
|---|---|---|---|---|---|
| 360 | `/` | 121px | 7.5625rem | 129px | (none) |
| 360 | `/cart`, `/checkout` | 69px | 4.3125rem | **77px** (was 129px) | not sticky, as designed below `md` |
| 768 | `/` | 69px | 4.3125rem | 77px | (none) |
| 768 | `/cart`, `/checkout` | 69px | 4.3125rem | 77px | 85px |
| 1280 | `/` | 69px | 4.3125rem | 77px | (none) |
| 1280 | `/cart`, `/checkout` | 69px | 4.3125rem | 77px | 85px |

- At 360px, going from `/cart` to home through the wordmark link puts the offset back to 121px and 129px. Going back to `/cart` gives 69px and 77px again, so it follows route changes without a reload.
- No sideways scroll on any route at any width. The step links and wordmark are unchanged, and the existing checkout header tests still pass.

**Checks:** Prettier, oxlint, typecheck and the build all pass, and the rule is in the built CSS. Vitest: 428 of 428 tests pass.

**Notes**
- **Local data:** to reach `/checkout`, I registered a throwaway user (`verify-<timestamp>@example.test`) in your local database and put one item in its cart. Nothing outside your machine was touched.
- **Docs now behind:** spec 0015 AC-6 and the `--header-h` note in `client/design.md` both describe only two header heights. Neither mentions the checkout header override. You said not to change the spec, so I left them; `/architect` (spec) and `/sync` (design.md) can add it when you're ready.
