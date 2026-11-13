<?php

namespace App\Actions\Checkout;

use App\Models\Order;
use App\Models\User;
use App\Support\CartLock;
use Illuminate\Support\Facades\DB;

/**
 * Answers a retried checkout before its body is validated (spec 0009 AC-4 case 1). It takes the
 * same lock as PlaceOrder, so a first request with this key that is still running is waited for.
 */
class FindReplayedOrder
{
    public function handle(User $user, string $idempotencyKey): ?Order
    {
        return DB::transaction(function () use ($user, $idempotencyKey) {
            CartLock::forUser($user);

            return $user->orders()->where('idempotency_key', $idempotencyKey)->first();
        });
    }
}
