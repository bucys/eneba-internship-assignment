<?php

namespace App\Http\Resources;

use App\Models\OrderItem;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Names and prices are the order time snapshots; only the product link and cover are live.
 * No key code appears here until feature 11 (spec 0009 AC-2).
 *
 * @property OrderItem $resource
 */
class OrderItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = $this->resource;

        return [
            'product' => [
                'slug' => $item->product->slug,
                'cover_image_url' => $item->product->cover_image_url,
            ],
            'product_name' => $item->product_name,
            'platform_name' => $item->platform_name,
            'region_name' => $item->region_name,
            'seller_name' => $item->seller_name,
            'quantity' => $item->quantity,
            'unit_price' => Money::eur($item->unit_price_cents),
            'line_total' => Money::eur($item->quantity * $item->unit_price_cents),
        ];
    }
}
