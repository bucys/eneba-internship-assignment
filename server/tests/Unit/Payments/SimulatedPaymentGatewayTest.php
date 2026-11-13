<?php

use App\Payments\CardDetails;
use App\Payments\SimulatedPaymentGateway;
use App\Rules\Luhn;

function testCard(string $number): CardDetails
{
    return new CardDetails($number, 12, 2099, '123', 'Jane Buyer');
}

it('approves any other valid number', function () {
    $result = (new SimulatedPaymentGateway)->charge(1000, 'EUR', testCard('4242424242424242'));

    expect($result->approved)->toBeTrue()
        ->and($result->declineCode)->toBeNull();
});

it('declines the two test numbers with a code and message', function (string $number, string $code, string $message) {
    $result = (new SimulatedPaymentGateway)->charge(1000, 'EUR', testCard($number));

    expect($result->approved)->toBeFalse()
        ->and($result->declineCode)->toBe($code)
        ->and($result->message)->toBe($message);
})->with([
    ['4000000000000002', 'card_declined', 'Your card was declined.'],
    ['4000000000009995', 'insufficient_funds', 'Your card has insufficient funds.'],
]);

it('accepts the test cards in the Luhn check and rejects a changed digit', function () {
    expect(Luhn::passes('4242424242424242'))->toBeTrue()
        ->and(Luhn::passes('4000000000000002'))->toBeTrue()
        ->and(Luhn::passes('4000000000009995'))->toBeTrue()
        ->and(Luhn::passes('4242424242424241'))->toBeFalse();
});
