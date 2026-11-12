<?php

namespace App\Actions\Cart;

use App\Models\User;
use App\Support\CartLimits;
use App\Support\CartLine;
use Illuminate\Validation\ValidationException;

class AddCartItem
{
    public function __construct(
        private BuildCart $buildCart,
        private UpsertCartLine $upsertCartLine,
    ) {}

    /**
     * Error order is fixed by spec 0008 AC-3: unavailable, out of stock, at max, cart full.
     */
    public function handle(User $user, int $offerId, int $quantity): void
    {
        $offer = $this->buildCart->findOffer($offerId);

        if ($offer === null || ! CartLine::isOfferActive($offer)) {
            throw ValidationException::withMessages(['offer_id' => 'This offer is no longer available.']);
        }

        $cap = CartLine::maxQuantityFor($offer);

        if ($cap === 0) {
            throw ValidationException::withMessages(['offer_id' => 'This offer is out of stock.']);
        }

        $stored = $user->cartItems()->where('offer_id', $offerId)->value('quantity');

        if ($stored !== null && $stored >= $cap) {
            throw ValidationException::withMessages(['quantity' => 'You already have the maximum for this offer.']);
        }

        // A soft limit: two concurrent adds of new offers can both pass this check.
        if ($stored === null && $user->cartItems()->count() >= CartLimits::MAX_LINES) {
            throw ValidationException::withMessages(['offer_id' => 'Your cart is full.']);
        }

        $this->upsertCartLine->handle($user, $offerId, $quantity, $cap);
    }
}
