<?php

namespace App\Http\Resources;

use App\Models\Offer;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Offer
 */
class OfferResource extends JsonResource
{
    /**
     * Stock is a count only; key codes never leave the server.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'price' => Money::eur($this->price_cents),
            'stock' => (int) $this->available_keys_count,
            'seller' => [
                'name' => $this->seller->name,
                'rating_basis_points' => $this->seller->rating_basis_points,
                'rating_count' => $this->seller->rating_count,
            ],
        ];
    }
}
