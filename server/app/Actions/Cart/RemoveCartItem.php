<?php

namespace App\Actions\Cart;

use App\Models\User;

class RemoveCartItem
{
    /**
     * Removing a line that is not there is fine, so a double click is safe (spec 0008 AC-4).
     */
    public function handle(User $user, int $offerId): void
    {
        $user->cartItems()->where('offer_id', $offerId)->delete();
    }
}
