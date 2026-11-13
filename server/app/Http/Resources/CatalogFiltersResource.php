<?php

namespace App\Http\Resources;

use App\Models\Platform;
use App\Models\Region;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property array{platforms: Collection<int, Platform>, regions: Collection<int, Region>} $resource
 */
class CatalogFiltersResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $option = fn (Platform|Region $model) => ['slug' => $model->slug, 'name' => $model->name];

        return [
            'platforms' => $this->resource['platforms']->map($option)->values(),
            'regions' => $this->resource['regions']->map($option)->values(),
        ];
    }
}
