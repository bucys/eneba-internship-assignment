<?php

namespace App\Payments;

/**
 * No real money moves. Two test numbers decline; every other valid number is approved (spec 0009 AC-5).
 */
class SimulatedPaymentGateway implements PaymentGateway
{
    public const DECLINED_CARD = '4000000000000002';

    public const INSUFFICIENT_FUNDS_CARD = '4000000000009995';

    public function charge(int $amountCents, string $currency, #[\SensitiveParameter] CardDetails $card): PaymentResult
    {
        return match ($card->number) {
            self::DECLINED_CARD => PaymentResult::declined('card_declined', 'Your card was declined.'),
            self::INSUFFICIENT_FUNDS_CARD => PaymentResult::declined('insufficient_funds', 'Your card has insufficient funds.'),
            default => PaymentResult::approved(),
        };
    }
}
