<?php

namespace App\Actions\Cart;

use App\Models\User;
use App\Support\CartLine;
use App\Support\CartLock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateCartItem
{
    public function __construct(private BuildCart $buildCart) {}

    /**
     * Check order is fixed by spec 0008 AC-4: no line (404), unavailable, above the cap.
     */
    public function handle(User $user, int $offerId, int $quantity): void
    {
        DB::transaction(function () use ($user, $offerId, $quantity) {
            CartLock::forUser($user);

            $item = $user->cartItems()->where('offer_id', $offerId)->firstOrFail();

            $offer = $this->buildCart->findOffer($offerId);
            $cap = $offer === null ? 0 : CartLine::maxQuantityFor($offer);

            if ($cap === 0) {
                throw ValidationException::withMessages(['offer_id' => 'This offer is no longer available.']);
            }

            if ($quantity > $cap) {
                throw ValidationException::withMessages(['quantity' => "Only {$cap} available."]);
            }

            $item->update(['quantity' => $quantity]);
        });
    }
}
