<?php

namespace App\Actions\Checkout;

use App\Actions\Cart\BuildCart;
use App\Enums\OrderStatus;
use App\Exceptions\CartChangedException;
use App\Models\Order;
use App\Models\ProductKey;
use App\Models\User;
use App\Payments\CardDetails;
use App\Payments\PaymentGateway;
use App\Support\CartLine;
use App\Support\CartLock;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use LogicException;

/**
 * Buys the whole server cart in one transaction (spec 0009 AC-1, AC-4, AC-18): any failure rolls
 * back the order, its items, and the sold keys, and leaves the cart as it was.
 *
 * The simulated charge runs inside the transaction. A real gateway must not (see spec 0009 Consequences).
 */
class PlaceOrder
{
    public function __construct(
        private BuildCart $buildCart,
        private PaymentGateway $gateway,
    ) {}

    /**
     * @return array{order: Order, created: bool}
     */
    public function handle(User $user, string $idempotencyKey, int $expectedTotal, #[\SensitiveParameter] CardDetails $card): array
    {
        $result = DB::transaction(function () use ($user, $idempotencyKey, $expectedTotal, $card) {
            CartLock::forUser($user);

            // A request with this key may have committed after the controller's replay lookup.
            $existing = $user->orders()->where('idempotency_key', $idempotencyKey)->first();

            if ($existing !== null) {
                return ['order' => $existing, 'created' => false];
            }

            $cart = $this->buildCart->forUser($user);

            if ($cart->lines === []) {
                throw ValidationException::withMessages(['cart' => 'Your cart is empty.']);
            }

            if (! $cart->canCheckout() || $cart->totalCents() !== $expectedTotal) {
                throw new CartChangedException;
            }

            $now = now();

            $order = $user->orders()->create([
                'status' => OrderStatus::Paid,
                'total_cents' => $cart->totalCents(),
                'currency' => 'EUR',
                'idempotency_key' => $idempotencyKey,
                'paid_at' => $now,
            ]);

            foreach ($cart->lines as $line) {
                $this->buyLine($order, $line, $now);
            }

            $payment = $this->gateway->charge($order->total_cents, 'EUR', $card);

            if (! $payment->approved) {
                // Logged before the throw: the rollback undoes the writes, not the log line.
                Log::info('checkout.declined', ['user_id' => $user->id, 'decline_code' => $payment->declineCode]);

                throw ValidationException::withMessages(['payment' => (string) $payment->message]);
            }

            $offerIds = array_map(fn (CartLine $line) => $line->offer->id, $cart->lines);
            $deleted = $user->cartItems()->whereIn('offer_id', $offerIds)->delete();

            if ($deleted !== count($cart->lines)) {
                throw new LogicException('Checkout deleted a different number of cart lines than it bought.');
            }

            return ['order' => $order, 'created' => true];
        });

        // afterCommit, because the controller runs this inside its own transaction (AC-7: only once it commits).
        if ($result['created']) {
            $order = $result['order'];

            DB::afterCommit(fn () => Log::info('checkout.paid', [
                'ulid' => $order->ulid,
                'user_id' => $user->id,
                'total_cents' => $order->total_cents,
            ]));
        }

        return $result;
    }

    /**
     * Writes the item with snapshots, then takes exactly `quantity` unsold keys for it.
     * SKIP LOCKED with LIMIT can return too few while a parallel buyer holds the first
     * candidates; that 409 is accepted (spec 0009 Consequences).
     */
    private function buyLine(Order $order, CartLine $line, Carbon $now): void
    {
        $offer = $line->offer;
        $product = $offer->product;

        $item = $order->items()->create([
            'offer_id' => $offer->id,
            'product_id' => $offer->product_id,
            'quantity' => $line->quantity,
            'unit_price_cents' => $offer->price_cents,
            'product_name' => $product->name,
            'platform_name' => $product->platform->name,
            'region_name' => $product->region->name,
            'seller_name' => $offer->seller->name,
        ]);

        $keyIds = ProductKey::query()
            ->where('offer_id', $offer->id)
            ->whereNull('order_item_id')
            ->orderBy('id')
            ->limit($line->quantity)
            ->lock('for update skip locked')
            ->pluck('id');

        if ($keyIds->count() < $line->quantity) {
            throw new CartChangedException;
        }

        $sold = ProductKey::query()
            ->whereIn('id', $keyIds)
            ->whereNull('order_item_id')
            ->update(['order_item_id' => $item->id, 'sold_at' => $now]);

        if ($sold !== $line->quantity) {
            throw new CartChangedException;
        }
    }
}
