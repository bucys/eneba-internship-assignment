<?php

use App\Actions\Auth\RegisterUser;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

function validRegistration(array $overrides = []): array
{
    return array_merge([
        'name' => 'Ana Example',
        'email' => 'ana@example.com',
        'password' => 'correct horse',
    ], $overrides);
}

it('registers a user and returns a token plus the user', function () {
    $this->freezeTime();

    $response = $this->postJson('/api/v1/auth/register', validRegistration(['email' => '  Ana@Example.com ']))
        ->assertCreated()
        ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email']]])
        ->assertJsonPath('data.user.name', 'Ana Example')
        ->assertJsonPath('data.user.email', 'ana@example.com');

    $user = User::sole();
    expect($user->email)->toBe('ana@example.com')
        ->and($user->password)->not->toBe('correct horse')
        ->and(Hash::isHashed($user->password))->toBeTrue()
        ->and(Hash::info($user->password)['algoName'])->toBe('bcrypt');

    $token = PersonalAccessToken::sole();
    expect($token->tokenable_id)->toBe($user->id)
        ->and($token->name)->toBe('spa')
        ->and($token->expires_at?->toDateTimeString())->toBe(now()->addDays(7)->toDateTimeString());

    $this->withToken($response->json('data.token'))
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.email', 'ana@example.com');
});

it('rejects invalid registration fields', function (array $input, string $field) {
    $this->postJson('/api/v1/auth/register', $input)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field]);

    expect(User::count())->toBe(0);
})->with([
    'missing name' => [validRegistration(['name' => null]), 'name'],
    'blank name' => [validRegistration(['name' => '   ']), 'name'],
    'name over 60 chars' => [validRegistration(['name' => str_repeat('a', 61)]), 'name'],
    'missing email' => [validRegistration(['email' => null]), 'email'],
    'invalid email' => [validRegistration(['email' => 'not-an-email']), 'email'],
    'short password' => [validRegistration(['password' => 'short12']), 'password'],
    'password over 72 bytes' => [validRegistration(['password' => str_repeat('é', 37)]), 'password'],
]);

it('accepts a name of 60 chars after trimming and a 72 byte password', function () {
    $this->postJson('/api/v1/auth/register', validRegistration([
        'name' => '  '.str_repeat('a', 60).'  ',
        'password' => str_repeat('a', 72),
    ]))->assertCreated();
});

it('rejects an email that is already registered in any letter case', function () {
    User::factory()->create(['email' => 'bob@x.com']);

    $this->postJson('/api/v1/auth/register', validRegistration(['email' => 'Bob@X.com']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);

    expect(User::count())->toBe(1);
});

it('turns a racing duplicate insert into the same 422 email error', function () {
    // Simulates the losing request of a race: validation already passed, the row now exists.
    User::factory()->create(['email' => 'race@x.com']);

    try {
        app(RegisterUser::class)->handle(['name' => 'Racer', 'email' => 'race@x.com', 'password' => 'correct horse']);
        $this->fail('Expected a ValidationException.');
    } catch (ValidationException $e) {
        expect($e->errors())->toBe(['email' => ['The email has already been taken.']]);
    }
    // No query after this point: the violation aborted RefreshDatabase's wrapping Postgres transaction.
});
