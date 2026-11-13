<?php

namespace App\Http\Resources;

use App\Models\OrderItem;
use App\Models\ProductKey;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The only resource that serializes a key code (spec 0010). ProductKey hides `code`,
 * so it is read explicitly here.
 *
 * @property OrderItem $resource
 */
class OrderItemKeysResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = $this->resource;

        return [
            'order_item_id' => $item->id,
            'codes' => $item->keys->map(fn (ProductKey $key) => $key->code)->values()->all(),
        ];
    }
}
