<?php

namespace App\Support;

class Discount
{
    /**
     * Whole percent off the list price, rounded down. Null when there is nothing to show.
     */
    public static function percent(?int $listCents, ?int $priceCents): ?int
    {
        if ($listCents === null || $priceCents === null || $listCents <= $priceCents) {
            return null;
        }

        $percent = intdiv(($listCents - $priceCents) * 100, $listCents);

        return $percent > 0 ? $percent : null;
    }
}
