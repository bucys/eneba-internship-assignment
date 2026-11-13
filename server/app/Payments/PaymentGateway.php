<?php

namespace App\Payments;

/**
 * Charges a card. The simulated gateway is the only implementation; a real provider's
 * test mode would be a new class bound in AppServiceProvider (spec 0009 AC-5).
 */
interface PaymentGateway
{
    public function charge(int $amountCents, string $currency, #[\SensitiveParameter] CardDetails $card): PaymentResult;
}
