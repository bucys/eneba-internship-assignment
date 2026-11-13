<?php

namespace App\Actions\Home;

use App\Enums\OrderStatus;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Database\Eloquent\Collection;

class ListBestSellers
{
    public const LIMIT = 12;

    /**
     * Ranks by units sold in paid orders, all time; only buyable products show (spec 0014 AC-3).
     *
     * @return Collection<int, Product>
     */
    public function handle(): Collection
    {
        $unitsSold = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', OrderStatus::Paid)
            ->groupBy('order_items.product_id')
            ->selectRaw('order_items.product_id, SUM(order_items.quantity) AS units_sold');

        $buyable = Product::query()->active()->withCheapestPrice();

        // A derived table, because Postgres cannot filter on the cheapest_price_cents select alias.
        return Product::query()
            ->fromSub($buyable, 'products')
            ->joinSub($unitsSold, 'units', 'units.product_id', '=', 'products.id')
            ->select('products.*')
            ->with(['platform:id,slug,name', 'region:id,slug,name'])
            ->whereNotNull('products.cheapest_price_cents')
            ->where('units.units_sold', '>', 0)
            ->orderByDesc('units.units_sold')
            ->orderBy('products.name')
            ->orderBy('products.id')
            ->limit(self::LIMIT)
            ->get();
    }
}
