<?php

namespace App\Support;

/**
 * A cart write that stored less than was asked for (spec 0016 AC-10, AC-11).
 */
final readonly class CartAdjustment
{
    public function __construct(
        public int $offerId,
        public int $requested,
        public int $added,
    ) {}

    /**
     * @return array{offer_id: int, requested: int, added: int}
     */
    public function toArray(): array
    {
        return [
            'offer_id' => $this->offerId,
            'requested' => $this->requested,
            'added' => $this->added,
        ];
    }
}
