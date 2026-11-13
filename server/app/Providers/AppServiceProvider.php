<?php

namespace App\Providers;

use App\Payments\PaymentGateway;
use App\Payments\SimulatedPaymentGateway;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Simulated payments only (spec 0009 AC-5); a real provider's test mode would be bound here.
        $this->app->bind(PaymentGateway::class, SimulatedPaymentGateway::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Render has no shell, so a mistaken migrate:fresh or db:wipe in production would lose real orders.
        DB::prohibitDestructiveCommands($this->app->isProduction());

        RateLimiter::for('catalog', fn (Request $request) => Limit::perMinute(120)->by((string) $request->ip()));

        // Runs before the Form Request, so it normalises the email itself; a non string email shares the '' bucket.
        RateLimiter::for('login', function (Request $request) {
            $email = $request->input('email');
            $email = is_string($email) ? mb_strtolower(trim($email)) : '';
            $ip = (string) $request->ip();

            return [
                Limit::perMinute(5)->by('email:'.$email.'|'.$ip),
                Limit::perMinute(20)->by('ip:'.$ip),
            ];
        });

        RateLimiter::for('register', fn (Request $request) => Limit::perHour(10)->by((string) $request->ip()));

        RateLimiter::for('account', fn (Request $request) => Limit::perMinute(60)->by((string) $request->user()?->getAuthIdentifier()));

        // Separate from account, so cart stepper clicks never use up the /auth/me budget.
        RateLimiter::for('cart', fn (Request $request) => Limit::perMinute(120)->by((string) $request->user()?->getAuthIdentifier()));

        // Limits card guessing and runaway retries (spec 0009 AC-8).
        RateLimiter::for('checkout', fn (Request $request) => Limit::perMinute(10)->by((string) $request->user()?->getAuthIdentifier()));
    }
}
