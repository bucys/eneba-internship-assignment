<?php

use App\Models\CartItem;
use App\Models\User;
use App\Support\CartLimits;
use Laravel\Sanctum\Sanctum;

it('previews guest lines in request order and leaves out unknown offers', function () {
    $a = cartOffer(5, ['price_cents' => 200]);
    $b = cartOffer(2, ['price_cents' => 300]);

    $this->postJson('/api/v1/cart/preview', ['items' => [
        ['offer_id' => $b->id, 'quantity' => 4],
        ['offer_id' => 999999, 'quantity' => 1],
        ['offer_id' => $a->id, 'quantity' => 1],
    ]])
        ->assertOk()
        ->assertJsonCount(2, 'data.lines')
        ->assertJsonPath('data.lines.0.offer_id', $b->id)
        ->assertJsonPath('data.lines.0.quantity', 2)
        ->assertJsonPath('data.lines.0.quantity_reduced', true)
        ->assertJsonPath('data.lines.1.offer_id', $a->id)
        ->assertJsonPath('data.total.amount', 800);

    expect(CartItem::query()->count())->toBe(0);
});

it('previews an empty list', function () {
    $this->postJson('/api/v1/cart/preview', ['items' => []])
        ->assertOk()
        ->assertJsonPath('data.lines', [])
        ->assertJsonPath('data.can_checkout', false);
});

it('validates the guest lines', function (mixed $items) {
    $this->postJson('/api/v1/cart/preview', ['items' => $items])->assertUnprocessable();
})->with([
    '51 items' => [fn () => array_map(fn ($i) => ['offer_id' => $i, 'quantity' => 1], range(1, CartLimits::MAX_LINES + 1))],
    'duplicate ids' => [[['offer_id' => 1, 'quantity' => 1], ['offer_id' => 1, 'quantity' => 2]]],
    'quantity 0' => [[['offer_id' => 1, 'quantity' => 0]]],
    'quantity 11' => [[['offer_id' => 1, 'quantity' => 11]]],
    'not an array' => ['nope'],
    'missing' => [null],
]);

it('limits preview with the catalog limiter', function () {
    for ($i = 0; $i < 120; $i++) {
        $this->postJson('/api/v1/cart/preview', ['items' => []])->assertOk();
    }

    $this->postJson('/api/v1/cart/preview', ['items' => []])
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');
});

it('lets preview through from a preview origin but still blocks cart writes there', function () {
    $preview = 'https://eneba-abc123xyz-team-slug.vercel.app';
    config([
        'cors.frontend_url' => 'https://eneba.example.com',
        'cors.preview_origin_pattern' => '^https://eneba-(git-[a-z0-9-]+|[a-z0-9]{9})-team-slug\.vercel\.app$',
    ]);

    $this->postJson('/api/v1/cart/preview', ['items' => []], ['Origin' => $preview])->assertOk();

    Sanctum::actingAs(User::factory()->create());
    $this->postJson('/api/v1/cart/items', ['offer_id' => cartOffer()->id], ['Origin' => $preview])->assertForbidden();
});

describe('merge', function () {
    beforeEach(function () {
        $this->user = User::factory()->create();
        Sanctum::actingAs($this->user);
    });

    it('sums overlapping lines with the cap and keeps other server lines', function () {
        $overlap = cartOffer(4);
        $serverOnly = cartOffer(5);
        $guestOnly = cartOffer(5);
        CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $overlap->id, 'quantity' => 3]);
        CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => $serverOnly->id, 'quantity' => 2]);

        $this->postJson('/api/v1/cart/merge', ['items' => [
            ['offer_id' => $overlap->id, 'quantity' => 3],
            ['offer_id' => $guestOnly->id, 'quantity' => 2],
        ]])
            ->assertOk()
            ->assertJsonPath('data.lines.0.offer_id', $overlap->id)
            ->assertJsonPath('data.lines.0.quantity', 4)
            ->assertJsonPath('data.lines.1.offer_id', $serverOnly->id)
            ->assertJsonPath('data.lines.1.quantity', 2)
            ->assertJsonPath('data.lines.2.offer_id', $guestOnly->id)
            ->assertJsonPath('data.lines.2.quantity', 2);
    });

    it('drops unknown, inactive, and out of stock guest lines', function () {
        $this->postJson('/api/v1/cart/merge', ['items' => [
            ['offer_id' => 999999, 'quantity' => 1],
            ['offer_id' => cartOffer(5, ['is_active' => false])->id, 'quantity' => 1],
            ['offer_id' => cartOffer(0)->id, 'quantity' => 1],
        ]])
            ->assertOk()
            ->assertJsonPath('data.lines', []);

        expect(CartItem::query()->count())->toBe(0);
    });

    it('adds new lines only up to the line limit, in request order', function () {
        foreach (range(1, CartLimits::MAX_LINES - 1) as $i) {
            CartItem::factory()->create(['user_id' => $this->user->id, 'offer_id' => cartOffer(0)->id]);
        }
        $kept = cartOffer(5);
        $dropped = cartOffer(5);

        $this->postJson('/api/v1/cart/merge', ['items' => [
            ['offer_id' => $kept->id, 'quantity' => 1],
            ['offer_id' => $dropped->id, 'quantity' => 1],
        ]])->assertOk()->assertJsonCount(CartLimits::MAX_LINES, 'data.lines');

        expect(CartItem::query()->where('offer_id', $kept->id)->exists())->toBeTrue()
            ->and(CartItem::query()->where('offer_id', $dropped->id)->exists())->toBeFalse();
    });
});
