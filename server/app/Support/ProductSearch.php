<?php

namespace App\Support;

use App\Models\Product;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * The one search matcher behind GET /products and GET /search/suggestions (spec 0013 AC-1, AC-2).
 * Every word must match the product name, by containment or, for longer words, by trigram
 * similarity. Adds `search_tier` and `search_score` for relevance ordering.
 * Run the built query inside withThreshold(), which sets the threshold the `<%` operator reads.
 */
class ProductSearch
{
    /** Chosen from the scores measured in spec 0013's rationale. */
    public const SIMILARITY_THRESHOLD = 0.5;

    /** Shorter words match only by containment, so "gta" never matches "Gate". */
    public const MIN_SIMILARITY_LENGTH = 4;

    /**
     * Call after withCheapestPrice(), whose select() would otherwise replace these columns.
     *
     * @param  Builder<Product>  $query
     */
    public function apply(Builder $query, SearchTerms $terms): void
    {
        foreach ($terms->words as $word) {
            $query->where(function (Builder $match) use ($word) {
                $match->whereLike('products.name', $this->contains($word));

                if (mb_strlen($word) >= self::MIN_SIMILARITY_LENGTH) {
                    // Same result as word_similarity(word, name) >= threshold, but the GIN index can serve it.
                    $match->orWhereRaw('? <% products.name', [$word]);
                }
            });
        }

        $everyWordContained = implode(' AND ', array_fill(0, count($terms->words), 'products.name ILIKE ?'));
        $scoreSum = implode(' + ', array_fill(0, count($terms->words), 'word_similarity(?, products.name)'));

        // 0: starts with the whole search, 1: contains every word, 2: some word matched only by similarity.
        $query->selectRaw(
            "CASE WHEN products.name ILIKE ? THEN 0 WHEN {$everyWordContained} THEN 1 ELSE 2 END AS search_tier",
            [$this->escapeLike($terms->query).'%', ...array_map($this->contains(...), $terms->words)],
        );

        // Rounded so float noise never reorders ties.
        $query->selectRaw("round(({$scoreSum})::numeric, 4) AS search_score", $terms->words);
    }

    /**
     * Runs $callback in a transaction whose `<%` threshold is SIMILARITY_THRESHOLD. Outside it,
     * Postgres falls back to its default of 0.6 and fewer typos match. set_config(..., true)
     * lasts only until the transaction ends, so a pooled connection never keeps it.
     *
     * @template T
     *
     * @param  Closure(): T  $callback
     * @return T
     */
    public function withThreshold(Closure $callback): mixed
    {
        return DB::transaction(function () use ($callback) {
            DB::select("SELECT set_config('pg_trgm.word_similarity_threshold', ?, true)", [(string) self::SIMILARITY_THRESHOLD]);

            return $callback();
        });
    }

    private function contains(string $word): string
    {
        return '%'.$this->escapeLike($word).'%';
    }

    /**
     * Postgres LIKE uses a backslash escape by default, so the visitor's text matches literally.
     */
    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
