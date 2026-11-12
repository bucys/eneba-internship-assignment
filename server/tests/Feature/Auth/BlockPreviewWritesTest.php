<?php

const GUARD_FRONTEND = 'https://eneba.example.com';
const GUARD_PREVIEW = 'https://eneba-abc123xyz-team-slug.vercel.app';
const GUARD_PATTERN = '^https://eneba-(git-[a-z0-9-]+|[a-z0-9]{9})-team-slug\.vercel\.app$';

beforeEach(function () {
    config(['cors.frontend_url' => GUARD_FRONTEND, 'cors.preview_origin_pattern' => GUARD_PATTERN]);
});

it('blocks writes from a preview origin', function (string $uri) {
    $this->postJson($uri, ['email' => 'a@x.com', 'password' => 'correct horse', 'name' => 'A'], ['Origin' => GUARD_PREVIEW])
        ->assertForbidden()
        ->assertExactJson(['message' => 'Preview deployments are read only.']);
})->with(['/api/v1/auth/login', '/api/v1/auth/register']);

it('returns 403, not 401, for a preview logout without a token', function () {
    $this->postJson('/api/v1/auth/logout', [], ['Origin' => GUARD_PREVIEW])->assertForbidden();
});

it('returns 403, not 429, once a preview has hit the login limit', function () {
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/login', ['email' => 'a@x.com', 'password' => 'x']);
    }

    $this->postJson('/api/v1/auth/login', ['email' => 'a@x.com', 'password' => 'x'], ['Origin' => GUARD_PREVIEW])
        ->assertForbidden();
});

it('lets through reads from previews, the frontend, requests without Origin, and preflight', function () {
    $this->getJson('/api/v1/products', ['Origin' => GUARD_PREVIEW])->assertOk();

    $this->postJson('/api/v1/auth/login', ['email' => 'a@x.com', 'password' => 'x'], ['Origin' => GUARD_FRONTEND])
        ->assertUnprocessable();

    $this->postJson('/api/v1/auth/login', ['email' => 'a@x.com', 'password' => 'x'])->assertUnprocessable();

    $this->call('OPTIONS', '/api/v1/auth/login', server: [
        'HTTP_ORIGIN' => GUARD_PREVIEW,
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
    ])->assertStatus(204);
});

it('blocks nothing when the pattern is blank', function () {
    config(['cors.preview_origin_pattern' => '']);

    $this->postJson('/api/v1/auth/login', ['email' => 'a@x.com', 'password' => 'x'], ['Origin' => GUARD_PREVIEW])
        ->assertUnprocessable();
});
