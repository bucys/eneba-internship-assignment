<?php

namespace App\Actions\Catalog;

use App\Models\Product;
use App\Support\ProductSearch;
use App\Support\SearchTerms;
use Illuminate\Database\Eloquent\Collection;

/**
 * The header dropdown's games: the best matches in relevance order (spec 0013 AC-4).
 */
class SuggestProducts
{
    public const LIMIT = 6;

    public function __construct(private readonly ProductSearch $search) {}

    /**
     * @return Collection<int, Product>
     */
    public function handle(SearchTerms $terms): Collection
    {
        $query = Product::query()
            ->active()
            ->withCheapestPrice()
            ->with('platform:id,slug,name');

        $this->search->apply($query, $terms);

        // Postgres allows a bare select alias in ORDER BY, so no derived table is needed here.
        $query
            ->orderBy('search_tier')
            ->orderByDesc('search_score')
            ->orderBy('products.name')
            ->orderBy('products.id')
            ->limit(self::LIMIT);

        return $this->search->withThreshold(fn () => $query->get());
    }
}
