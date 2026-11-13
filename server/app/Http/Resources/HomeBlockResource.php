<?php

namespace App\Http\Resources;

use App\Models\HomeBlock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin HomeBlock
 */
class HomeBlockResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'type' => $this->type,
            'title' => $this->title,
        ];
    }
}
