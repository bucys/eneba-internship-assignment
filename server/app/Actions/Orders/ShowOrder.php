<?php

namespace App\Actions\Orders;

use App\Models\Order;
use App\Models\User;

class ShowOrder
{
    /**
     * Queried through the user's own orders, so another user's order is a 404 that never
     * reveals it exists (spec 0009 AC-9).
     */
    public function handle(User $user, string $ulid): Order
    {
        return $user->orders()->where('ulid', $ulid)->firstOrFail()->loadForResource();
    }
}
