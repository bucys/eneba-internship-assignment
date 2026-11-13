#!/usr/bin/env bash
# Proves checkout idempotency and concurrency with real parallel HTTP requests (spec 0009 AC-6, AC-18).
# Pest cannot: RefreshDatabase runs each test in one transaction on one connection.
#
# Needs: docker compose up -d, PHP, curl, jq, uuidgen. Runs against eneba_test only; dev data is never touched.
# Usage: scripts/checkout-concurrency.sh            (20 rounds)
#        ROUNDS=3 scripts/checkout-concurrency.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$ROOT/server"
PORT="${PORT:-8001}"
API="http://127.0.0.1:$PORT/api/v1"
ROUNDS="${ROUNDS:-20}"
WORK="$(mktemp -d)"

# The test DB, an in memory cache per request (so limiters never trip across 100s of requests),
# and no log file noise. Process env wins over server/.env, which points at the dev DB.
export APP_ENV=local DB_URL= DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 \
  DB_DATABASE=eneba_test DB_USERNAME=eneba DB_PASSWORD=eneba CACHE_STORE=array LOG_CHANNEL=null

GOOD_EXPIRY="12/$(($(date -u +%y) + 2))"
EXPIRED="01/20"

fail() {
  echo "FAIL [$SCENARIO, round $ROUND]: $*" >&2
  exit 1
}

# Background jobs of the current scenario. A bare `wait` would also wait for the server.
JOBS=()
spawn() {
  "$@" &
  JOBS+=($!)
}
wait_jobs() {
  wait "${JOBS[@]}"
  JOBS=()
}

sql() {
  docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
    psql -U eneba -d eneba_test -v ON_ERROR_STOP=1 -qtA -c "$1"
}

cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  pkill -f "php -S 127.0.0.1:$PORT" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Prints "<token> <user id>".
register() {
  curl -sf -X POST "$API/auth/register" -H 'Accept: application/json' -H 'Content-Type: application/json' \
    -d "{\"name\":\"Buyer\",\"email\":\"buyer-$(uuidgen | tr 'A-Z' 'a-z')@example.test\",\"password\":\"correct horse battery\"}" |
    jq -r '"\(.data.token) \(.data.user.id)"'
}

add_to_cart() { # token offer_id quantity
  curl -sf -o /dev/null -X POST "$API/cart/items" -H 'Accept: application/json' -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $1" -d "{\"offer_id\":$2,\"quantity\":$3}"
}

cart_total() { # token
  curl -sf "$API/cart" -H 'Accept: application/json' -H "Authorization: Bearer $1" | jq -r '.data.total.amount'
}

# Writes "<status> <ulid or error key>" to the out file.
checkout() { # token key expected_total expiry out_file
  local body status
  body="$(jq -nc --argjson total "$3" --arg expiry "$4" \
    '{card_number:"4242 4242 4242 4242",card_expiry:$expiry,card_cvc:"123",card_name:"Jane Buyer",expected_total:$total}')"
  status="$(curl -s -o "$5.body" -w '%{http_code}' -X POST "$API/checkout" -H 'Accept: application/json' \
    -H 'Content-Type: application/json' -H "Authorization: Bearer $1" -H "Idempotency-Key: $2" -d "$body")"
  echo "$status $(jq -r '.data.ulid // (.errors // {} | keys | join(",")) // ""' "$5.body")" >"$5"
}

# An offer that can be bought, with at least $1 unsold keys and in no other buyer's cart this round.
pick_offer() {
  sql "SELECT o.id FROM offers o JOIN products p ON p.id = o.product_id
       WHERE o.is_active AND p.is_active
         AND (SELECT count(*) FROM product_keys k WHERE k.offer_id = o.id AND k.order_item_id IS NULL) >= $1
         AND NOT EXISTS (SELECT 1 FROM cart_items c WHERE c.offer_id = o.id)
       ORDER BY random() LIMIT 1"
}

# Holds the user's cart lock from psql for $2 seconds, like a slow checkout would.
hold_user_lock() { # user_id seconds
  { echo "BEGIN; SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE;"; sleep "$2"; echo "COMMIT;"; } |
    docker compose -f "$ROOT/docker-compose.yml" exec -T postgres psql -U eneba -d eneba_test -qtA >/dev/null
}

scenario_same_key() {
  SCENARIO="1 same user, same key, 5 parallel"
  local token uid offer total key i
  read -r token uid <<<"$(register)"
  offer="$(pick_offer 1)"
  add_to_cart "$token" "$offer" 1
  total="$(cart_total "$token")"
  key="$(uuidgen)"

  for i in 1 2 3 4 5; do spawn checkout "$token" "$key" "$total" "$GOOD_EXPIRY" "$WORK/s1.$i" ; done
  wait_jobs

  [[ "$(cat "$WORK"/s1.? | grep -c '^201 ')" == 1 ]] || fail "expected one 201: $(cat "$WORK"/s1.?)"
  [[ "$(cat "$WORK"/s1.? | grep -c '^200 ')" == 4 ]] || fail "expected four 200: $(cat "$WORK"/s1.?)"
  [[ "$(cut -d' ' -f2 "$WORK"/s1.? | sort -u | wc -l | tr -d ' ')" == 1 ]] || fail "ulids differ: $(cat "$WORK"/s1.?)"
  [[ "$(sql "SELECT count(*) FROM orders WHERE user_id = $uid AND idempotency_key = '$key'")" == 1 ]] || fail "order count is not 1"
}

scenario_replay_while_running() {
  SCENARIO="2 replay while the first is running"
  local token uid offer total key
  read -r token uid <<<"$(register)"
  offer="$(pick_offer 1)"
  add_to_cart "$token" "$offer" 1
  total="$(cart_total "$token")"
  key="$(uuidgen)"

  spawn hold_user_lock "$uid" 2
  sleep 0.4
  spawn checkout "$token" "$key" "$total" "$GOOD_EXPIRY" "$WORK/s2.a"
  sleep 0.5
  spawn checkout "$token" "$key" "$total" "$EXPIRED" "$WORK/s2.b"
  wait_jobs

  [[ "$(cut -d' ' -f1 "$WORK/s2.a")" == 201 ]] || fail "A expected 201, got $(cat "$WORK/s2.a")"
  [[ "$(cut -d' ' -f1 "$WORK/s2.b")" == 200 ]] || fail "B expected 200, got $(cat "$WORK/s2.b")"
  [[ "$(cut -d' ' -f2 "$WORK/s2.a")" == "$(cut -d' ' -f2 "$WORK/s2.b")" ]] || fail "B did not return A's order"
}

scenario_two_keys() {
  SCENARIO="3 same user, two keys in parallel"
  local token uid offer total
  read -r token uid <<<"$(register)"
  offer="$(pick_offer 1)"
  add_to_cart "$token" "$offer" 1
  total="$(cart_total "$token")"

  spawn checkout "$token" "$(uuidgen)" "$total" "$GOOD_EXPIRY" "$WORK/s3.a"
  spawn checkout "$token" "$(uuidgen)" "$total" "$GOOD_EXPIRY" "$WORK/s3.b"
  wait_jobs

  local results
  results="$(cat "$WORK/s3.a" "$WORK/s3.b" | cut -d' ' -f1-2 | sort | tr '\n' ';')"
  [[ "$(cat "$WORK/s3.a" "$WORK/s3.b" | grep -c '^201 ')" == 1 ]] || fail "expected one 201: $results"
  grep -qh '^422 cart$' "$WORK/s3.a" "$WORK/s3.b" || fail "expected one 422 cart: $results"
  [[ "$(sql "SELECT count(*) FROM orders WHERE user_id = $uid")" == 1 ]] || fail "order count is not 1"
  [[ "$(sql "SELECT count(*) FROM cart_items WHERE user_id = $uid")" == 0 ]] || fail "cart not empty"
}

scenario_last_key() {
  SCENARIO="4 two buyers, one last key"
  local t1 u1 t2 u2 offer total1 total2 sold_before
  offer="$(pick_offer 2)"

  # Keep exactly one unsold key: attach the rest to a throwaway order that still passes every check.
  local seller_user extra price
  read -r _ seller_user <<<"$(register)"
  extra="$(sql "SELECT count(*) - 1 FROM product_keys WHERE offer_id = $offer AND order_item_id IS NULL")"
  price="$(sql "SELECT price_cents FROM offers WHERE id = $offer")"
  sql "WITH o AS (
         INSERT INTO orders (ulid, user_id, status, total_cents, currency, idempotency_key, paid_at, created_at, updated_at)
         VALUES (lower('$(uuidgen | tr -d - | cut -c1-26)'), $seller_user, 'paid', $((extra * price)), 'EUR', '$(uuidgen)', now(), now(), now())
         RETURNING id),
       i AS (
         INSERT INTO order_items (order_id, offer_id, product_id, quantity, unit_price_cents, product_name, platform_name, region_name, seller_name, created_at, updated_at)
         SELECT o.id, of.id, of.product_id, $extra, $price, 'x', 'x', 'x', 'x', now(), now() FROM o, offers of WHERE of.id = $offer
         RETURNING id)
       UPDATE product_keys SET order_item_id = (SELECT id FROM i), sold_at = now()
       WHERE id IN (SELECT id FROM product_keys WHERE offer_id = $offer AND order_item_id IS NULL ORDER BY id LIMIT $extra)" >/dev/null

  read -r t1 u1 <<<"$(register)"
  read -r t2 u2 <<<"$(register)"
  add_to_cart "$t1" "$offer" 1
  add_to_cart "$t2" "$offer" 1
  total1="$(cart_total "$t1")"
  total2="$(cart_total "$t2")"
  sold_before="$(sql "SELECT count(*) FROM product_keys WHERE offer_id = $offer AND order_item_id IS NOT NULL")"
  local items_before
  items_before="$(sql "SELECT count(*) FROM order_items WHERE offer_id = $offer")"

  spawn checkout "$t1" "$(uuidgen)" "$total1" "$GOOD_EXPIRY" "$WORK/s4.a"
  spawn checkout "$t2" "$(uuidgen)" "$total2" "$GOOD_EXPIRY" "$WORK/s4.b"
  wait_jobs

  local results
  results="$(cat "$WORK/s4.a" "$WORK/s4.b" | tr '\n' ';')"
  [[ "$(cat "$WORK/s4.a" "$WORK/s4.b" | grep -c '^201 ')" == 1 ]] || fail "expected one 201: $results"
  [[ "$(cat "$WORK/s4.a" "$WORK/s4.b" | grep -c '^409 ')" == 1 ]] || fail "expected one 409: $results"
  [[ "$(sql "SELECT count(*) FROM product_keys WHERE offer_id = $offer AND order_item_id IS NOT NULL")" == $((sold_before + 1)) ]] ||
    fail "key not sold exactly once"
  [[ "$(sql "SELECT count(*) FROM order_items WHERE offer_id = $offer")" == $((items_before + 1)) ]] || fail "expected one new order item"

  local loser
  grep -q '^409 ' "$WORK/s4.a" && loser="$u1" || loser="$u2"
  [[ "$(sql "SELECT count(*) || ':' || coalesce(sum(quantity), 0) FROM cart_items WHERE user_id = $loser AND offer_id = $offer")" == "1:1" ]] ||
    fail "loser's cart changed"
}

scenario_cart_edit_during_checkout() {
  SCENARIO="5 cart edit during checkout"
  local token uid offer other total status
  read -r token uid <<<"$(register)"
  offer="$(pick_offer 2)"
  add_to_cart "$token" "$offer" 1
  total="$(cart_total "$token")"

  spawn hold_user_lock "$uid" 1.5
  sleep 0.4
  spawn checkout "$token" "$(uuidgen)" "$total" "$GOOD_EXPIRY" "$WORK/s5.a"
  sleep 0.4
  status="$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$API/cart/items/$offer" -H 'Accept: application/json' \
    -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d '{"quantity":2}')"
  wait_jobs
  [[ "$(cut -d' ' -f1 "$WORK/s5.a")" == 201 ]] || fail "checkout expected 201, got $(cat "$WORK/s5.a")"
  [[ "$status" == 404 ]] || fail "PATCH expected 404, got $status"

  # An add for a different offer during checkout survives it.
  offer="$(pick_offer 1)"
  add_to_cart "$token" "$offer" 1
  total="$(cart_total "$token")"
  other="$(pick_offer 1)"

  spawn hold_user_lock "$uid" 1.5
  sleep 0.4
  spawn checkout "$token" "$(uuidgen)" "$total" "$GOOD_EXPIRY" "$WORK/s5.b"
  sleep 0.4
  spawn add_to_cart "$token" "$other" 1
  wait_jobs
  [[ "$(cut -d' ' -f1 "$WORK/s5.b")" == 201 ]] || fail "second checkout expected 201, got $(cat "$WORK/s5.b")"
  [[ "$(sql "SELECT offer_id FROM cart_items WHERE user_id = $uid")" == "$other" ]] || fail "the new line did not survive"
}

check_invariants() {
  SCENARIO="6 global invariants"
  local bad
  bad="$(sql "SELECT count(*) FROM order_items i
              LEFT JOIN (SELECT order_item_id, count(*) n FROM product_keys WHERE order_item_id IS NOT NULL GROUP BY order_item_id) k
                ON k.order_item_id = i.id
              WHERE coalesce(k.n, 0) <> i.quantity")"
  [[ "$bad" == 0 ]] || fail "$bad order items do not have exactly quantity sold keys"
  bad="$(sql "SELECT count(*) FROM orders o
              WHERE o.total_cents <> (SELECT coalesce(sum(quantity * unit_price_cents), 0) FROM order_items WHERE order_id = o.id)")"
  [[ "$bad" == 0 ]] || fail "$bad orders whose total differs from their items"
  bad="$(sql "SELECT count(*) FROM product_keys k JOIN order_items i ON i.id = k.order_item_id WHERE k.offer_id <> i.offer_id")"
  [[ "$bad" == 0 ]] || fail "$bad keys sold under another offer"
}

echo "Resetting eneba_test and seeding the catalog..."
(cd "$SERVER_DIR" && php artisan migrate:fresh --seed --force >/dev/null)

# php -S directly: artisan serve drops DB_* env vars and needs --no-reload for workers.
# Laravel's router script reads the public path from the working directory.
(cd "$SERVER_DIR/public" && PHP_CLI_SERVER_WORKERS=8 exec php -S "127.0.0.1:$PORT" \
  ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php >"$WORK/server.log" 2>&1) &
SERVER_PID=$!
for _ in $(seq 1 50); do curl -sf "http://127.0.0.1:$PORT/up" >/dev/null && break || sleep 0.2; done
curl -sf "http://127.0.0.1:$PORT/up" >/dev/null || { cat "$WORK/server.log"; echo "server did not start" >&2; exit 1; }

for ROUND in $(seq 1 "$ROUNDS"); do
  scenario_same_key
  scenario_replay_while_running
  scenario_two_keys
  scenario_last_key
  scenario_cart_edit_during_checkout
  check_invariants
  echo "round $ROUND/$ROUNDS passed"
done

echo "All scenarios passed $ROUNDS rounds."
