<?php

namespace App\Support;

/**
 * Cart limits (spec 0008). The client mirrors them in client/src/lib/cartLimits.ts.
 */
final class CartLimits
{
    public const MAX_LINE_QUANTITY = 10;

    public const MAX_LINES = 50;
}
