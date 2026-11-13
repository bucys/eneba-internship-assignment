<?php

namespace App\Support;

/**
 * A visitor's search, split into the words the matcher checks (spec 0013 AC-1).
 */
final readonly class SearchTerms
{
    public const MAX_WORDS = 10;

    /**
     * @param  string  $query  the search with every whitespace run made one space and trimmed, for the "starts with" tier
     * @param  non-empty-list<string>  $words  lowercased, deduplicated, at most MAX_WORDS
     */
    private function __construct(
        public string $query,
        public array $words,
    ) {}

    /**
     * Null when the search holds no words, so it reads the same as no search at all.
     */
    public static function fromQuery(?string $q): ?self
    {
        // `\s` with `u` matches Unicode whitespace too (U+3000, U+2003); null means invalid UTF-8.
        $collapsed = preg_replace('/\s+/u', ' ', (string) $q);
        $query = trim($collapsed ?? '');
        $words = $query === '' ? [] : explode(' ', mb_strtolower($query));
        $words = array_slice(array_values(array_unique($words)), 0, self::MAX_WORDS);

        return $words === [] ? null : new self($query, $words);
    }
}
