<?php

namespace App\Http\Controllers;

use App\Actions\Checkout\FindReplayedOrder;
use App\Actions\Checkout\PlaceOrder;
use App\Http\Requests\Checkout\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\User;
use App\Support\CartLock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CheckoutController extends Controller
{
    /**
     * Takes a plain Request, not CheckoutRequest, so a replay is answered before the card body
     * is validated (spec 0009 AC-4): header check, replay, body, then PlaceOrder.
     *
     * The replay lookup, the body validation, and PlaceOrder share one transaction and one user
     * lock. With two separate lock holds, a same key retry could slip in between them, find no
     * order yet, and fail validation instead of waiting for the first request (AC-6 b).
     */
    public function store(Request $request, FindReplayedOrder $findReplay, PlaceOrder $placeOrder): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $key = $this->idempotencyKey($request);

        $result = DB::transaction(function () use ($user, $key, $findReplay, $placeOrder) {
            CartLock::forUser($user);

            $replayed = $findReplay->handle($user, $key);

            if ($replayed !== null) {
                return ['order' => $replayed, 'created' => false];
            }

            // Resolving a Form Request from the container runs its validation.
            $checkout = app(CheckoutRequest::class);

            return $placeOrder->handle($user, $key, $checkout->expectedTotal(), $checkout->card());
        });

        return $this->orderResponse($result['order'], $result['created'] ? 201 : 200);
    }

    private function idempotencyKey(Request $request): string
    {
        $validated = Validator::make(
            ['idempotency_key' => $request->header('Idempotency-Key')],
            ['idempotency_key' => ['required', 'string', 'uuid']],
            [
                'idempotency_key.required' => 'Missing or invalid idempotency key.',
                'idempotency_key.string' => 'Missing or invalid idempotency key.',
                'idempotency_key.uuid' => 'Missing or invalid idempotency key.',
            ],
        )->validate();

        return $validated['idempotency_key'];
    }

    private function orderResponse(Order $order, int $status): JsonResponse
    {
        return (new OrderResource($order->loadForResource()))->response()->setStatusCode($status);
    }
}
