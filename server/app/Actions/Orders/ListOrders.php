<?php

namespace App\Actions\Orders;

use App\Models\Order;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ListOrders
{
    public const PER_PAGE = 10;

    /**
     * The user's own orders, newest first, with the counts and first item a summary row shows.
     * Four queries for any page size: count, page (sum and count as subqueries), first items, products.
     *
     * @return LengthAwarePaginator<int, Order>
     */
    public function handle(User $user): LengthAwarePaginator
    {
        return $user->orders()
            ->withSum('items as item_count', 'quantity')
            ->withCount('items as line_count')
            ->with([
                'firstItem:id,order_id,product_id,product_name',
                'firstItem.product:id,cover_image_url',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE);
    }
}
