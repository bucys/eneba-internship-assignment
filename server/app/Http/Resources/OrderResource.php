<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Build it from an order after Order::loadForResource() (spec 0009 AC-2).
 *
 * @property Order $resource
 */
class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $order = $this->resource;

        return [
            'ulid' => $order->ulid,
            'status' => $order->status->value,
            'total' => Money::eur($order->total_cents),
            'paid_at' => $order->paid_at->utc()->toIso8601ZuluString(),
            'items' => OrderItemResource::collection($order->items),
        ];
    }
}
