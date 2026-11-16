<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

const SERVER_TIMING_PATTERN = '/^app;dur=\d+(\.\d)?, db;dur=\d+(\.\d)?;desc="\d+ queries"$/';

function queryCountIn(string $serverTiming): int
{
    preg_match('/desc="(\d+) queries"/', $serverTiming, $matches);

    return (int) $matches[1];
}

beforeEach(function () {
    Route::middleware('api')->prefix('api/v1/_timing')->group(function () {
        Route::get('/three', function () {
            DB::select('select 1');
            DB::select('select 2');
            DB::select('select 3');

            return response()->json(['data' => []]);
        });
        Route::get('/boom', fn () => throw new RuntimeException('boom'));
        Route::get('/limited', fn () => response()->json(['data' => []]))->middleware('throttle:1,1');
    });
});

it('adds Server-Timing to success and error responses alike', function (string $method, string $path, int $status) {
    $response = $this->json($method, $path);

    $response->assertStatus($status);
    expect($response->headers->get('Server-Timing'))->toMatch(SERVER_TIMING_PATTERN);
})->with([
    '200' => ['GET', '/api/v1/home', 200],
    '401 from auth' => ['GET', '/api/v1/auth/me', 401],
    '404 from the action' => ['GET', '/api/v1/products/no-such-game', 404],
    '422 from the form request' => ['POST', '/api/v1/auth/login', 422],
    '500 from an exception' => ['GET', '/api/v1/_timing/boom', 500],
]);

it('leaves the 404 for a path that matches no route without Server-Timing', function () {
    // covers: spec 0016 AC-1 (amended): the api group middleware never runs without a matched route
    $response = $this->getJson('/api/v1/nope-route')->assertNotFound();

    expect($response->headers->has('Server-Timing'))->toBeFalse();
});

it('adds Server-Timing to a 429 from the throttle', function () {
    $this->getJson('/api/v1/_timing/limited')->assertOk();

    $response = $this->getJson('/api/v1/_timing/limited')->assertTooManyRequests();

    expect($response->headers->get('Server-Timing'))->toMatch(SERVER_TIMING_PATTERN);
});

it('counts the queries the request ran', function () {
    $response = $this->getJson('/api/v1/_timing/three')->assertOk();

    expect(queryCountIn($response->headers->get('Server-Timing')))->toBe(3);
});

it('reports each request on its own, not a running total', function () {
    $first = $this->getJson('/api/v1/_timing/three')->headers->get('Server-Timing');
    $second = $this->getJson('/api/v1/_timing/three')->headers->get('Server-Timing');

    expect(queryCountIn($first))->toBe(3)
        ->and(queryCountIn($second))->toBe(3);
});

it('carries only durations and a count', function () {
    $header = $this->getJson('/api/v1/home')->headers->get('Server-Timing');

    expect($header)->not->toContain('select')
        ->and($header)->not->toContain('localhost')
        ->and($header)->not->toContain('PHP');
});
