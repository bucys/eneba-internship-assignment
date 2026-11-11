<?php

namespace Database\Seeders\Support;

final readonly class ProductPlan
{
    /**
     * @param  list<array{seller_slug: string, price_cents: int, stock_target: int}>  $offers
     */
    public function __construct(
        public ?int $listPriceCents,
        public array $offers,
    ) {}
}
