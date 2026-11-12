# Verify: Cart · spec 0008 · updated 2026-11-12
_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] As a guest, open a product page: the buy box and every in stock offer row have "Add to cart"; out of stock rows have none → AC-9
- [ ] Click "Add to cart" in the buy box → success toast "Added to cart." with a focusable "View cart" link to `/cart`; header link reads "Cart, 1 item" → AC-9, AC-10
- [ ] Add a second offer from another row → badge "Cart, 2 items"; `localStorage["eneba.guestCart"]` is `{ version: 1, lines: [...] }` in add order → AC-8, AC-10
- [ ] Click add on a line already at `min(stock, 10)` → error toast "You already have the maximum for this offer." → AC-8, AC-9
- [ ] Reload `/cart` → both lines still there, totals shown by the server (unit price, line total, Total) → AC-8, AC-12
- [ ] Open a second tab on `/cart`, change a quantity in the first → the second tab updates without a reload → AC-8
- [ ] Put bad JSON or `version: 2` in `eneba.guestCart` and reload → empty cart, no crash → AC-8
- [ ] Stepper: minus is disabled at 1, plus at `max_quantity`; both have accessible names; the value is announced → AC-12
- [ ] Remove a line → toast "Removed from cart."; button name is "Remove {product name}" → AC-12
- [ ] Empty the cart → `EmptyState` "Your cart is empty" with "Browse games" link to `/`; network panel shows no cart request for a guest with no lines → AC-13
- [ ] Throttle the network (or stop the API) on `/cart` → skeleton, then "Waking up the server" after 3 s; on failure `ErrorState` whose "Try again" works → AC-13
- [ ] Tab title on `/cart` is `Cart | Eneba Marketplace (demo)` → AC-13
- [ ] As a guest with lines, click Checkout → `/login?redirectTo=/checkout`; sign in → land on "Checkout is coming soon" with a link back to `/cart`; guest storage key gone; badge shows the merged count → AC-11, AC-14
- [ ] Signed in user who already had the same offer: merge sums and caps at `min(stock, 10)` → AC-6, AC-11
- [ ] Signed in, click Add to cart → only that button shows a spinner and ignores clicks until done → AC-9
- [ ] Signed in, change a quantity → that line's controls are disabled while the request runs → AC-12
- [ ] Sign out → badge shows the (empty) guest cart; sign in again → the server cart is back → AC-11
- [ ] Deactivate one offer in the DB (`offers.is_active = false`) → line muted, "No longer available", Remove only, left out of Total, Checkout disabled with "Remove unavailable items to continue." → AC-2, AC-12
- [ ] Mark keys sold so stock drops below the stored quantity → line shows the lowered quantity and "Only N available, so we lowered the quantity."; Checkout still enabled → AC-2, AC-12
- [ ] At 360px `/cart` is one column with no sideways scroll; from `md` lines and summary sit side by side → AC-15
- [ ] Tab through the product page and `/cart` → every control reachable with the yellow focus ring → AC-15
- [ ] Repeat the guest add → sign in → merge → placeholder path on the public deploy → AC-15

## Value sourcing

- [ ] Change `offers.price_cents` for a line in the DB, reload `/cart` → new unit price and totals (prices are live, never stored in the cart) → AC-2
- [ ] Line `available` follows offer active, product active, and unsold key count: flip each one in turn → AC-2
- [ ] Stock 40, stored 10 → `max_quantity` 10 (cap) ; stock 3 → `max_quantity` 3 → AC-2
- [ ] Badge: guest shows the sum of stored quantities; signed in shows `item_count`, which includes unavailable lines → AC-10
- [ ] Signed in endpoints never take a `user_id`: user B's PATCH on user A's offer returns 404 → AC-7
- [ ] Preview from a Vercel preview origin succeeds; `POST /cart/items` from that origin gets 403 → AC-5
- [ ] Merge clears only guest lines whose offer and quantity match what was sent (add a line during a slow merge; it stays) → AC-11
- [ ] Preview write back skipped when storage changed after the request was sent → AC-8

## Commands

- [ ] `cd server && php artisan test --filter=Cart` → 60 cart tests pass → AC-1 to AC-7
- [ ] `cd client && npx vitest run src/lib/guestCart.test.ts src/lib/cart.test.ts` → pass → AC-8, AC-11
- [ ] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` → all pass → AC-15
- [ ] `cd server && composer format:check && composer analyse && php artisan test` → all pass → AC-15
- [ ] CI green on the pushed commit → AC-15

## Acceptance-criteria coverage

- AC-1 to AC-7: Pest (`tests/Feature/Cart/`) plus the Value sourcing steps
- AC-8, AC-10, AC-11: Vitest plus the guest, tab, badge, and sign in steps
- AC-9, AC-12, AC-13, AC-14: manual UI steps
- AC-15: 360px, keyboard, checks, CI, and public deploy steps
