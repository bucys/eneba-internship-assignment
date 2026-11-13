<?php

namespace App\Actions\Orders;

use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class ShowOrderKeys
{
    /**
     * Owner scoped like ShowOrder, so a foreign or unknown ULID is the same 404 (spec 0010 AC-2).
     * Reads only; items and keys come back in id order (spec 0010 AC-1).
     *
     * @return Collection<int, OrderItem>
     */
    public function handle(User $user, string $ulid): Collection
    {
        $order = $user->orders()->where('ulid', $ulid)->firstOrFail();

        return $order->items()
            ->orderBy('id')
            ->with(['keys' => fn ($query) => $query->orderBy('id')->select(['id', 'order_item_id', 'code'])])
            ->get();
    }
}
