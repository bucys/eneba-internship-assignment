# Session 073: client/design.md sync with Feature 16

- Session ID: `c16f0b61-acb6-4ae7-be85-24e937a309e0`
- Source: `c16f0b61-acb6-4ae7-be85-24e937a309e0.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-14 21:36 UTC → 2026-11-14 21:44 UTC
- Prompts: 2
- Full technical transcript: [full/session-073.md](../full/session-073.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-14 21:36 UTC · [open in full transcript](../full/session-073.md#prompt-1) · record `5841b53d-87a9-4b23-a3ec-ce649c0c186d`</sub>

/architect visual fidelity & polish

Amend spec 0015 to reflect the final approved Feature 16 design decisions.

1. AC-5 — Header:
   - Use a single header row from 768px upward.
   - Keep logo, search, Store, cart and account.
   - Preserve the mobile header with search on its own row.
   - Remove the second desktop navigation row.
   - Keep the shared sticky offset variable aligned with the actual header height.

2. AC-11 — Responsive hero:
   - Below 1024px, show one featured banner using the same artwork and banner data as desktop.
   - Below 640px, show the artwork above a compact text strip.
   - From 640px to 1023px, overlay the text on the left gradient.
   - At 1024px and above, preserve the existing split hero.
   - No mobile carousel or additional artwork.
   - Preserve loading, error, empty and image-failure states.

3. AC-12 — Featured artwork:
   - Accept the existing 2172x724, 249 KB WebP as an approved deviation from the original 2400x800 minimum.
   - Preserve the 3:1 ratio and remaining artwork requirements.

4. AC-13 — Store results:
   - Use the existing "1 result" / "N results" wording instead of "Results found: N".

Also review the Store sort dropdown requirements against the current implementation. Update the spec only if the approved custom dropdown is already implemented.

Update the relevant acceptance criteria, rationale, implementation notes and verification steps.

Cross-check the amended spec against the current code and tests. Identify any remaining contradictions.

Do not change application code, expand scope, or commit.

Report the exact amendments and any unresolved issues.

## CLAUDE · 1

*[7 tool calls: Skill, Bash ×3, Read ×3]*

I've read spec 0015 and the header and hero code. Next I'm checking the Store page, the sort control, and the related tests.

*[6 tool calls: Bash ×6]*

Custom sort dropdown is built, and existing Store tests were edited to drive it. Checking one more test diff, then writing the amendments.

*[18 tool calls: Bash, Edit ×17]*

Spec index updated. Now the rationale and the verify checklist.

*[12 tool calls: Edit ×10, Bash ×2]*

I've amended spec 0015 so it matches the shipped Feature 16 code. No application code was changed and nothing was committed.

## Amendments

**[index.md](docs/specs/0015-visual-fidelity-polish/index.md)**
- **AC-5:** From 768px up the header is one row: logo, search, Store (icon and label), cart, account. The second nav row and `<nav aria-label="Primary">` are gone. Store is current on any `/store` URL, whatever the query.
- **AC-6:** Below 768px, the logo and three icons sit on one line, with search full width on its own line. `--header-h` is now stated as 7.5625rem below 768px and 4.3125rem from 768px. That matches the real header heights (121px and 69px). Both values must change together whenever the header changes.
- **AC-7:** The platform URLs are written out here now, since AC-5 no longer lists them.
- **AC-8:** The loading skeleton below 1024px is now the compact one, not the old rail.
- **AC-11:** Below 1024px there is one `CompactFeaturedBanner` built from the first banner and the same art as desktop.
  - Below 640px the art sits above a text strip.
  - From 640px to 1023px the text overlays the left gradient.
  - There is no carousel, no rail and no extra art.
  - Loading, error, empty and broken image states are kept.
  - From 1024px the split hero is unchanged.
- **AC-12:** The 2172 by 724, 249 KB WebP is recorded as an approved deviation. The 3:1 ratio, no text in the image, WebP, the 300 KB limit and the subject on the right still apply.
- **AC-13:**
  - The count uses `resultCountLabel` ("1 result" / "N results").
  - **Sort dropdown: the custom one is already built** ([SortSelect.tsx](client/src/components/store/SortSelect.tsx), plus its tests), so I wrote it into the spec. It replaces the native `Select` from spec 0012, with the same options and URL behaviour.
  - The old "CSS moves it" line is replaced by what the code does: one sort control, in the toolbar row at every width.
- **AC-14 and AC-18:** Small wording changes ("sort control", "Store link" instead of "nav row").
- **AC-22:** The allowed test edits now include the hero layout below 1024px and the Store tests that click the custom sort option instead of calling `selectOptions`. Their assertions are unchanged.
- **Other sections:** I also updated the summary, value sourcing table, test scenarios, build plan steps 0, 4, 5 and 8, consequences (banners 4+ now never show, no tagline on mobile, no platform links in the header), and follow ups (art item ticked, new `/sync` and `/scope` items).

**[rationale.md](docs/specs/0015-visual-fidelity-polish/rationale.md):** A new "Amendments (2026-11-14)" section gives the reason for each change. Two audit rows are annotated.

**[verify.md](docs/specs/0015-visual-fidelity-polish/verify.md):**
- The two old open points are removed, because the spec now covers them.
- I rewrote the header, hero and store steps.
- I added steps for the header height against `--header-h`, the compact hero at 360, 768 and below 1024px, the art file, and sort keyboard behaviour.
- The coverage line now names `SortSelect.test.tsx`.

## Unresolved issues (not edited)

1. **Wrong header height in [client/design.md:135](client/design.md#L135):** it says `--header-h` is 7.0625rem from 768px. The code uses 4.3125rem.
2. **Other stale entries in design.md:**
   - [Line 195](client/design.md#L195) still describes `HeroStrip` and a portrait `ScrollRail`. The code has `HeroCompact` and `CompactFeaturedBanner` instead.
   - [Line 95](client/design.md#L95) still mentions a "header nav link".
   - There is no component row for `SortSelect`, though its contrast rows exist.
3. **Stale [scope.md](docs/scope/scope.md):** feature 16 still says "two row header" and still asks for art "at least 2400 by 800". `/scope` owns that file, so I only added a follow up in the spec.
4. **Specs 0012 AC-6 and 0014 AC-10 are now partly replaced.** They need the "partly replaced" flag from `/sync`, which is listed in the follow ups.
5. **The compact hero hides the tagline.** I wrote that into AC-11 because the code and its test (`"…no tagline"`) do it. Your brief didn't mention taglines, so please confirm you want it.
6. **No checks were rerun.** I only read the code and tests. The next step is `/check verify` against the amended `verify.md`.

---

## USER · 2

<sub>2026-11-14 21:42 UTC · [open in full transcript](../full/session-073.md#prompt-2) · record `713a7401-5219-4f6e-960e-8a91783113df`</sub>

Update client/design.md to match the approved Feature 16 implementation and amended spec 0015.

Fix:
- Header height tokens and responsive behavior.
- Stale references to the removed desktop navigation row.
- Stale HeroStrip and mobile carousel descriptions.
- Document CompactFeaturedBanner and the current responsive hero layout.
- Add the missing SortSelect component description.

Cross-check values and component names against the actual implementation.

Documentation only. Do not modify application code, tests, or spec 0015. Do not commit.

## CLAUDE · 2

*[2 tool calls: Bash ×2]*

Facts checked: `BannerTile` is deleted and nothing uses `black/90` any more. The struck price on `surface-deep` (7.9:1) has no contrast row yet. Editing design.md now.

*[16 tool calls: Edit ×14, Bash ×2]*

I've updated [design.md](client/design.md) to match the built code. I didn't touch application code, tests or spec 0015, and nothing is committed. I checked every value against the source files, but I didn't run the app or the test suite.

- **Header height:** `--header-h` is now listed as 7.5625rem (121px) below `md` and 4.3125rem (69px) from `md`. The old note said 7.0625rem. The note also explains where those numbers come from, and says to change both together.
- **Desktop nav row:** I removed the stale references. The "header nav link hover" contrast row now names the Store and Sign in hover, and `CheckoutHeader` says "Store link" instead of "nav".
- **Hero:**
  - The `HeroStrip` row is now `HeroCompact`.
  - It describes the split hero from `lg`, the single compact banner below `lg` (no carousel, no rail), and both skeletons.
  - The `HomePageSkeleton` row now says it uses `HeroSkeleton`.
- **CompactFeaturedBanner:** new row covering the link and its text, no tagline, the art band and text strip below `sm`, the `h-64` overlay from `sm`, and what happens when the image fails.
- **SortSelect:** new row covering the trigger, the popup, its colours, where the options come from, focus and the full keyboard behaviour. I also added a note on the store toolbar layout and the "1 result" / "N results" count.
- **Two things beyond your list:**
  - I removed the `BannerTile` row, its six `black/90` contrast rows and the `black/90` worst case note, because that component was deleted and nothing uses `black/90` any more.
  - I added a missing contrast row: the struck list price (`fg-muted`) on `surface-deep` is 7.9:1. It shows in the side tile and the compact banner.

One gap left in [client/AGENTS.md](client/AGENTS.md): its `store/` list doesn't name `SortSelect`, and its `product/` list still mentions "hero". `/sync` owns that file, so I left it alone.
