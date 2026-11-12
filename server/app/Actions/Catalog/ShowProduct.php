<?php

namespace App\Actions\Catalog;

use App\Models\Offer;
use App\Models\Product;

class ShowProduct
{
    /**
     * Loads an active product with its active offers sorted for the buyer (spec 0007, AC-2).
     */
    public function handle(string $slug): Product
    {
        $product = Product::query()
            ->active()
            ->where('slug', $slug)
            ->with([
                'platform:id,slug,name',
                'region:id,slug,name',
                'offers' => fn ($query) => $query->active()
                    ->with('seller:id,name,rating_basis_points,rating_count')
                    ->withCount('availableKeys'),
            ])
            ->firstOrFail();

        $product->setRelation('offers', $product->offers->sort($this->compareOffers(...))->values());

        return $product;
    }

    /**
     * The first offer with stock in the sorted list, or null when nothing can be bought.
     */
    public static function bestOffer(Product $product): ?Offer
    {
        return $product->offers->first(fn (Offer $offer) => $offer->available_keys_count > 0);
    }

    /**
     * In stock first, then cheapest, then best rated (unrated sellers last), then seller name, then id.
     */
    private function compareOffers(Offer $a, Offer $b): int
    {
        return $this->sortKey($a) <=> $this->sortKey($b);
    }

    /**
     * @return array{int, int, int, int, string, int}
     */
    private function sortKey(Offer $offer): array
    {
        $isRated = $offer->seller->rating_count > 0;

        return [
            $offer->available_keys_count > 0 ? 0 : 1,
            $offer->price_cents,
            $isRated ? 0 : 1,
            $isRated ? -$offer->seller->rating_basis_points : 0,
            $offer->seller->name,
            $offer->id,
        ];
    }
}
