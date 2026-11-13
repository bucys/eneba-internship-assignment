<?php

namespace App\Support;

use App\Enums\ProductSort;

/**
 * The validated store filters for GET /products (spec 0012 AC-1). Prices are in cents.
 * The request resolves the sort (spec 0013 AC-3); ListProducts still reads Relevance without a search as Name.
 */
final readonly class ProductFilters
{
    /**
     * @param  list<int>  $platformIds
     * @param  list<int>  $regionIds
     */
    public function __construct(
        public ?SearchTerms $q = null,
        public array $platformIds = [],
        public array $regionIds = [],
        public ?int $minCents = null,
        public ?int $maxCents = null,
        public ProductSort $sort = ProductSort::Name,
        public int $page = 1,
    ) {}
}
