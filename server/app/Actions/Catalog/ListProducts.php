<?php

namespace App\Actions\Catalog;

use App\Enums\ProductSort;
use App\Models\Product;
use App\Support\ProductFilters;
use App\Support\ProductSearch;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ListProducts
{
    public const PER_PAGE = 24;

    /**
     * Higher pages read as this one. A page near PHP_INT_MAX overflows the offset and
     * silently returns page 1's rows; any page this far out is already beyond the last.
     */
    public const MAX_PAGE = 100_000;

    public function __construct(private readonly ProductSearch $search) {}

    /**
     * @return LengthAwarePaginator<int, Product>
     */
    public function handle(ProductFilters $filters = new ProductFilters): LengthAwarePaginator
    {
        // Name, platform, and region narrow the inner query, so the price subquery runs on fewer rows.
        $matching = Product::query()
            ->active()
            ->withCheapestPrice()
            ->when($filters->q !== null, fn (Builder $query) => $this->search->apply($query, $filters->q))
            ->when($filters->platformIds !== [], fn (Builder $query) => $query->whereIn('products.platform_id', $filters->platformIds))
            ->when($filters->regionIds !== [], fn (Builder $query) => $query->whereIn('products.region_id', $filters->regionIds));

        // Postgres can't use a select alias inside WHERE or ORDER BY expressions, so the scoped
        // query becomes a derived table where cheapest_price_cents (and the search columns) are real.
        // A null price fails both bounds, so a price filter drops out of stock products.
        $query = Product::query()
            ->fromSub($matching, 'products')
            ->with(['platform:id,slug,name', 'region:id,slug,name'])
            ->when($filters->minCents !== null, fn (Builder $query) => $query->where('cheapest_price_cents', '>=', $filters->minCents))
            ->when($filters->maxCents !== null, fn (Builder $query) => $query->where('cheapest_price_cents', '<=', $filters->maxCents));

        // Relevance orders by the search columns, so without a search it reads as Name (spec 0013 AC-3).
        $sort = $filters->sort === ProductSort::Relevance && $filters->q === null ? ProductSort::Name : $filters->sort;

        // Relevance ignores stock on purpose: an exact match stays first even when sold out (spec 0013 AC-2).
        match ($sort) {
            ProductSort::Relevance => $query->orderBy('search_tier')->orderByDesc('search_score'),
            ProductSort::Name => $query->orderByRaw('cheapest_price_cents IS NULL'),
            ProductSort::PriceAsc => $query->orderByRaw('cheapest_price_cents IS NULL')->orderBy('cheapest_price_cents'),
            ProductSort::PriceDesc => $query->orderByRaw('cheapest_price_cents IS NULL')->orderByDesc('cheapest_price_cents'),
        };

        $paginate = fn () => $query
            ->orderBy('name')
            ->orderBy('id')
            ->paginate(self::PER_PAGE, ['*'], 'page', min($filters->page, self::MAX_PAGE));

        return $filters->q === null ? $paginate() : $this->search->withThreshold($paginate);
    }
}
