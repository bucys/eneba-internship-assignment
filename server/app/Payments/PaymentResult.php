<?php

namespace App\Payments;

final readonly class PaymentResult
{
    public function __construct(
        public bool $approved,
        public ?string $declineCode = null,
        public ?string $message = null,
    ) {}

    public static function approved(): self
    {
        return new self(true);
    }

    public static function declined(string $code, string $message): self
    {
        return new self(false, $code, $message);
    }
}
