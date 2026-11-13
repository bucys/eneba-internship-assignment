<?php

use App\Http\Middleware\BlockPreviewWrites;
use App\Http\Middleware\NoStore;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // nginx (TRUSTED_PROXY=cloudflare in the Dockerfile) already sets REMOTE_ADDR from CF-Connecting-IP.
        // Trusting X-Forwarded-For here would trust the client itself, so only the scheme is taken from the proxy.
        $middleware->trustProxies(
            at: '*',
            headers: Request::HEADER_X_FORWARDED_PROTO,
        );

        // Before throttling and auth:sanctum, so a preview write gets 403 rather than 401 or 429.
        $middleware->prependToGroup('api', BlockPreviewWrites::class);

        // The store price params must reach ListProductsRequest untrimmed, so " 5" fails its pattern (spec 0012 AC-3).
        $middleware->trimStrings(except: ['price_min', 'price_max']);

        // This API has no login page, so a guest gets the 401 JSON even without an Accept header (spec 0006 AC-4).
        $middleware->redirectGuestsTo(null);

        // Laravel sorts auth and throttle ahead of unlisted route middleware, so NoStore joins the
        // priority list before them; otherwise their 401 and 429 would skip it (spec 0010 AC-3).
        $middleware->prependToPriorityList(AuthenticatesRequests::class, NoStore::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Defence in depth: card fields never reach the session flash (spec 0009 AC-7).
        $exceptions->dontFlash(['card_number', 'card_cvc', 'card_expiry', 'card_name']);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
