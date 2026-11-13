# 0010. Key delivery: rationale

Decision record for [index.md](index.md). `/develop` builds from `index.md` and can skip this file.

## Context

The purchase journey stops one step short. Spec 0009 sells keys inside the checkout transaction: each paid unit gets exactly one unsold key, the stock drops, and a concurrency script proves no key is sold twice. The buyer then lands on `/orders/:ulid`, which shows what they bought but not the keys themselves. A digital key store that never shows the key has not delivered anything, so this is the step the assignment's end to end purchase flow is judged on.

A key code is the product. Anyone who reads it can redeem it, and it cannot be taken back. So the forces are about exposure: which responses carry codes, who can read them, how long they stay in caches and browser memory, and what is visible on a screen someone else might see. Spec 0002 already rules that a code leaves the server only for the user it was sold to, and that codes are plain text at rest because they are fake seed data.

The page also has to work for people. Buyers often buy several units, need to copy long codes reliably on phones and desktops, and must not be stuck when the clipboard is blocked (permission prompts, older browsers, or an insecure context). Feature 12 (order history) will show the same keys again, so whatever is built here is reused there.

Constraints: the existing stack (Laravel 13 API with API Resources and owner scoped actions, React with TanStack Query), a 3 to 4 day total budget for the whole assignment, no schema change wanted this late, and the `Beta` tier for this feature (verify and tests).

## Options considered

### Option 1: Keys inside the Order resource

Add `keys: string[]` to each `OrderItemResource`. `POST /checkout` and `GET /orders/{ulid}` both carry them; the confirmation page renders from the cache checkout already fills.

**Pros**:
- No new endpoint and no extra request; keys show the instant the page opens.
- One response shape for the client and feature 12.

**Cons**:
- Codes go out on every order read, including list or detail reads that never show them, and sit in the order cache for as long as it lives.
- The checkout response carries secrets, which widens what any logging or error tooling in that path might capture.

### Option 2: Keys only on GET /orders/{ulid}

Keep the checkout response key free; add codes to the order detail read only.

**Pros**:
- No new endpoint; checkout stays clean.

**Cons**:
- The confirmation page must refetch after landing (the checkout response no longer has everything), so it pays the extra round trip anyway.
- The order detail still carries codes whenever it is read, and they live in the order cache.

### Option 3: Separate owner only keys endpoint, fetched on the first Reveal

`GET /orders/{ulid}/keys` returns every code of one order, owner scoped, `no-store`. The page fetches it only when the buyer clicks Reveal, keeps it only while mounted, and reveals one slot at a time.

**Pros**:
- Codes leave the server only on an explicit request from the owner, and never live in an HTTP cache or in memory after the page closes.
- The order resource stays secret free, so every other read and the checkout response are safe to cache, log, or reuse.
- One fetch per visit serves every slot; feature 12 reuses it unchanged.

**Cons**:
- One more endpoint, query, and set of loading and error states.
- A short "Revealing…" wait on the first click.
- The client joins two shapes by item id.

### Option 4: Per key reveal endpoint with server side tracking

`POST /orders/{ulid}/keys/{id}/reveal` returns one code and records `revealed_at`.

**Pros**:
- The tightest exposure (one code per request) and a durable record a refund policy could use.

**Cons**:
- A migration, a write endpoint, public key ids, and one request per key; the record has no consumer because refunds are out of scope.

## Rationale

The force that decides this is that a code is the product and cannot be revoked. Options 1 and 2 put codes in a resource that is read for other reasons (rendering items, totals, and later the history list), so every such read becomes a secret bearing response and every cache entry holds them. Option 3 keeps secrets on one narrow path that is read only on purpose, is marked `no-store`, and is dropped from memory when the page closes. The engineer chose it over the simpler Option 1; that costs one extra request and a loading state, which is small next to keeping the Order resource safe to cache and reuse in feature 12.

Option 4's tracking is what a real store does to refuse refunds after a reveal, but refunds and disputes are out of scope, so `revealed_at` would be a column nothing reads, plus a migration and a write path to test. Client only reveal state keeps the feature read only and idempotent; the README records what a real store would add.

Within Option 3, fetching the whole order once (not per item or per key) keeps one request per visit and needs only the item id the Order resource now exposes. Matching by explicit `order_item_id` instead of by position costs one field and removes a silent failure if either ordering ever drifts. Reusing the `account` limiter is enough: codes are already owner scoped, and a stolen token exposes the account either way. Dropping codes on unmount (`gcTime: 0`) was the engineer's pick over keeping them until sign out; it trades an extra request on return visits for the shortest time codes sit in memory, which fits the same exposure reasoning.

On the page, masked slots with per key Reveal and Hide match the Eneba pattern and the scope wording, and guard against shoulder surfing and screen sharing. Inline "Copied" feedback keeps confirmation next to the key that was copied, which matters when an order has several. The select plus hint fallback means a blocked clipboard never leaves the buyer without their key.

Decisions made at write time (recommended, the engineer may override):
- **`NoStore` route middleware** over setting the header in the controller, so 401, 404, and 429 responses carry `no-store` too. Runner up: controller header only (misses error responses, which carry no codes, so it is acceptable but less uniform).
- **Default project retry policy** for the keys query over `retry: false`, so a brief network blip retries before the inline error shows. Runner up: `retry: false` for a faster error.
- **Slot count from `quantity` before the fetch, `codes.length` after**, so the server stays the source of truth if the invariant ever broke. Runner up: always `quantity`.
- **Intro sentence and plural redeem line** on the page, from existing snapshots, so the buyer knows what to do. Runner up: no text.
