<?php

namespace App\Http\Resources;

use App\Support\Cart;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Cart $resource
 */
class CartResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $cart = $this->resource;

        return [
            'lines' => CartLineResource::collection($cart->lines),
            'item_count' => $cart->itemCount(),
            'total' => Money::eur($cart->totalCents()),
            'can_checkout' => $cart->canCheckout(),
        ];
    }
}
