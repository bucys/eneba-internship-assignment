<?php

use App\Providers\AppServiceProvider;
use Illuminate\Support\Facades\DB;

// The guard is a static flag, so reset it after each test to keep other tests unaffected.
afterEach(function () {
    DB::prohibitDestructiveCommands(false);
});

// Point the command at a throwaway in-memory SQLite database, so even a broken guard cannot touch Postgres.
function useThrowawayConnection(): void
{
    config()->set('database.connections.guard_probe', [
        'driver' => 'sqlite',
        'database' => ':memory:',
    ]);
}

function bootAppIn(string $environment): void
{
    app()->instance('env', $environment);
    (new AppServiceProvider(app()))->boot();
}

it('refuses destructive database commands in production', function () {
    useThrowawayConnection();
    bootAppIn('production');

    $this->artisan('db:wipe', ['--force' => true, '--database' => 'guard_probe'])
        ->expectsOutputToContain('This command is prohibited from running in this environment.')
        ->assertFailed();
});

// covers: AC-3 (spec 0001 lists all four commands the guard must block)
it('refuses every destructive migrate command in production', function (string $command) {
    useThrowawayConnection();
    bootAppIn('production');

    $this->artisan($command, ['--force' => true, '--database' => 'guard_probe'])
        ->expectsOutputToContain('This command is prohibited from running in this environment.')
        ->assertFailed();
})->with(['migrate:fresh', 'migrate:refresh', 'migrate:reset']);

it('allows destructive database commands outside production', function () {
    useThrowawayConnection();
    bootAppIn('local');

    $this->artisan('db:wipe', ['--force' => true, '--database' => 'guard_probe'])
        ->assertSuccessful();
});
