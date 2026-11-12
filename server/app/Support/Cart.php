<?php

namespace App\Support;

/**
 * A cart as the buyer sees it (spec 0008 AC-2). Built by BuildCart, never stored.
 */
final readonly class Cart
{
    /**
     * @param  list<CartLine>  $lines
     */
    public function __construct(public array $lines) {}

    public function itemCount(): int
    {
        return array_sum(array_map(fn (CartLine $line) => $line->quantity, $this->lines));
    }

    public function totalCents(): int
    {
        return array_sum(array_map(fn (CartLine $line) => $line->lineTotalCents() ?? 0, $this->lines));
    }

    public function canCheckout(): bool
    {
        if ($this->lines === []) {
            return false;
        }

        foreach ($this->lines as $line) {
            if (! $line->available) {
                return false;
            }
        }

        return true;
    }
}
