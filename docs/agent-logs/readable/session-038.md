# Session 038: Feature 9 spec 0008 documentation update

- Session ID: `e9a45d8b-4052-4f08-93fb-de56a7622133`
- Source: `e9a45d8b-4052-4f08-93fb-de56a7622133.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-12 20:54 UTC → 2026-11-12 21:18 UTC
- Prompts: 2
- Full technical transcript: [full/session-038.md](../full/session-038.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-12 20:54 UTC · [open in full transcript](../full/session-038.md#prompt-1) · record `e20e1047-97db-4b3a-a1d6-9624a75f1f8c`</sub>

`/architect`

cart

## CLAUDE · 1

I'll start with pre-flight: freshness, existing specs, the scope row for cart, and the design conversation protocol.

*[2 tool calls: Bash, Read]*

Up to date with origin. No "cart" match in the scope grep, so let me read the scope and the related specs (data model, auth, product page).

*[1 tool call: Bash]*

Feature 9 is linked. The data model spec (0002) already designs carts, so I'll read its cart parts plus the existing cart code before asking anything.

*[3 tool calls: Bash ×3]*

Prior groundwork is solid (`cart_items` table, `onAfterSignIn` hook for merge, header badge, `["me","cart"]` key convention). One more look at the offer shape and model scopes.

*[1 tool call: Bash]*

**Claude asked — Add entry** (select one):

> Where should the "Add to cart" action live on the product page?
> - **Buy box + every offer row (recommended)** — Buy box adds the best offer in one tap; each in stock offer row gets its own button so a buyer can pick a seller. Matches Eneba and the 'compare sellers' story.
> - **Offer rows only** — Simpler buy box, but the cheapest offer needs a scroll to buy on mobile.
> - **Buy box only** — One button for the best offer; picking another seller is impossible. Weakens the seller comparison feature.

**USER answered:**

Buy box + every offer row (recommended)

**Claude asked — After add** (select one):

> What happens right after a buyer adds an item?
> - **Stay, toast + badge (recommended)** — Success toast with a 'View cart' link, header badge updates. Reuses the existing Toast; no new drawer component.
> - **Go straight to /cart** — Fewest steps to checkout, but breaks browsing multiple items.
> - **Open a mini cart drawer** — Nice UX, but a new focus trapped overlay component to build and test.

**USER answered:**

Stay, toast + badge (recommended)

**Claude asked — Qty cap** (select one):

> What caps the quantity of one cart line (one offer)?
> - **Stock, and at most 10 (recommended)** — min(available keys, 10). Stops one buyer draining an offer's key pool, keeps the stepper sane.
> - **Stock only** — Matches the scope wording literally; a buyer could take all 40 keys of an offer.
> - **Fixed 1 per offer** — No quantity stepper at all. Contradicts the scope's 'change quantity'.

**USER answered:**

Stock, and at most 10 (recommended)

**Claude asked — Cart UI** (select one):

> What form does the cart take?
> - **A full /cart page (recommended)** — The header already links to /cart. Lines with stepper and remove, a summary with total and a 'Checkout' button, empty state.
> - **Drawer only, no page** — Would need the header link changed and a new overlay; harder to deep link and test.

**USER answered:**

A full /cart page (recommended)

Good. Next are the business rules: adding a duplicate, the merge, sign out, and lines that go stale.

**Claude asked — Re-add** (select one):

> A buyer adds an offer that is already in their cart. What happens?
> - **Quantity +1, capped (recommended)** — Standard store behaviour. At the cap the toast says 'You already have the maximum for this offer' and nothing changes.
> - **No change, 'Already in cart' toast** — Quantity only changes on the cart page. Simpler, but feels broken to buyers who tap twice on purpose.

**USER answered:**

Quantity +1, capped (recommended)

**Claude asked — Merge rule** (select one):

> On sign in, the guest cart merges into the account's server cart. How are lines for the same offer combined?
> - **Sum, then cap (recommended)** — Server upsert on (user_id, offer_id): quantities add, then clamp to min(stock, 10). Unknown or inactive offers are dropped. Nothing the buyer chose is lost.
> - **Guest line wins** — Guest quantity replaces the server quantity for shared offers. Favours what the buyer just did, can silently shrink a line.
> - **Larger quantity wins** — max(guest, server). Avoids surprise doubling when the same buyer added the same game on two devices.

**USER answered:**

Sum, then cap (recommended)

**Claude asked — Sign out** (select one):

> When a signed in buyer signs out, what cart do they see?
> - **Empty guest cart (recommended)** — The server cart stays saved in the account and comes back on next sign in. No account data left on a shared computer.
> - **Copy server cart into guest cart** — Cart looks unchanged after sign out, but leaks the account's cart on a shared device and double counts on the next merge.

**USER answered:**

Empty guest cart (recommended)

**Claude asked — Stale lines** (select one):

> A cart line's offer goes out of stock, or is deactivated, or its stock drops below the line's quantity. How should the cart handle it?
> - **Flag, exclude, block checkout (recommended)** — Server clamps quantity down to stock and marks the line 'reduced'; unavailable lines show greyed with 'Remove', are left out of the total, and the Checkout button is disabled until they're removed. Honest and predictable.
> - **Flag and exclude, checkout continues** — Unavailable lines stay visible but checkout simply skips them. Fewer clicks, but the order differs from the cart silently.
> - **Silently drop them** — Server deletes stale lines on read. Simplest, but items vanish with no explanation.

**USER answered:**

Flag, exclude, block checkout (recommended)

Now the interface. The stack is already settled and this feature needs no new library, so these are API and data flow choices.

**Claude asked — Guest view** (select one):

> The guest cart in localStorage holds only offer ids and quantities. How does the /cart page get names, covers, live prices, stock, and totals for a guest?
> - **Public preview endpoint (recommended)** — POST /api/v1/cart/preview with the guest lines returns the exact same cart shape as GET /cart for signed in users. One resource, server computes totals and line status for both.
> - **Store snapshots in localStorage** — Save name, cover, price at add time; client computes totals. No new endpoint, but prices and stock go stale and money math moves to the client.
> - **Server side guest cart + token** — Anonymous cart id cookie/header with rows in the DB. Contradicts spec 0002 (guest cart in localStorage) and needs a schema change.

**USER answered:**

Public preview endpoint (recommended)

**Claude asked — Write reply** (select one):

> What should the signed in cart write endpoints (add, set quantity, remove, merge) return?
> - **The whole updated cart (recommended)** — Client drops it straight into the ["me","cart"] cache; totals and statuses always come from the server; one round trip.
> - **204, then refetch** — Thinner endpoints but two round trips per click and a flash of stale totals.

**USER answered:**

The whole updated cart (recommended)

**Claude asked — Badge** (select one):

> What number does the header cart badge show?
> - **Total units (recommended)** — Sum of quantities (2 × Witcher + 1 × Elden Ring = 3). The existing aria label 'Cart, 3 items' reads naturally.
> - **Number of lines** — Counts distinct offers (= 2). Changing quantity never moves the badge.

**USER answered:**

Total units (recommended)

**Claude asked — Optimistic** (select one):

> How should quantity changes feel for a signed in buyer?
> - **Pending state, no optimism (recommended)** — Stepper disables and shows a spinner until the server answers (~100ms). No rollback logic; server is always the truth.
> - **Optimistic update with rollback** — Instant feel, but rollback on cap or stock errors adds code you must explain.

**USER answered:**

Pending state, no optimism (recommended)

Next are the edge cases and the boundary with checkout, plus one question about how the spec is written.

**Claude asked — Merge fail** (select one):

> The guest to account merge request fails on sign in (network error, server 500). Sign in itself must still succeed (spec 0006). What happens to the guest lines?
> - **Keep and retry on load (recommended)** — Guest lines stay in localStorage; the merge is retried the next time the app loads or the cart is read while signed in. localStorage is cleared only after a successful merge. Nothing is ever lost.
> - **Discard guest lines** — Simplest; buyer silently loses what they added before signing in.
> - **Keep, show error toast, no retry** — Buyer is told, but the lines sit unused in localStorage until manually handled.

**USER answered:**

Keep and retry on load (recommended)

**Claude asked — Checkout CTA** (select one):

> Feature 10 (checkout) isn't built yet. What does the cart's Checkout button do in this feature?
> - **Link to guarded /checkout placeholder (recommended)** — Guests go to sign in and come back (redirectTo), signed in buyers land on a 'Checkout coming soon' placeholder, like /orders today. Feature 10 swaps the page in. The sign in round trip and merge are testable end to end now.
> - **Disabled 'Coming soon' button** — Nothing to route yet, but the guest sign in at checkout flow can't be verified in this feature.

**USER answered:**

Link to guarded /checkout placeholder (recommended)

**Claude asked — Remove** (select one):

> How does removing a cart line work?
> - **Instant remove, no confirm (recommended)** — Trash button removes the line; the 'Removed' toast confirms. Re-adding is one click from the product page. Least code.
> - **Instant remove + Undo in toast** — Friendlier, but needs the toast to carry an action and to re-add the line with its old quantity.
> - **Confirm dialog first** — Safest, but a modal for a reversible action is friction and a new dialog component.

**USER answered:**

Instant remove, no confirm (recommended)

**Claude asked — References** (select one):

> Add a References section to the spec (where the recommendations come from, and optionally links)? The full reasoning (the Rationale) stays either way. Web fetches cost some extra tokens.
> - **No references, keep it clean (recommended)** — Rationale still explains every choice; no References section.
> - **Sources only** — Named project sources and practices, no web fetch.
> - **Sources plus web verified links** — Fetches pages to confirm links; costs extra tokens.

**USER answered:**

No references, keep it clean (recommended)

**Claude asked — Data model** (select one):

> Does this cart data model match what you want? (no migration; existing cart_items table, plus a versioned localStorage guest cart of {offer_id, quantity} lines, max 10 per line and 50 lines, live prices derived on read)
> - **This matches (recommended)** — Proceed with the table above.
> - **Change a field or limit** — E.g. different line cap, storage key, or ordering.
> - **Store price at add time** — Add a price snapshot column so the cart can warn 'price changed'; needs a migration.

**USER answered:**

This matches (recommended)

Every dimension is settled. Before writing, I'll read the spec writing rules and look at spec 0007 so this one matches its house style.

*[3 tool calls: Bash, Read ×2]*

Before writing, I'll check a few code facts the spec will name: Money, the toast API, how `authToken` syncs across tabs, and how the header gets `cartCount`.

*[1 tool call: Bash]*

I have everything I need. Writing spec 0008 now, in the same directory shape as 0007: `index.md` plus `rationale.md`.

*[2 tool calls: Write ×2]*

Spec written. Now the completion flow.

*[1 tool call: Read]*

**Claude asked — Cross check** (select one):

> Cross check this spec before you review it? (Recommended: Another model. Alpha tier, but the merge and capped upsert rules are load bearing for checkout.)
> - **Another model (recommended)** — A read only critique pass on a different, capable model, which catches what the model that wrote the spec is blind to.
> - **Same model** — A read only critique pass on this same model (fresh eyes on its own work).
> - **I'll review it myself** — No AI critique; you read docs/specs/0008-cart/index.md yourself.
> - **Skip** — Go straight to accept.

**USER answered:**

Another model (recommended)

*[1 tool call: Agent · 1 subagent]*

The draft spec is at [docs/specs/0008-cart/index.md](docs/specs/0008-cart/index.md), with its reasoning in [rationale.md](docs/specs/0008-cart/rationale.md). A cross check on a different model (Sonnet, read only) is running now. I'll bring you its findings with a recommended fix for each, then ask you to accept the spec.

_⚙ Automated `peer` message (not written by the developer; content is in the full transcript)._

## CLAUDE · 1 (continued)

Let me check gap 3 (preview write guard) myself, since the reviewer didn't open it.

*[1 tool call: Bash]*

The cross check is done. I checked gap 3 myself and it is real: `BlockPreviewWrites` returns 403 for any POST coming from a Vercel preview, so `POST /cart/preview` would break guest carts on previews.

**High:**
1. **The merge could run twice.** The sign in hook and the cart query's function would both merge the same guest lines. *Fix:* keep the cart query a plain `GET /cart`. Put the merge in one `mergeGuestCart()` that runs only one copy at a time. Call it from the sign in hook and once on app start (when there is a token and guest lines).
2. **A second tab could merge the same lines again.** *Fix:* wrap the merge in `navigator.locks.request("eneba.guestCart.merge")` (Web Locks, a browser API that lets only one tab hold a lock). Inside the lock, read storage again and skip if it is empty. Browsers without the API run it without a lock.
3. **The preview guard blocks the preview POST.** *Fix:* exempt the `cart.preview` route in `BlockPreviewWrites` and add a Pest test.

**Medium:**
4. A brand new line skips the cap. *Fix:* the insert value is also `min(quantity, cap)`, set in PHP.
5. Adding to a reduced line is undefined. *Fix:* if stored ≥ `max_quantity`, return 422 and leave the stored value unchanged.
6. The order of errors is not fixed. *Fix:* Form Request checks first, then 404 for a missing line (PATCH), then "no longer available", then "out of stock", then the quantity cap or "cart full".
7. and 8. **Badge.** *Fix:* keep `item_count` over all lines, so the badge counts what you see in the cart. A signed in badge shows no number while loading or on error. The preview write back (gap 9) makes the guest badge match the page.
9. **Preview write back.** *Fix:* write back only when values differ and the stored lines still equal the lines that were sent.
10. **Late responses after sign out.** *Fix:* call `cancelQueries(["me"])` before clearing. A mutation's `onSuccess` writes to the cache only if the token is the same one it started with.
11. **Huge ids cause a 500.** *Fix:* body `offer_id` is an integer from 1 to `PHP_INT_MAX`, and the path uses the route pattern `[0-9]{1,18}`.

**Low:**
12. The merge drops or caps lines silently; the cart page shows the result.
13. After a merge, clear only the offer ids that were sent.
14. Accept 50 lines as a soft limit under racing requests.
15. Product fields follow the same nullability as `ProductResource`.
16. The pending state is per button, and the toast keeps its existing behavior.

**Soundness notes:**
- Give the cart routes their own `cart` rate limiter (120 a minute per user), so stepper clicks plus GETs don't hit the shared `account` limit of 60.
- Note that the concurrency test is sequential. The real protection is the unique constraint plus `ON CONFLICT`.
- Narrow the wording of the "client never computes" rule to money and availability shown on screen.

**Claude asked — Gaps** (select one):

> How should I handle the cross check findings (16 gaps plus 3 notes)?
> - **Apply the recommended fixes (recommended)** — Edit the spec with every fix above, including the Web Locks merge, the preview route exemption, and a dedicated cart limiter.
> - **Let me answer each one** — Go through the gaps one by one.
> - **Leave them, I'll decide later** — Keep the spec as is; the gaps stay open.

**USER answered:**

Apply the recommended fixes (recommended)

I'll apply all the fixes as targeted edits to the spec.

*[22 tool calls: Edit ×22]*

**Claude asked — spec** (select one):

> Accept this spec, or change it?
> - **Accept, looks solid (recommended)** — Keep status Proposed (feature linked); link it on the scope and add build milestones.
> - **Change something** — Tell me what to change; targeted edits only.
> - **Rethink the approach** — Revisit a stage or the chosen option.

**USER answered:**

Accept, looks solid (recommended)

Accepted. Status stays `Proposed`, since this spec is linked to a feature. Now I'll update the feature 9 row in the scope.

*[2 tool calls: Edit ×2]*

The cart spec is accepted. Its status stays `Proposed` until `/develop` starts building, because it's linked to scope feature 9.

**What we decided:** a guest's cart is kept in the browser and a signed in buyer's cart is kept in the database. The server builds both into the same cart (live prices, stock caps, totals, and a status per line), so the browser never does money math.

**Why:** the server stays the only source of prices and stock. You need no database change, and it fits the earlier data model and sign in specs as they were designed.

**What changed:**
- **Spec 0008:** written to [index.md](docs/specs/0008-cart/index.md), with the reasoning in [rationale.md](docs/specs/0008-cart/rationale.md). It has 15 acceptance criteria, a 9 step build plan, and all 16 fixes from the Sonnet cross check.
- **Scope:** feature 9 in [scope.md](docs/scope/scope.md) is now `in-progress`, links the spec, and has 5 build milestones and a Verify box.
- **Not done:** I didn't add the spec's checkout follow-up to feature 10, because I only edit the feature being designed. The follow-up asks checkout to reuse the cart pricing rule and replace the placeholder page. It's listed in the spec's Follow-up section, so you can carry it over when you design checkout.
- **Not committed:** none of this is committed yet.

**What's next:** run `/clear` to start a fresh session. It reads the spec from disk, so nothing is lost. Then run `/develop cart`.

---

## USER · 2

<sub>2026-11-12 21:16 UTC · [open in full transcript](../full/session-038.md#prompt-2) · record `d96ae94f-fc6c-4f81-8d21-baa969e6ae23`</sub>

Update Feature 9 spec 0008 documentation only.

1. In AC-11, after a successful guest cart merge, remove a sent guest line only if both its offer_id and quantity still match the values sent in that merge request. Preserve lines that were added or modified while the request was in flight. Update the corresponding Vitest test scenario.

2. In AC-2, explicitly clarify that can_checkout may remain true when quantity_reduced is true, provided every line is available. Checkout proceeds using the effective quantity shown in the cart and must revalidate stock when creating the order.

Keep the existing architecture, endpoint contracts, and build plan unchanged.

Do not modify application code, database schema, dependencies, or unrelated files. Do not commit or push.

## CLAUDE · 2

Two targeted edits to [docs/specs/0008-cart/index.md](docs/specs/0008-cart/index.md), to clarify AC-11 and AC-2. I'm also updating the matching Value sourcing row so it agrees with AC-11.

*[4 tool calls: Edit ×4]*

I updated spec 0008 and changed nothing else: no code, no schema, no other files, and no commit or push.

- **AC-11:** after a successful merge, a guest line is removed only when both its `offer_id` and `quantity` still match what that merge request sent. Lines that were added or changed while the request was running stay in the guest cart.
- **Value sourcing:** I also updated the "which lines to clear after success" row to the same rule. Without that, the table would contradict AC-11.
- **Vitest scenario:** it now tests that a line added during the request stays, and that a sent line whose quantity changed during the request also stays.
- **AC-2:** a line with `quantity_reduced: true` no longer blocks checkout. `can_checkout` stays true as long as every line is available, checkout uses the effective quantity shown in the cart, and feature 10 must check stock again when it creates the order.

The architecture, endpoint contracts, and build plan are the same as before.
