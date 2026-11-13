<?php

use App\Models\Order;
use App\Models\User;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->user = User::factory()->create();
    Sanctum::actingAs($this->user);
});

it('rejects each invalid field with that field\'s single message and never echoes the value', function (Closure $overrides, string $field, string $message) {
    $body = checkoutBody(1000, $overrides());

    $response = $this->postJson('/api/v1/checkout', $body, checkoutHeaders())
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field => $message]);

    expect($response->json("errors.{$field}"))->toHaveCount(1);

    foreach (['card_number', 'card_cvc', 'card_name', 'card_expiry'] as $cardField) {
        if (is_string($body[$cardField] ?? null) && strlen($body[$cardField]) >= 3) {
            expect($response->content())->not->toContain($body[$cardField]);
        }
    }

    expect(Order::query()->count())->toBe(0);
})->with([
    'bad Luhn' => [fn () => ['card_number' => '4242 4242 4242 4241'], 'card_number', 'Enter a valid card number.'],
    '11 digits' => [fn () => ['card_number' => '42424242424'], 'card_number', 'Enter a valid card number.'],
    '20 digits' => [fn () => ['card_number' => '42424242424242424242'], 'card_number', 'Enter a valid card number.'],
    'non ASCII digits' => [fn () => ['card_number' => '٤٢٤٢٤٢٤٢٤٢٤٢٤٢٤٢'], 'card_number', 'Enter a valid card number.'],
    'number as array' => [fn () => ['card_number' => ['4242424242424242']], 'card_number', 'Enter a valid card number.'],
    'number as integer' => [fn () => ['card_number' => 4242424242424242], 'card_number', 'Enter a valid card number.'],
    'number missing' => [fn () => ['card_number' => null], 'card_number', 'Enter a valid card number.'],
    'month 13' => [fn () => ['card_expiry' => '13/27'], 'card_expiry', 'Enter the expiry date as MM/YY.'],
    'no slash' => [fn () => ['card_expiry' => '12'], 'card_expiry', 'Enter the expiry date as MM/YY.'],
    'last month' => [fn () => ['card_expiry' => now('UTC')->subMonthNoOverflow()->format('m/y')], 'card_expiry', 'This card has expired.'],
    '21 years ahead' => [fn () => ['card_expiry' => now('UTC')->addYears(21)->format('m/y')], 'card_expiry', 'Enter the expiry date as MM/YY.'],
    '5 digit CVC' => [fn () => ['card_cvc' => '12345'], 'card_cvc', 'Enter the 3 or 4 digit security code.'],
    'CVC as integer' => [fn () => ['card_cvc' => 123], 'card_cvc', 'Enter the 3 or 4 digit security code.'],
    'blank name' => [fn () => ['card_name' => '   '], 'card_name', 'Enter the name on the card.'],
    '101 character name' => [fn () => ['card_name' => str_repeat('a', 101)], 'card_name', 'Enter the name on the card.'],
    'total missing' => [fn () => ['expected_total' => null], 'expected_total', 'Invalid total.'],
    'total too large' => [fn () => ['expected_total' => 2147483648], 'expected_total', 'Invalid total.'],
    'total as string' => [fn () => ['expected_total' => '1000'], 'expected_total', 'Invalid total.'],
    'total negative' => [fn () => ['expected_total' => -1], 'expected_total', 'Invalid total.'],
]);

it('accepts this month as an expiry and a 4 digit CVC', function () {
    $offer = cartOffer(1, ['price_cents' => 1000]);
    $this->user->cartItems()->create(['offer_id' => $offer->id, 'quantity' => 1]);

    $this->postJson('/api/v1/checkout', checkoutBody(1000, [
        'card_expiry' => now('UTC')->format('m/y'),
        'card_cvc' => '1234',
    ]), checkoutHeaders())->assertCreated();
});

it('rejects a missing or non UUID idempotency key', function (array $headers) {
    $this->postJson('/api/v1/checkout', checkoutBody(1000), $headers)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['idempotency_key' => 'Missing or invalid idempotency key.']);
})->with([
    'missing' => [[]],
    'not a uuid' => [['Idempotency-Key' => 'abc']],
]);

it('logs checkout.paid once, nothing on replay, and checkout.declined with the code, never card data', function () {
    $logs = [];
    Log::listen(function (MessageLogged $event) use (&$logs) {
        $logs[] = $event;
    });

    $offer = cartOffer(5, ['price_cents' => 1000]);
    $this->user->cartItems()->create(['offer_id' => $offer->id, 'quantity' => 1]);
    $headers = checkoutHeaders();

    $ulid = $this->postJson('/api/v1/checkout', checkoutBody(1000), $headers)->json('data.ulid');
    $this->postJson('/api/v1/checkout', checkoutBody(1000), $headers)->assertOk();

    $this->user->cartItems()->create(['offer_id' => $offer->id, 'quantity' => 1]);
    $this->postJson('/api/v1/checkout', checkoutBody(1000, ['card_number' => '4000000000000002']), checkoutHeaders())
        ->assertUnprocessable();
    $this->postJson('/api/v1/checkout', checkoutBody(999), checkoutHeaders())->assertStatus(409);

    expect($logs)->toHaveCount(2)
        ->and($logs[0]->message)->toBe('checkout.paid')
        ->and($logs[0]->context)->toBe(['ulid' => $ulid, 'user_id' => $this->user->id, 'total_cents' => 1000])
        ->and($logs[1]->message)->toBe('checkout.declined')
        ->and($logs[1]->context)->toBe(['user_id' => $this->user->id, 'decline_code' => 'card_declined']);

    $serialized = json_encode(array_map(fn (MessageLogged $log) => [$log->message, $log->context], $logs));
    expect($serialized)->not->toContain('4242')->not->toContain('4000000000000002')->not->toContain('Jane Buyer');
});
