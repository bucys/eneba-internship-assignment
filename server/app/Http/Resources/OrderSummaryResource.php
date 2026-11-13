<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One order history row, built from ListOrders. It never carries the item list or a key code;
 * codes come only from GET /orders/{ulid}/keys (spec 0010).
 *
 * @property Order $resource
 */
class OrderSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $order = $this->resource;
        $firstItem = $order->firstItem;

        return [
            'ulid' => $order->ulid,
            'status' => $order->status->value,
            'total' => Money::eur($order->total_cents),
            'paid_at' => $order->paid_at->utc()->toIso8601ZuluString(),
            // Postgres returns SUM as a numeric string.
            'item_count' => (int) $order->getAttribute('item_count'),
            'line_count' => (int) $order->getAttribute('line_count'),
            'first_item' => [
                'product_name' => $firstItem?->product_name,
                'cover_image_url' => $firstItem?->product->cover_image_url,
            ],
        ];
    }
}
