<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CatalogFilterController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Middleware\NoStore;
use Illuminate\Support\Facades\Route;

Route::get('/products', [ProductController::class, 'index'])
    ->middleware('throttle:catalog')
    ->name('products.index');

Route::get('/catalog/filters', CatalogFilterController::class)
    ->middleware('throttle:catalog')
    ->name('catalog.filters');

Route::get('/products/{slug}', [ProductController::class, 'show'])
    ->where('slug', '[a-z0-9-]+')
    ->middleware('throttle:catalog')
    ->name('products.show');

Route::prefix('auth')->name('auth.')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])
        ->middleware('throttle:register')
        ->name('register');

    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('login');

    // auth:sanctum runs first so the account limiter can key on the user id.
    Route::middleware(['auth:sanctum', 'throttle:account'])->group(function () {
        Route::get('/me', [AuthController::class, 'me'])->name('me');
        Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    });
});

Route::prefix('cart')->name('cart.')->group(function () {
    // Public and read only, so BlockPreviewWrites lets previews call it (spec 0008 AC-5).
    Route::post('/preview', [CartController::class, 'preview'])
        ->middleware('throttle:catalog')
        ->name('preview');

    Route::middleware(['auth:sanctum', 'throttle:cart'])->group(function () {
        Route::get('/', [CartController::class, 'show'])->name('show');
        Route::post('/items', [CartController::class, 'store'])->name('items.store');
        Route::patch('/items/{offerId}', [CartController::class, 'update'])
            ->where('offerId', '[0-9]{1,18}')
            ->name('items.update');
        Route::delete('/items/{offerId}', [CartController::class, 'destroy'])
            ->where('offerId', '[0-9]{1,18}')
            ->name('items.destroy');
        Route::post('/merge', [CartController::class, 'merge'])->name('merge');
    });
});

// Not in BlockPreviewWrites' read only list, so previews get 403 (spec 0009 AC-8).
Route::post('/checkout', [CheckoutController::class, 'store'])
    ->middleware(['auth:sanctum', 'throttle:checkout'])
    ->name('checkout.store');

// Owner scoped summaries, 10 per page, no items or codes (spec 0011 AC-1).
Route::get('/orders', [OrderController::class, 'index'])
    ->middleware(['auth:sanctum', 'throttle:account'])
    ->name('orders.index');

// HasUlids stores lowercase ULIDs; anything else is a 404 (spec 0009 AC-9).
Route::get('/orders/{ulid}', [OrderController::class, 'show'])
    ->where('ulid', '[0-9a-z]{26}')
    ->middleware(['auth:sanctum', 'throttle:account'])
    ->name('orders.show');

// NoStore is listed first so the 401, 404, and 429 answers carry it too (spec 0010 AC-3).
Route::get('/orders/{ulid}/keys', [OrderController::class, 'keys'])
    ->where('ulid', '[0-9a-z]{26}')
    ->middleware([NoStore::class, 'auth:sanctum', 'throttle:account'])
    ->name('orders.keys');
