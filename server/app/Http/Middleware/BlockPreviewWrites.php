<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stops accidental writes from Vercel preview pages (spec 0005, spec 0006 AC-6).
 * It reads only the Origin header, so it is not a security boundary.
 */
class BlockPreviewWrites
{
    private const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->isPreviewWrite($request)) {
            return response()->json(['message' => 'Preview deployments are read only.'], 403);
        }

        return $next($request);
    }

    private function isPreviewWrite(Request $request): bool
    {
        $pattern = (string) config('cors.preview_origin_pattern');
        $origin = $request->headers->get('Origin');

        if ($pattern === '' || $origin === null || in_array($request->method(), self::READ_METHODS, true)) {
            return false;
        }

        if ($origin === config('cors.frontend_url')) {
            return false;
        }

        return preg_match('#'.$pattern.'#', $origin) === 1;
    }
}
