<?php

namespace App\Actions\Cart;

use App\Models\Offer;
use App\Models\User;
use App\Support\Cart;
use App\Support\CartLine;
use Illuminate\Database\Eloquent\Collection;

/**
 * Builds the Cart shape for a signed in user or a guest preview (spec 0008 AC-1, AC-2, AC-5).
 * It only reads; it never corrects stored quantities.
 */
class BuildCart
{
    public function forUser(User $user): Cart
    {
        $items = $user->cartItems()
            ->orderBy('id')
            ->get(['offer_id', 'quantity'])
            ->map(fn ($item) => ['offer_id' => $item->offer_id, 'quantity' => $item->quantity])
            ->all();

        return $this->fromLines(array_values($items));
    }

    /**
     * Lines keep the given order; unknown offer ids are left out.
     *
     * @param  list<array{offer_id: int, quantity: int}>  $items
     */
    public function fromLines(array $items): Cart
    {
        $offers = $this->loadOffers(array_column($items, 'offer_id'));
        $lines = [];

        foreach ($items as $item) {
            $offer = $offers->get($item['offer_id']);

            if ($offer !== null) {
                $lines[] = new CartLine($offer, $item['quantity']);
            }
        }

        return new Cart($lines);
    }

    public function findOffer(int $offerId): ?Offer
    {
        return $this->loadOffers([$offerId])->get($offerId);
    }

    /**
     * Inactive offers and products still load, so their lines can show as unavailable.
     *
     * @param  list<int>  $offerIds
     * @return Collection<int, Offer>
     */
    public function loadOffers(array $offerIds): Collection
    {
        if ($offerIds === []) {
            return new Collection;
        }

        return Offer::query()
            ->whereIn('id', $offerIds)
            ->with([
                'seller:id,name',
                'product' => fn ($query) => $query
                    ->select(['id', 'slug', 'name', 'cover_image_url', 'platform_id', 'region_id', 'is_active'])
                    ->with(['platform:id,slug,name', 'region:id,slug,name']),
            ])
            ->withCount('availableKeys')
            ->get()
            ->keyBy('id');
    }
}
