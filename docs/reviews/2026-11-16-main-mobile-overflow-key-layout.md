# Review, main, 2026-11-16

**Reviewed by**: Claude Sonnet 5.5 (author on the same model family, fresh context)
**Scope**: 6 files, uncommitted
**Verdict**: Approve with nits

## Summary
Mobile polish: the key row now never wraps (nowrap code that scrolls inside itself, icon-only copy button), the order item card becomes a grid so keys use the full card width below `sm`, inputs go to 16px on touch to stop iOS zoom, and the stepper tightens. Page-level horizontal overflow is well contained (`minmax(0,1fr)`, `min-w-0`, `shrink-0`). Typecheck, lint, Prettier and all 431 tests pass. Remaining issues are a keyboard gap on the scrollable key and stale spec/design docs.

## Minor
### 🟡 Scrollable key is not keyboard reachable, `client/src/components/orders/KeySlot.tsx:61`
**Problem**: `<code>` is `overflow-x-auto whitespace-nowrap` but not focusable and has no scroll cue. Seeded keys (17 chars, ~143px at 14px mono) fit at 320px (about 176px free next to the copy button), so it is fine today. Any longer key (e.g. a 29-char Windows style key, the DB column is an unbounded string) is silently clipped, and keyboard users cannot scroll it (axe `scrollable-region-focusable`).
**Why it matters**: Hidden key text on narrow phones; spec 0010 AC-11 requires usable at 360px.
**Suggested fix**: Either add `tabIndex={0}` (global focus ring already exists) to the code element, or restore wrapping with `break-all` instead of nowrap (the previous behavior, which could not clip).

### 🟡 Spec and design.md now contradict the UI, `client/design.md:234`, `docs/specs/0010-key-delivery-order-confirmation/index.md` AC-6/AC-8
**Problem**: Both say the code "wraps" and the Copy button shows "Copy"/"Copied" text; the code now scrolls and the button is icon only. Spec 0015 does not record the decision.
**Why it matters**: Docs are the source of truth for later /check verify runs; they will flag or mislead.
**Suggested fix**: Update design.md KeySlot row and note the change in spec 0015 (or 0010 AC-6/8).

### 🟡 Icon-only copy button has no visible text or tooltip, `client/src/components/orders/KeySlot.tsx:67-78`
**Problem**: Accessible name is correct (`Copy key for X`, changes to `Copied ...`), and the live region still announces. Sighted users get only a clipboard icon, with no `title`.
**Why it matters**: Mild discoverability loss on desktop where space is not tight; the text was removed for all widths.
**Suggested fix**: Optionally show the "Copy"/"Copied" text from `sm` up (`hidden sm:inline`), keeping the icon only on phones.

## Nits
- ⚪ `client/src/components/orders/OrderItemRow.tsx:20`, `flex-1` on the details div is dead now that it is a grid item (harmless).
- ⚪ `client/src/components/checkout/Stepper.tsx:35`, `sm:size-8` sits mid-string between non-responsive classes; group responsive variants for readability.

## Strengths
- Overflow handling is sound: `grid-cols-[auto_minmax(0,1fr)]`, `min-w-0 flex-1` on the code, `shrink-0` on the copy button, children spanning both columns below `sm` and aligning under the details from `sm`; no fixed widths added.
- `text-base pointer-fine:text-sm` is a clean fix for iOS focus zoom (Tailwind 4.3 ships `pointer-fine`), applied in the shared `controlClasses` and the search input; tests were updated to assert accessible names and a new test covers icon-only behavior with `aria-hidden` icons.

## Test coverage
Existing copy tests updated correctly (accessible name instead of text) and one new test covers the icon-only control. Layout classes cannot be verified in jsdom, so no 320 to 390px overflow assertion exists; `/check verify` should measure `document.documentElement.scrollWidth` at 320/360/390 on `/orders/:ulid` with a revealed 3-key item (spec 0015 AC-23). No test covers `OrderItemRow` without children (the `row-span-2` implicit row is harmless visually).
