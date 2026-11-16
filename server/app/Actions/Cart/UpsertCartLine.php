<?php

namespace App\Actions\Cart;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Adds to a cart line in one statement, capped on both insert and update. The unique
 * (user_id, offer_id) constraint plus ON CONFLICT means two concurrent adds never create
 * two rows or pass the cap (spec 0008 AC-3, AC-6).
 */
class UpsertCartLine
{
    /**
     * Returns the quantity Postgres stored, so callers can report a cap (spec 0016 AC-10).
     */
    public function handle(User $user, int $offerId, int $quantity, int $cap): int
    {
        $now = now();

        $row = DB::selectOne(
            'insert into cart_items (user_id, offer_id, quantity, created_at, updated_at) values (?, ?, ?, ?, ?)
             on conflict (user_id, offer_id) do update
             set quantity = least(cart_items.quantity + excluded.quantity, ?), updated_at = excluded.updated_at
             returning quantity',
            [$user->id, $offerId, min($quantity, $cap), $now, $now, $cap],
        );

        return (int) $row->quantity;
    }
}
