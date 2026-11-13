<?php

namespace App\Actions\Home;

use App\Models\Banner;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ListBanners
{
    public const LIMIT = 10;

    /**
     * A sold out product keeps its tile, with a null price (spec 0014 AC-2).
     *
     * @return Collection<int, Banner>
     */
    public function handle(): Collection
    {
        return Banner::query()
            ->where('is_active', true)
            ->whereHas('product', fn (Builder $query) => $query->where('is_active', true))
            ->with(['product' => fn (BelongsTo $query) => $query
                ->withCheapestPrice()
                ->with(['platform:id,slug,name', 'region:id,slug,name'])])
            ->orderBy('position')
            ->orderBy('id')
            ->limit(self::LIMIT)
            ->get();
    }
}
