# Verify: key delivery & order confirmation · spec 0010 · updated 2026-11-13
_Steps derived from spec 0010 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Buy 3 of one game and 1 of another, land on `/orders/:ulid` → intro "Your keys are ready. Reveal a key to copy it.", 3 + 1 masked slots `•••••-•••••-•••••`, "Redeem these keys on {platform}." and "Redeem this key on {platform}.", Network tab shows no `/keys` request → AC-5
- [x] Click the first Reveal → one `GET /orders/{ulid}/keys`; button reads "Revealing…" with `aria-disabled="true"` and keeps focus; then the code shows in a mono `<code>` with a Copy button → AC-6
- [x] With network throttled, click a second slot during the fetch → still one request, both slots reveal → AC-6
- [x] Reveal a third slot after codes loaded → no new request → AC-6
- [x] Hide a key → `<code>` gone from the DOM, Copy gone, focus stays on the toggle → AC-6
- [x] Screen reader: buttons read "Reveal key 2 of 3 for {product}", "Copy key for {product}"; status region says "Revealing keys…", then "Key revealed: key 2 of 3 for {product}", "Key hidden: …", "Key copied: …" naming the slot; reveal, hide, reveal the same key and copy it twice, and each action is read again; a failed reveal reads only the alert → AC-6 (verified through the DOM and ARIA: accessible names, `role="status"` text and new announcement nodes, `role="alert"`; not with a real screen reader such as VoiceOver)
- [x] Block the keys URL (DevTools request blocking), click Reveal → pending slots mask again, the last clicked slot shows "Could not load your key." with "Try again"; unblock, Try again → that slot reveals → AC-7
- [x] Hit the keys endpoint past 60 a minute, then Reveal on a fresh page visit → "Too many requests. Try again in N seconds." with N from `Retry-After` → AC-7
- [x] Copy → clipboard holds the code, button shows check and "Copied" for 2 s, then "Copy" → AC-8
- [x] Deny clipboard permission (or use plain http on a LAN IP, where `navigator.clipboard` is undefined) and Copy → code is selected, hint "Press Ctrl+C" (Cmd+C on Mac, "Use your device's copy option." on a phone) → AC-9
- [x] Reveal, go to `/`, come back → every slot masked, the first Reveal fetches again → AC-10
- [x] Reveal, sign out → the keys query is gone (React Query devtools or memory) and the page leaves → AC-10
- [x] At 360px: no sideways scroll, long codes wrap; Tab reaches every Reveal, Copy, Hide, Try again with the yellow focus ring → AC-11
- [x] `/ui` (dev) shows the key slot in masked, revealing, revealed, copied, copy fallback, and error states → AC-11
- [x] On the public deploy, a fresh purchase can reveal, copy, and hide its keys → AC-11

## Commands
- [x] `cd server && php artisan test --filter=OrderKeys` → 8 pass (happy path order and codes, leak check, 404 parity, 401, bad pattern, 429, read only) → AC-1, AC-2, AC-3
- [x] `curl -i -H "Authorization: Bearer $TOKEN" $API/api/v1/orders/$ULID/keys` → 200, `Cache-Control: no-store, private`, `data[].order_item_id` equals `GET /orders/$ULID` `items[].id` → AC-1, AC-3
- [x] Same request with another user's token, and with an unknown ULID → identical 404 bodies, both with `no-store`; no token → 401 with `no-store` → AC-2, AC-3
- [x] `ROUNDS=5 scripts/checkout-concurrency.sh` → all rounds pass, including the scenario 4 keys check and loser 404 → AC-4
- [x] CI `checkout-concurrency` job green on the pushed commit → AC-4, AC-11
- [x] `cd client && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build`; `cd server && composer format:check && composer analyse && php artisan test` → all green → AC-11

## Value sourcing
- [x] Owner check: a second account's token on the first account's ULID → 404, never codes
- [x] `order_item_id`: equals `SELECT id FROM order_items WHERE order_id = …` for the order
- [x] `codes` and order: equal `SELECT code FROM product_keys WHERE order_item_id = ? ORDER BY id`
- [x] Entry order: entries follow `order_items.id` ascending, same as the order's items
- [x] `no-store`: present on 200, 401, 404, 429 (from the `NoStore` route middleware)
- [x] Item `id` on `POST /checkout` and `GET /orders/{ulid}`: present, and no code appears in either body
- [x] Masked slot count before fetch: equals `quantity` per item
- [x] Slot code after fetch: slot N of an item shows `codes[N-1]` of the entry whose `order_item_id` is that item's `id`
- [x] "key N of M for {product}": N is slot index + 1, M is quantity, product is the order snapshot name
- [x] Redeem platform: the order snapshot `platform_name`, unchanged after the catalog renames the platform
- [x] 429 seconds: equal the `Retry-After` header value
- [x] Revealed or masked per slot: local, a reload masks every slot
- [x] Copy text: the clipboard holds exactly that slot's code
- [x] Copy hint: varies with pointer type and Apple user agent
- [x] Pending slots and error position: the error sits under the last clicked slot
- [x] Live region text: "Revealing keys…", "Key revealed: {slot}", "Key hidden: {slot}", "Key copied: {slot}"; repeats are announced again
- [x] Codes cache: query `["me", "order-keys", ulid]` disappears after leaving the page
- [x] Script winner ULID and item id: read from the checkout body with `jq`, matched against SQL

## Acceptance-criteria coverage
- AC-1: Pest happy path and read only, curl step · AC-2: Pest 404 parity, 401, pattern, 429, second token step · AC-3: Pest `no-store` per status and leak check · AC-4: concurrency script, CI job · AC-5: page load step, Vitest · AC-6: reveal, hide, pending, names steps, Vitest · AC-7: blocked request and 429 steps, Vitest · AC-8: copy step, Vitest · AC-9: denied clipboard step, Vitest · AC-10: leave and sign out steps, Vitest · AC-11: 360px, keyboard, `/ui`, checks, CI, public deploy steps
