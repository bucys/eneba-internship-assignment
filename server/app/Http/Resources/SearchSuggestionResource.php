<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One header dropdown row; only fields the public product list already exposes (spec 0013 AC-4).
 *
 * @mixin Product
 */
class SearchSuggestionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'cover_image_url' => $this->cover_image_url,
            'platform' => [
                'slug' => $this->platform->slug,
                'name' => $this->platform->name,
            ],
            'price' => Money::eur($this->cheapest_price_cents === null ? null : (int) $this->cheapest_price_cents),
        ];
    }
}
