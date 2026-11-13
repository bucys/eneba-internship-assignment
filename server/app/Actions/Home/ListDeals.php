<?php

namespace App\Actions\Home;

use App\Models\Product;
use Illuminate\Database\Eloquent\Collection;

class ListDeals
{
    public const LIMIT = 12;

    /**
     * Deepest discounts first (spec 0014 AC-4). The SQL percent is integer division on integer
     * columns, the same rounding down as Discount::percent, so the order matches discount_percent.
     *
     * @return Collection<int, Product>
     */
    public function handle(): Collection
    {
        $priced = Product::query()->active()->withCheapestPrice();

        $withPercent = Product::query()
            ->fromSub($priced, 'products')
            ->select('products.*')
            ->selectRaw('((list_price_cents - cheapest_price_cents) * 100) / list_price_cents AS deal_percent')
            ->whereNotNull('list_price_cents')
            ->whereNotNull('cheapest_price_cents')
            ->whereColumn('list_price_cents', '>', 'cheapest_price_cents');

        return Product::query()
            ->fromSub($withPercent, 'products')
            ->with(['platform:id,slug,name', 'region:id,slug,name'])
            ->where('deal_percent', '>=', 1)
            ->orderByDesc('deal_percent')
            ->orderBy('name')
            ->orderBy('id')
            ->limit(self::LIMIT)
            ->get();
    }
}
