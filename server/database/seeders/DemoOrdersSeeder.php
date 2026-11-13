<?php

namespace Database\Seeders;

use App\Actions\Cart\AddCartItem;
use App\Actions\Cart\BuildCart;
use App\Actions\Checkout\PlaceOrder;
use App\Exceptions\CartChangedException;
use App\Models\Offer;
use App\Models\Product;
use App\Models\User;
use App\Payments\CardDetails;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Places the demo orders behind the Best sellers block (spec 0014 AC-7), through the real
 * cart and checkout actions so no checkout logic is copied. Idempotent per order key.
 *
 * @phpstan-type DemoOrder array{key: string, lines: list<array{0: string, 1: int}>}
 */
class DemoOrdersSeeder extends Seeder
{
    public const EMAIL = 'demo-buyer@example.com';

    public const NAME = 'Demo Buyer';

    public function __construct(
        private readonly AddCartItem $addCartItem,
        private readonly BuildCart $buildCart,
        private readonly PlaceOrder $placeOrder,
    ) {}

    public function run(): void
    {
        /** @var list<DemoOrder> $orders */
        $orders = require database_path('data/demo_orders.php');

        // The random password is set on create only, so nobody can ever sign in as this user.
        $user = User::firstOrCreate(
            ['email' => self::EMAIL],
            ['name' => self::NAME, 'password' => Str::random(64)],
        );

        foreach ($orders as $order) {
            if ($user->orders()->where('idempotency_key', $order['key'])->exists()) {
                continue;
            }

            try {
                DB::transaction(fn () => $this->place($user, $order));
            } catch (ValidationException|CartChangedException $exception) {
                throw new RuntimeException("Demo order {$order['key']} failed: {$exception->getMessage()}", previous: $exception);
            }
        }
    }

    /**
     * @param  DemoOrder  $order
     */
    private function place(User $user, array $order): void
    {
        $user->cartItems()->delete();

        foreach ($order['lines'] as [$slug, $quantity]) {
            $offerId = $this->cheapestOfferWithStock($slug, $quantity);
            $this->addCartItem->handle($user, $offerId, $quantity);

            // AddCartItem caps quantities silently; a capped line would skew the planned ranking.
            $stored = $user->cartItems()->where('offer_id', $offerId)->value('quantity');
            if ($stored !== $quantity) {
                throw new RuntimeException("Demo order {$order['key']} could not add {$quantity} of {$slug}.");
            }
        }

        $expectedTotal = $this->buildCart->forUser($user)->totalCents();

        $this->placeOrder->handle(
            $user,
            $order['key'],
            $expectedTotal,
            new CardDetails('4242424242424242', 12, 2099, '123', self::NAME),
        );
    }

    /**
     * The cheapest active offer that can cover the whole line, ties by id.
     */
    private function cheapestOfferWithStock(string $slug, int $quantity): int
    {
        $productId = Product::where('slug', $slug)->value('id');

        if ($productId === null) {
            throw new RuntimeException("Demo order names an unknown product: {$slug}");
        }

        $offerId = Offer::query()
            ->where('product_id', $productId)
            ->where('is_active', true)
            ->has('availableKeys', '>=', $quantity)
            ->orderBy('price_cents')
            ->orderBy('id')
            ->value('id');

        if ($offerId === null) {
            throw new RuntimeException("Demo order has no offer with {$quantity} keys left for {$slug}.");
        }

        return (int) $offerId;
    }
}
