<?php

use App\Actions\Cart\AddCartItem;
use App\Actions\Cart\MergeGuestCart;
use App\Actions\Cart\RemoveCartItem;
use App\Actions\Cart\UpdateCartItem;
use App\Actions\Checkout\FindReplayedOrder;
use App\Actions\Checkout\PlaceOrder;
use App\Models\User;
use App\Payments\CardDetails;
use App\Support\CartLock;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Runs the action and returns the SQL it sent, in order.
 *
 * @return list<string>
 */
function sqlOf(Closure $action): array
{
    $sql = [];
    DB::listen(function (QueryExecuted $query) use (&$sql) {
        $sql[] = $query->sql;
    });

    try {
        $action();
    } catch (Throwable) {
        // Some actions end in a validation error; only the queries matter here.
    }

    return $sql;
}

it('refuses to lock outside a transaction', function () {
    // RefreshDatabase wraps the default connection in a transaction, so use a fresh one.
    $default = DB::getDefaultConnection();
    config(['database.connections.unwrapped' => config("database.connections.{$default}")]);
    DB::setDefaultConnection('unwrapped');

    try {
        expect(DB::transactionLevel())->toBe(0)
            ->and(fn () => CartLock::forUser(User::factory()->make(['id' => 1])))
            ->toThrow(LogicException::class, 'CartLock::forUser must run inside a transaction.');
    } finally {
        DB::setDefaultConnection($default);
        DB::purge('unwrapped');
    }
});

it('takes the user lock before touching the cart', function (Closure $run) {
    $user = User::factory()->create();
    $offer = cartOffer(5, ['price_cents' => 1000]);
    $user->cartItems()->create(['offer_id' => $offer->id, 'quantity' => 1]);

    $sql = sqlOf(fn () => $run($user, $offer->id));

    $lockAt = collect($sql)->search(fn (string $q) => str_contains($q, 'from "users"') && str_contains($q, 'for no key update'));
    $cartAt = collect($sql)->search(fn (string $q) => str_contains($q, 'cart_items') || str_contains($q, 'from "orders"'));

    expect($lockAt)->not->toBeFalse()
        ->and($cartAt)->not->toBeFalse()
        ->and($lockAt)->toBeLessThan($cartAt);
})->with([
    'add' => [fn (User $user, int $offerId) => app(AddCartItem::class)->handle($user, $offerId, 1)],
    'update' => [fn (User $user, int $offerId) => app(UpdateCartItem::class)->handle($user, $offerId, 2)],
    'remove' => [fn (User $user, int $offerId) => app(RemoveCartItem::class)->handle($user, $offerId)],
    'merge' => [fn (User $user, int $offerId) => app(MergeGuestCart::class)->handle($user, [['offer_id' => $offerId, 'quantity' => 1]])],
    'replay lookup' => [fn (User $user) => app(FindReplayedOrder::class)->handle($user, (string) Str::uuid())],
    'place order' => [fn (User $user) => app(PlaceOrder::class)->handle($user, (string) Str::uuid(), 1000, new CardDetails('4242424242424242', 12, 2099, '123', 'A'))],
]);
