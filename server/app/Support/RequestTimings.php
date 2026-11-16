<?php

namespace App\Support;

/**
 * Query count and time for the current request, read by ServerTiming (spec 0016 AC-1).
 */
class RequestTimings
{
    public int $queryCount = 0;

    public float $queryMs = 0.0;

    public function record(float $ms): void
    {
        $this->queryCount++;
        $this->queryMs += $ms;
    }

    public function reset(): void
    {
        $this->queryCount = 0;
        $this->queryMs = 0.0;
    }
}
