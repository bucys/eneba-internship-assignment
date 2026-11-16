<?php

namespace App\Http\Controllers;

use App\Actions\Cart\AddCartItem;
use App\Actions\Cart\BuildCart;
use App\Actions\Cart\MergeGuestCart;
use App\Actions\Cart\RemoveCartItem;
use App\Actions\Cart\UpdateCartItem;
use App\Http\Requests\Cart\AddCartItemRequest;
use App\Http\Requests\Cart\CartLinesRequest;
use App\Http\Requests\Cart\UpdateCartItemRequest;
use App\Http\Resources\CartResource;
use App\Models\User;
use App\Support\CartAdjustment;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function __construct(private BuildCart $buildCart) {}

    public function show(Request $request): CartResource
    {
        return $this->cartFor($this->user($request));
    }

    public function store(AddCartItemRequest $request, AddCartItem $addCartItem): CartResource
    {
        $user = $this->user($request);

        $adjustments = $addCartItem->handle($user, $request->integer('offer_id'), $request->integer('quantity', 1));

        return $this->withAdjustments($this->cartFor($user), $adjustments);
    }

    public function update(UpdateCartItemRequest $request, string $offerId, UpdateCartItem $updateCartItem): CartResource
    {
        $user = $this->user($request);

        $updateCartItem->handle($user, (int) $offerId, $request->integer('quantity'));

        return $this->cartFor($user);
    }

    public function destroy(Request $request, string $offerId, RemoveCartItem $removeCartItem): CartResource
    {
        $user = $this->user($request);

        $removeCartItem->handle($user, (int) $offerId);

        return $this->cartFor($user);
    }

    public function merge(CartLinesRequest $request, MergeGuestCart $mergeGuestCart): CartResource
    {
        $user = $this->user($request);

        $adjustments = $mergeGuestCart->handle($user, $request->lines());

        return $this->withAdjustments($this->cartFor($user), $adjustments);
    }

    public function preview(CartLinesRequest $request): CartResource
    {
        return new CartResource($this->buildCart->fromLines($request->lines()));
    }

    private function cartFor(User $user): CartResource
    {
        return new CartResource($this->buildCart->forUser($user));
    }

    /**
     * Only add and merge carry `meta` (spec 0016 AC-10, AC-11).
     *
     * @param  list<CartAdjustment>  $adjustments
     */
    private function withAdjustments(CartResource $cart, array $adjustments): CartResource
    {
        return $cart->additional(['meta' => [
            'adjustments' => array_map(fn (CartAdjustment $adjustment) => $adjustment->toArray(), $adjustments),
        ]]);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
