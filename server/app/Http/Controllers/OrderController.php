<?php

namespace App\Http\Controllers;

use App\Actions\Orders\ShowOrder;
use App\Actions\Orders\ShowOrderKeys;
use App\Http\Resources\OrderItemKeysResource;
use App\Http\Resources\OrderResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
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
