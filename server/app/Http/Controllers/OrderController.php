<?php

namespace App\Http\Controllers;

use App\Actions\Orders\ListOrders;
use App\Actions\Orders\ShowOrder;
use App\Actions\Orders\ShowOrderKeys;
use App\Http\Resources\OrderItemKeysResource;
use App\Http\Resources\OrderResource;
use App\Http\Resources\OrderSummaryResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    public function index(Request $request, ListOrders $listOrders): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return OrderSummaryResource::collection($listOrders->handle($user));
    }

    public function show(Request $request, string $ulid, ShowOrder $showOrder): OrderResource
    {
        /** @var User $user */
        $user = $request->user();

        return new OrderResource($showOrder->handle($user, $ulid));
    }

    public function keys(Request $request, string $ulid, ShowOrderKeys $showOrderKeys): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return OrderItemKeysResource::collection($showOrderKeys->handle($user, $ulid));
    }
}
