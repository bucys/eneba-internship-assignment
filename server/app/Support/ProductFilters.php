<?php

namespace App\Support;

use App\Enums\ProductSort;

/**
 * The validated store filters for GET /products (spec 0012 AC-1). Prices are in cents.
 */
final readonly class ProductFilters
{
    /**
     * @param  list<int>  $platformIds
     * @param  list<int>  $regionIds
     */
    public function __construct(
        public ?string $q = null,
        public array $platformIds = [],
        public array $regionIds = [],
        public ?int $minCents = null,
        public ?int $maxCents = null,
        public ProductSort $sort = ProductSort::Name,
        public int $page = 1,
    ) {}
}
