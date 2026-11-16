<?php

namespace App\Http\Middleware;

use App\Support\RequestTimings;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds `Server-Timing: app;dur=…, db;dur=…;desc="n queries"` to every API response,
 * so a plain curl splits a slow call into server work and queueing (spec 0016 AC-1).
 * Durations and a count only: never SQL, hosts, or versions.
 */
class ServerTiming
{
    public function __construct(private RequestTimings $timings) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Scoped instances are not flushed between requests in tests, so start from zero here.
        $this->timings->reset();

        $response = $next($request);

        $start = defined('LARAVEL_START') ? LARAVEL_START : (float) $request->server('REQUEST_TIME_FLOAT');
        $appMs = (microtime(true) - $start) * 1000;

        $response->headers->set('Server-Timing', sprintf(
            'app;dur=%s, db;dur=%s;desc="%d queries"',
            $this->duration($appMs),
            $this->duration($this->timings->queryMs),
            $this->timings->queryCount,
        ));

        return $response;
    }

    private function duration(float $ms): string
    {
        return number_format(max($ms, 0.0), 1, '.', '');
    }
}
