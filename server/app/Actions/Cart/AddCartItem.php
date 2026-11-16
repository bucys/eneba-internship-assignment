<?php

namespace App\Actions\Cart;

use App\Models\User;
use App\Support\CartAdjustment;
use App\Support\CartLimits;
use App\Support\CartLine;
use App\Support\CartLock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AddCartItem
{
    public function __construct(
        private BuildCart $buildCart,
        private UpsertCartLine $upsertCartLine,
    ) {}

    /**
     * Error order is fixed by spec 0008 AC-3: unavailable, out of stock, at max, cart full.
     * Returns one adjustment when less than $quantity was added (spec 0016 AC-10).
     *
     * @return list<CartAdjustment>
     */
    public function handle(User $user, int $offerId, int $quantity): array
    {
        return DB::transaction(function () use ($user, $offerId, $quantity) {
            CartLock::forUser($user);

            $offer = $this->buildCart->findOffer($offerId);

            if ($offer === null || ! CartLine::isOfferActive($offer)) {
                throw ValidationException::withMessages(['offer_id' => 'This offer is no longer available.']);
            }

            $cap = CartLine::maxQuantityFor($offer);

            if ($cap === 0) {
                throw ValidationException::withMessages(['offer_id' => 'This offer is out of stock.']);
            }

            $value = $user->cartItems()->where('offer_id', $offerId)->value('quantity');
            $stored = $value === null ? null : (int) $value;

            if ($stored !== null && $stored >= $cap) {
                throw ValidationException::withMessages(['quantity' => 'You already have the maximum for this offer.']);
            }

            // A soft limit: two concurrent adds of new offers can both pass this check.
            if ($stored === null && $user->cartItems()->count() >= CartLimits::MAX_LINES) {
                throw ValidationException::withMessages(['offer_id' => 'Your cart is full.']);
            }

            $added = $this->upsertCartLine->handle($user, $offerId, $quantity, $cap) - ($stored ?? 0);

            return $added < $quantity ? [new CartAdjustment($offerId, $quantity, $added)] : [];
        });
    }
}
