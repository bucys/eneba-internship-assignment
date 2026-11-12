<?php

namespace App\Support;

use App\Models\Offer;

/**
 * One cart line with the spec 0008 AC-2 rules applied. The offer must have its product
 * loaded and available_keys_count counted.
 */
final readonly class CartLine
{
    public int $maxQuantity;

    public bool $available;

    public int $quantity;

    public bool $quantityReduced;

    public function __construct(public Offer $offer, public int $storedQuantity)
    {
        $this->maxQuantity = self::maxQuantityFor($offer);
        $this->available = $this->maxQuantity > 0;
        $this->quantity = $this->available ? min($storedQuantity, $this->maxQuantity) : $storedQuantity;
        $this->quantityReduced = $this->available && $storedQuantity > $this->maxQuantity;
    }

    public static function isOfferActive(Offer $offer): bool
    {
        return $offer->is_active && $offer->product->is_active;
    }

    /**
     * min(stock, 10) for an active offer on an active product, else 0.
     */
    public static function maxQuantityFor(Offer $offer): int
    {
        if (! self::isOfferActive($offer)) {
            return 0;
        }

        return min((int) $offer->available_keys_count, CartLimits::MAX_LINE_QUANTITY);
    }

    public function lineTotalCents(): ?int
    {
        return $this->available ? $this->offer->price_cents * $this->quantity : null;
    }
}
