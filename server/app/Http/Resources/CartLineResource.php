<?php

namespace App\Http\Resources;

use App\Support\CartLine;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property CartLine $resource
 */
class CartLineResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $line = $this->resource;
        $offer = $line->offer;
        $product = $offer->product;

        return [
            'offer_id' => $offer->id,
            'quantity' => $line->quantity,
            'max_quantity' => $line->maxQuantity,
            'available' => $line->available,
            'quantity_reduced' => $line->quantityReduced,
            'unit_price' => Money::eur($offer->price_cents),
            'line_total' => Money::eur($line->lineTotalCents()),
            'seller' => [
                'name' => $offer->seller->name,
            ],
            'product' => [
                'slug' => $product->slug,
                'name' => $product->name,
                'cover_image_url' => $product->cover_image_url,
                'platform' => [
                    'slug' => $product->platform->slug,
                    'name' => $product->platform->name,
                ],
                'region' => [
                    'slug' => $product->region->slug,
                    'name' => $product->region->name,
                ],
            ],
        ];
    }
}
