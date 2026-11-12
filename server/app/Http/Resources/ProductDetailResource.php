<?php

namespace App\Http\Resources;

use App\Actions\Catalog\ShowProduct;
use App\Models\Product;
use App\Support\Discount;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Expects a product loaded by ShowProduct (offers already sorted, with seller and stock).
 *
 * @mixin Product
 */
class ProductDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $bestOffer = ShowProduct::bestOffer($this->resource);
        $priceCents = $bestOffer?->price_cents;
        $listCents = $this->list_price_cents === null ? null : (int) $this->list_price_cents;

        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'type' => $this->type,
            'cover_image_url' => $this->cover_image_url,
            'description' => $this->description,
            'developer' => $this->developer,
            'publisher' => $this->publisher,
            'release_date' => $this->release_date?->format('Y-m-d'),
            'platform' => [
                'slug' => $this->platform->slug,
                'name' => $this->platform->name,
            ],
            'region' => [
                'slug' => $this->region->slug,
                'name' => $this->region->name,
            ],
            'price' => Money::eur($priceCents),
            'list_price' => Money::eur($listCents),
            'discount_percent' => Discount::percent($listCents, $priceCents),
            'best_offer_id' => $bestOffer?->id,
            'offers' => OfferResource::collection($this->offers),
        ];
    }
}
