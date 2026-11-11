<?php

namespace Database\Seeders\Support;

use Random\Engine\Mt19937;
use Random\Randomizer;

/**
 * Derives a product's offers, prices, list price, and stock from its slug (spec 0004).
 *
 * The draw order below is frozen once production is seeded: changing it reshuffles
 * every price and seller set on the next rerun.
 */
final class OfferPlanner
{
    /**
     * @param  list<string>  $sellerSlugs  the data file's sellers, in file order
     */
    public function plan(string $productSlug, int $basePriceCents, bool $soldOut, array $sellerSlugs): ProductPlan
    {
        $random = new Randomizer(new Mt19937(crc32($productSlug)));

        $offerCount = $random->getInt(2, 5);
        $sellers = array_slice($random->shuffleArray($sellerSlugs), 0, $offerCount);

        $prices = [];
        foreach ($sellers as $_) {
            $price = intdiv($basePriceCents * $random->getInt(31, 89), 100);
            while (in_array($price, $prices, true)) {
                $price--;
            }
            $prices[] = $price;
        }

        $stockTargets = [];
        foreach ($sellers as $_) {
            $stockTargets[] = $this->drawStockTarget($random);
        }

        $listPriceCents = $random->getInt(1, 100) <= 60 ? $basePriceCents : null;

        if ($soldOut) {
            $stockTargets = array_fill(0, count($sellers), 0);
        } elseif (max($stockTargets) < 5) {
            $stockTargets[0] = 10;
        }

        $offers = [];
        foreach ($sellers as $index => $sellerSlug) {
            $offers[] = [
                'seller_slug' => $sellerSlug,
                'price_cents' => $prices[$index],
                'stock_target' => $stockTargets[$index],
            ];
        }

        return new ProductPlan($listPriceCents, $offers);
    }

    private function drawStockTarget(Randomizer $random): int
    {
        $roll = $random->getInt(1, 100);

        return match (true) {
            $roll <= 10 => 0,
            $roll <= 20 => $random->getInt(1, 2),
            default => $random->getInt(5, 30),
        };
    }
}
