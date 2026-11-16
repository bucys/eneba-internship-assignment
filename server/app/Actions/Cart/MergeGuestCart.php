<?php

namespace App\Actions\Cart;

use App\Models\Offer;
use App\Models\User;
use App\Support\CartAdjustment;
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
     * past the line limit are dropped. Every guest line that added less than its quantity,
     * dropped lines included, is returned in request order (spec 0016 AC-11).
     *
     * @param  list<array{offer_id: int, quantity: int}>  $items
     * @return list<CartAdjustment>
     */
    public function handle(User $user, array $items): array
    {
        return DB::transaction(function () use ($user, $items) {
            CartLock::forUser($user);

            $offers = $this->buildCart->loadOffers(array_column($items, 'offer_id'));
            /** @var array<int, int> $storedByOffer */
            $storedByOffer = $user->cartItems()->pluck('quantity', 'offer_id')->map(fn ($quantity) => (int) $quantity)->all();
            $adjustments = [];

            foreach ($items as $item) {
                $added = $this->mergeLine($user, $item, $offers->get($item['offer_id']), $storedByOffer);

                if ($added < $item['quantity']) {
                    $adjustments[] = new CartAdjustment($item['offer_id'], $item['quantity'], $added);
                }
            }

            return $adjustments;
        });
    }

    /**
     * Returns how many units this guest line added (0 when dropped).
     *
     * @param  array{offer_id: int, quantity: int}  $item
     * @param  array<int, int>  $storedByOffer
     */
    private function mergeLine(User $user, array $item, ?Offer $offer, array &$storedByOffer): int
    {
        $cap = $offer === null ? 0 : CartLine::maxQuantityFor($offer);

        if ($cap === 0) {
            return 0;
        }

        $before = $storedByOffer[$item['offer_id']] ?? null;

        if ($before === null && count($storedByOffer) >= CartLimits::MAX_LINES) {
            return 0;
        }

        $after = $this->upsertCartLine->handle($user, $item['offer_id'], $item['quantity'], $cap);
        $storedByOffer[$item['offer_id']] = $after;

        // A stored line above a lowered cap shrinks to the cap; that adds nothing, never a negative.
        return max(0, $after - ($before ?? 0));
    }
}
