<?php

use App\Models\User;

function loginToken(string $email = 'ana@example.com'): string
{
    return test()->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'correct horse'])->json('data.token');
}

beforeEach(function () {
    $this->user = User::factory()->create(['name' => 'Ana', 'email' => 'ana@example.com', 'password' => 'correct horse']);
});

it('returns the signed in user', function () {
    $this->withToken(loginToken())
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertExactJson(['data' => ['id' => $this->user->id, 'name' => 'Ana', 'email' => 'ana@example.com']]);
});

it('logs out only the token it was called with', function () {
    $current = loginToken();
    $other = loginToken();

    $this->withToken($current)->postJson('/api/v1/auth/logout')->assertNoContent();

    $this->app['auth']->forgetGuards();
    $this->withToken($current)->getJson('/api/v1/auth/me')->assertUnauthorized();

    $this->app['auth']->forgetGuards();
    $this->withToken($other)->getJson('/api/v1/auth/me')->assertOk();
});

it('rejects a token older than 7 days', function () {
    $token = loginToken();

    $this->travel(7)->days();
    $this->travel(1)->minutes();

    $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
});

it('returns 401 JSON for bad tokens on me and logout, with or without an Accept header', function (string $method, string $uri, ?string $token) {
    $headers = $token === null ? [] : ['Authorization' => 'Bearer '.$token];

    $this->call($method, $uri, server: collect($headers)->mapWithKeys(fn ($v, $k) => ['HTTP_'.strtoupper($k) => $v])->all())
        ->assertUnauthorized()
        ->assertHeader('Content-Type', 'application/json')
        ->assertExactJson(['message' => 'Unauthenticated.']);
})->with([
    'me' => ['GET', '/api/v1/auth/me'],
    'logout' => ['POST', '/api/v1/auth/logout'],
])->with([
    'missing token' => [null],
    'malformed token' => ['not-a-token'],
    'unknown token' => ['999|'.str_repeat('a', 40)],
]);

it('returns 401 for a revoked token', function () {
    $token = loginToken();
    $this->user->tokens()->delete();

    $this->withToken($token)->postJson('/api/v1/auth/logout')->assertUnauthorized();
});
