<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * The per user lock that checkout and every cart write take first (spec 0009 AC-18).
 * FOR NO KEY UPDATE, not FOR UPDATE, so inserts into tables with a user_id foreign key
 * (they take FOR KEY SHARE on users) are not blocked by it.
 */
class CartLock
{
    public static function forUser(User $user): void
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('CartLock::forUser must run inside a transaction.');
        }

        User::query()->whereKey($user->id)->lock('for no key update')->first(['id']);
    }
}
