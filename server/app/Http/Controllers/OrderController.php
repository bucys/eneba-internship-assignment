<?php

namespace App\Http\Controllers;

use App\Actions\Orders\ShowOrder;
use App\Http\Resources\OrderResource;
use App\Models\User;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function show(Request $request, string $ulid, ShowOrder $showOrder): OrderResource
    {
        /** @var User $user */
        $user = $request->user();

        return new OrderResource($showOrder->handle($user, $ulid));
    }
}
