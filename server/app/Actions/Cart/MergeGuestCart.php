<?php

namespace App\Actions\Cart;

use App\Models\User;
use App\Support\CartLimits;
use App\Support\CartLine;
use App\Support\CartLock;
use Illuminate\Support\Facades\DB;

class MergeGuestCart
{
    public function __construct(
        private BuildCart $buildCart,
        private UpsertCartLine $upsertCartLine,
    ) {}

    /**
     * Adds guest lines into the user's cart (spec 0008 AC-6). Unavailable lines and new lines
     * past the line limit are dropped silently; the cart page shows the result.
     *
     * @param  list<array{offer_id: int, quantity: int}>  $items
     */
    public function handle(User $user, array $items): void
    {
        DB::transaction(function () use ($user, $items) {
            CartLock::forUser($user);

            $offers = $this->buildCart->loadOffers(array_column($items, 'offer_id'));
            $existing = array_flip($user->cartItems()->pluck('offer_id')->all());

            foreach ($items as $item) {
                $offer = $offers->get($item['offer_id']);
                $cap = $offer === null ? 0 : CartLine::maxQuantityFor($offer);

                if ($cap === 0) {
                    continue;
                }

                $isNew = ! isset($existing[$item['offer_id']]);

                if ($isNew && count($existing) >= CartLimits::MAX_LINES) {
                    continue;
                }

                $this->upsertCartLine->handle($user, $item['offer_id'], $item['quantity'], $cap);
                $existing[$item['offer_id']] = true;
            }
        });
    }
}
