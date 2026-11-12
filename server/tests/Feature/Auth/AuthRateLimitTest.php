<?php

use App\Models\User;
use Illuminate\Testing\TestResponse;

const AUTH_FRONTEND = 'https://eneba.example.com';

function attemptLogin(string $email): TestResponse
{
    return test()->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'wrong password']);
}

it('limits logins to 5 per minute per email and IP, counting successful ones', function () {
    User::factory()->create(['email' => 'ana@x.com', 'password' => 'correct horse']);

    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/login', ['email' => 'ana@x.com', 'password' => 'correct horse'])->assertOk();
    }

    $this->postJson('/api/v1/auth/login', ['email' => 'ana@x.com', 'password' => 'correct horse'])
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');

    attemptLogin('other@x.com')->assertUnprocessable();
});

it('shares one bucket for padded uppercase and lowercase email', function () {
    foreach (range(1, 3) as $i) {
        attemptLogin('  Ana@X.com ')->assertUnprocessable();
    }
    foreach (range(1, 2) as $i) {
        attemptLogin('ana@x.com')->assertUnprocessable();
    }

    attemptLogin('ANA@x.com')->assertTooManyRequests();
});

it('limits logins to 20 per minute per IP across emails', function () {
    foreach (range(1, 20) as $i) {
        attemptLogin("user{$i}@x.com")->assertUnprocessable();
    }

    attemptLogin('fresh@x.com')->assertTooManyRequests()->assertHeader('Retry-After');
});

it('never fails the login limiter on a missing or non string email', function (mixed $email) {
    $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'x'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
})->with([
    'missing' => [null],
    'array' => [['a@x.com']],
    'number' => [42],
]);

it('limits registrations to 10 per hour per IP', function () {
    foreach (range(1, 10) as $i) {
        $this->postJson('/api/v1/auth/register', ['name' => 'U', 'email' => "u{$i}@x.com", 'password' => 'correct horse'])
            ->assertCreated();
    }

    $this->postJson('/api/v1/auth/register', ['name' => 'U', 'email' => 'u11@x.com', 'password' => 'correct horse'])
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');
});

it('limits me and logout to 60 per minute per user', function () {
    $user = User::factory()->create();
    $token = $user->createToken('spa')->plainTextToken;

    foreach (range(1, 60) as $i) {
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();
    }

    $this->withToken($token)->postJson('/api/v1/auth/logout')->assertTooManyRequests();
});

it('exposes Retry-After to the browser on a 429', function () {
    config([
        'cors.allowed_origins_patterns' => ['#^'.preg_quote(AUTH_FRONTEND, '#').'$#'],
        'cors.frontend_url' => AUTH_FRONTEND,
    ]);

    foreach (range(1, 5) as $i) {
        attemptLogin('ana@x.com');
    }

    $response = $this->postJson('/api/v1/auth/login', ['email' => 'ana@x.com', 'password' => 'x'], ['Origin' => AUTH_FRONTEND])
        ->assertTooManyRequests()
        ->assertHeader('Access-Control-Allow-Origin', AUTH_FRONTEND);

    expect($response->headers->get('Access-Control-Expose-Headers'))->toContain('Retry-After');
});
