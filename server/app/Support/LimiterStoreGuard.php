<?php

namespace App\Support;

use RuntimeException;

/**
 * Fails closed on a limiter store that would silently turn every rate limit off (spec 0016 AC-17).
 * A disabled APCu makes apcu_inc return false, so the limiter reads 0 hits and never throttles.
 */
final class LimiterStoreGuard
{
    /**
     * @param  array<mixed>|null  $storeConfig  the cache.stores entry for $storeName, null when missing
     */
    public static function assertUsable(?string $storeName, ?array $storeConfig, bool $apcuEnabled): void
    {
        if ($storeName === null || $storeName === '') {
            return;
        }

        if ($storeConfig === null) {
            throw new RuntimeException("Rate limiter store [{$storeName}] is not configured.");
        }

        if (($storeConfig['driver'] ?? null) === 'apc' && ! $apcuEnabled) {
            throw new RuntimeException('Rate limiter store uses APCu, but APCu is not enabled.');
        }
    }
}
