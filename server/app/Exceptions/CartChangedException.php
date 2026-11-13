<?php

namespace App\Exceptions;

use Illuminate\Contracts\Debug\ShouldntReport;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * The cart no longer matches what the buyer saw, or its keys ran out (spec 0009 AC-4 cases 4 and 5).
 * Not reported: nothing about checkout is logged except paid and declined (AC-7).
 */
class CartChangedException extends RuntimeException implements ShouldntReport
{
    public const MESSAGE = 'Your cart changed. Check the updated total and try again.';

    public function __construct()
    {
        parent::__construct(self::MESSAGE);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => self::MESSAGE], 409);
    }
}
