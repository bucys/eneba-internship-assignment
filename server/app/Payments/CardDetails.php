<?php

namespace App\Payments;

/**
 * Card data lives only in request memory; it is never stored or logged (spec 0009 AC-7).
 */
final readonly class CardDetails
{
    public function __construct(
        #[\SensitiveParameter] public string $number,
        #[\SensitiveParameter] public int $expiryMonth,
        #[\SensitiveParameter] public int $expiryYear,
        #[\SensitiveParameter] public string $cvc,
        #[\SensitiveParameter] public string $name,
    ) {}
}
