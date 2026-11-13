<?php

namespace App\Actions\Orders;

use App\Models\Order;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\Paginator;

class ListOrders
{
    public const PER_PAGE = 10;

    /**
     * Higher pages read as this one. A page near PHP_INT_MAX overflows the offset and
     * silently returns page 1's rows; any page this far out is already beyond the last.
     */
    public const MAX_PAGE = 100_000;

    /**
     * The user's own orders, newest first, with the counts and first item a summary row shows.
     * Four queries for any page size: count, page (sum and count as subqueries), first items, products.
     *
     * @return LengthAwarePaginator<int, Order>
     */
    public function handle(User $user): LengthAwarePaginator
    {
        $page = min(Paginator::resolveCurrentPage(), self::MAX_PAGE);

        return $user->orders()
            ->withSum('items as item_count', 'quantity')
            ->withCount('items as line_count')
            ->with([
                'firstItem:id,order_id,product_id,product_name',
                'firstItem.product:id,cover_image_url',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE, ['*'], 'page', $page);
    }
}
