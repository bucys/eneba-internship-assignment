<?php

const FRONTEND = 'https://eneba.example.com';
const PREVIEW_PATTERN = '^https://eneba-(git-[a-z0-9-]+|[a-z0-9]{9})-team-slug\.vercel\.app$';

/**
 * Re-evaluates config/cors.php the way a fresh boot would read these env values.
 */
function loadCorsConfig(string $frontendUrl, string $previewPattern): void
{
    foreach (['FRONTEND_URL' => $frontendUrl, 'CORS_PREVIEW_ORIGIN_PATTERN' => $previewPattern] as $key => $value) {
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
        putenv("{$key}={$value}");
    }

    config(['cors' => require config_path('cors.php')]);
}

afterEach(function () {
    foreach (['FRONTEND_URL', 'CORS_PREVIEW_ORIGIN_PATTERN'] as $key) {
        unset($_ENV[$key], $_SERVER[$key]);
        putenv($key);
    }
});

it('allows only the frontend origin and matching previews', function (string $origin, ?string $allowed) {
    loadCorsConfig(FRONTEND, PREVIEW_PATTERN);

    $response = $this->getJson('/api/v1/products', ['Origin' => $origin])->assertOk();

    $allowed === null
        ? $response->assertHeaderMissing('Access-Control-Allow-Origin')
        : $response->assertHeader('Access-Control-Allow-Origin', $allowed);
})->with([
    'production frontend' => [FRONTEND, FRONTEND],
    'hash preview' => ['https://eneba-abc123xyz-team-slug.vercel.app', 'https://eneba-abc123xyz-team-slug.vercel.app'],
    'branch preview' => ['https://eneba-git-feature-x-team-slug.vercel.app', 'https://eneba-git-feature-x-team-slug.vercel.app'],
    'another Vercel site' => ['https://evil-eneba.vercel.app', null],
    'preview from another scope' => ['https://eneba-abc123xyz-other-team.vercel.app', null],
]);

// With one origin and no patterns, the CORS package always sends that one origin,
// so a browser on any other origin is still refused.
it('allows no previews when the pattern is blank', function (string $origin) {
    loadCorsConfig(FRONTEND, '');

    expect(config('cors.allowed_origins_patterns'))->toBe([]);

    $this->getJson('/api/v1/products', ['Origin' => $origin])
        ->assertOk()
        ->assertHeader('Access-Control-Allow-Origin', FRONTEND);
})->with([
    'preview' => ['https://eneba-abc123xyz-team-slug.vercel.app'],
    'arbitrary origin' => ['https://evil.example.com'],
]);

it('never sends credentials', function () {
    loadCorsConfig(FRONTEND, PREVIEW_PATTERN);

    $this->getJson('/api/v1/products', ['Origin' => FRONTEND])
        ->assertHeaderMissing('Access-Control-Allow-Credentials');
});
