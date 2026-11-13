<?php

namespace App\Actions\Catalog;

use App\Models\Platform;
use App\Models\Region;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class ListCatalogFilters
{
    /**
     * Platforms and regions that at least one active product uses, each by name (spec 0012 AC-4).
     *
     * @return array{platforms: Collection<int, Platform>, regions: Collection<int, Region>}
     */
    public function handle(): array
    {
        $hasActiveProduct = fn (Builder $query) => $query->where('is_active', true);

        return [
            'platforms' => Platform::query()
                ->whereHas('products', $hasActiveProduct)
                ->orderBy('name')
                ->orderBy('id')
                ->get(['slug', 'name']),
            'regions' => Region::query()
                ->whereHas('products', $hasActiveProduct)
                ->orderBy('name')
                ->orderBy('id')
                ->get(['slug', 'name']),
        ];
    }
}
