<?php

namespace App\Actions\Cart;

use App\Models\User;
use App\Support\CartLock;
use Illuminate\Support\Facades\DB;

class RemoveCartItem
{
    /**
     * Removing a line that is not there is fine, so a double click is safe (spec 0008 AC-4).
     */
    public function handle(User $user, int $offerId): void
    {
        DB::transaction(function () use ($user, $offerId) {
            CartLock::forUser($user);

            $user->cartItems()->where('offer_id', $offerId)->delete();
        });
    }
}
