<?php

use App\Models\User;
use Laravel\Sanctum\PersonalAccessToken;

beforeEach(function () {
    $this->user = User::factory()->create(['email' => 'ana@example.com', 'password' => 'correct horse']);
});

it('logs in with the email in any case and surrounding spaces', function () {
    $this->postJson('/api/v1/auth/login', ['email' => '  ANA@Example.com ', 'password' => 'correct horse'])
        ->assertOk()
        ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email']]])
        ->assertJsonPath('data.user.id', $this->user->id);

    expect(PersonalAccessToken::where('name', 'spa')->count())->toBe(1);
});

it('creates a new token on each login and keeps older tokens working', function () {
    $first = $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'correct horse'])->json('data.token');
    $second = $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'correct horse'])->json('data.token');

    expect($first)->not->toBe($second)
        ->and($this->user->tokens()->count())->toBe(2);

    $this->app['auth']->forgetGuards();
    $this->withToken($first)->getJson('/api/v1/auth/me')->assertOk();
});

it('returns the same 422 body for a wrong password and an unknown email', function () {
    $wrongPassword = $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'wrong password']);
    $unknownEmail = $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'correct horse']);

    $wrongPassword->assertUnprocessable()
        ->assertExactJson([
            'message' => 'These credentials do not match our records.',
            'errors' => ['email' => ['These credentials do not match our records.']],
        ]);

    expect($unknownEmail->status())->toBe(422)
        ->and($unknownEmail->json())->toBe($wrongPassword->json());

    expect(PersonalAccessToken::count())->toBe(0);
});
