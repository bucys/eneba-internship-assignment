<?php

use App\Actions\Catalog\ListProducts;
use App\Actions\Catalog\SuggestProducts;
use App\Enums\ProductSort;
use App\Models\Platform;
use App\Models\Product;
use App\Support\ProductFilters;
use App\Support\ProductSearch;
use App\Support\SearchTerms;
use Database\Seeders\CatalogSeeder;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Database\Events\TransactionCommitted;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/**
 * @return list<string>
 */
function suggestionNames(string $q): array
{
    return test()->getJson('/api/v1/search/suggestions?q='.rawurlencode($q))->assertOk()->json('data.*.name');
}

/**
 * Distinct names in result order; the seed lists one title on several platforms.
 *
 * @return list<string>
 */
function searchTitles(string $q): array
{
    return array_values(array_unique(storeNames('?q='.rawurlencode($q))));
}

describe('the seeded catalog', function () {
    beforeEach(function () {
        $this->seed(CatalogSeeder::class);
    });

    it('puts The Witcher 3 first for typos and partial names on both endpoints', function (string $q) {
        expect(storeNames('?q='.rawurlencode($q))[0])->toBe('The Witcher 3: Wild Hunt')
            ->and(suggestionNames($q)[0])->toBe('The Witcher 3: Wild Hunt');
    })->with(['witcher', 'witchr', 'wicher', 'wild hunt']);

    it('finds misspelled titles', function (string $q, array $expected) {
        expect(searchTitles($q))->toContain(...$expected);
    })->with([
        ['cyberpnk', ['Cyberpunk 2077']],
        ['eldn ring', ['Elden Ring']],
        ['baldurs gate', ["Baldur's Gate 3"]],
        ['assasins creed', ["Assassin's Creed Valhalla", "Assassin's Creed Mirage"]],
        ['starfeild', ['Starfield']],
    ]);

    it('requires every word to match', function () {
        expect(searchTitles('witcher blood'))->toBe(['The Witcher 3: Wild Hunt Blood and Wine']);

        foreach (searchTitles('wild hunt') as $title) {
            expect($title)->toStartWith('The Witcher 3: Wild Hunt');
        }
    });

    it('ranks the closer title first', function () {
        $titles = searchTitles('stardew');

        expect($titles)->toContain('Starfield')
            ->and(array_search('Stardew Valley', $titles, true))->toBeLessThan(array_search('Starfield', $titles, true));
    });

    // One endpoint per test: the threshold is transaction local, and the test's own transaction
    // would carry it from the first request into the second.
    it('matches a score of exactly the threshold', function (string $endpoint) {
        // "stardew" scores 0.5 against "Starfield", below Postgres' default `<%` threshold of 0.6.
        $titles = $endpoint === 'store' ? searchTitles('stardew') : suggestionNames('stardew');

        expect($titles)->toContain('Starfield');
    })->with(['store', 'suggestions']);
});

describe('word rules', function () {
    it('never matches a short word by similarity', function () {
        storeProduct("Baldur's Gate 3", 500);
        storeProduct('Grand Theft Auto V', 500);

        expect(storeNames('?q=gta'))->toBe([])
            ->and(storeNames('?q=gat'))->toBe(["Baldur's Gate 3"]);
    });

    it('never matches a punctuation only word by similarity', function (string $q) {
        storeProduct('Plain Name', 500);

        expect(storeNames('?q='.rawurlencode($q)))->toBe([])
            ->and(suggestionNames($q))->toBe([]);
    })->with(['----', '%%%%']);

    it('matches the LIKE wildcards literally in suggestions', function (string $q, string $expected) {
        storeProduct('Hundred %% Off', 500);
        storeProduct('Snake__Case', 500);
        storeProduct('Plain Name', 500);

        expect(suggestionNames($q))->toBe([$expected]);
    })->with([
        ['%%', 'Hundred %% Off'],
        ['__', 'Snake__Case'],
    ]);

    it('counts only the first ten distinct words', function () {
        storeProduct('Alpha Bravo Chief Delight', 500);

        $words = 'alpha alpha ALPHA '.implode(' ', array_fill(0, 9, 'bravo')).' unmatched';

        expect(SearchTerms::fromQuery($words)?->words)->toBe(['alpha', 'bravo', 'unmatched'])
            ->and(storeNames('?q='.rawurlencode('a b c d e f g h i alpha unmatched')))->toBe(['Alpha Bravo Chief Delight']);
    });

    it('collapses every run of whitespace, Unicode included, to one space', function () {
        $terms = SearchTerms::fromQuery(" Wild \t\u{3000} Hunt\u{2003}");

        expect($terms?->query)->toBe('Wild Hunt')
            ->and($terms?->words)->toBe(['wild', 'hunt']);
    });

    it('ranks repeated spaces like single ones on both endpoints', function () {
        storeProduct('A Wild Hunt', 500);
        storeProduct('Wild Hunter', 500);
        $q = rawurlencode('wild   hunt');

        // "Wild Hunter" starts with the collapsed search, so it outranks the name order.
        expect(storeNames("?q={$q}"))->toBe(['Wild Hunter', 'A Wild Hunt'])
            ->and(suggestionNames('wild   hunt'))->toBe(['Wild Hunter', 'A Wild Hunt'])
            ->and(storeNames("?q={$q}"))->toBe(storeNames('?q=wild%20hunt'));
    });

    it('reads a search with no words as no search', function () {
        expect(SearchTerms::fromQuery("  \u{3000} "))->toBeNull();
    });
});

describe('relevance', function () {
    it('binds the tier and score columns in order', function () {
        storeProduct('The Witcher 3: Wild Hunt', 500);

        $search = app(ProductSearch::class);
        $query = Product::query()->withCheapestPrice();
        $search->apply($query, SearchTerms::fromQuery('witchr'));
        $row = $search->withThreshold(fn () => $query->firstOrFail());

        expect($row->search_tier)->toBe(2)
            ->and((string) $row->search_score)->toBe('0.7143');
    });

    it('orders starts with, then contains, then similar, ignoring stock', function () {
        storeProduct('Space Witcher', 500);
        storeProduct('Witcher Tales', null);
        storeProduct('Witchr Typo Edition', 500);
        storeProduct('The Witcher', 500);

        expect(storeNames('?q=witcher'))->toBe(['Witcher Tales', 'Space Witcher', 'The Witcher', 'Witchr Typo Edition']);
    });

    it('keeps an out of stock exact match above an in stock typo match', function () {
        storeProduct('Witchr', 500);
        storeProduct('Witcher', null);

        expect(storeNames('?q=witcher'))->toBe(['Witcher', 'Witchr'])
            ->and(suggestionNames('witcher'))->toBe(['Witcher', 'Witchr']);
    });

    it('is stable across pages', function () {
        Product::factory()->count(30)->sequence(fn ($sequence) => ['name' => "Witcher {$sequence->index}"])->create()
            ->each(fn (Product $product) => cartOffer(1, ['product_id' => $product->id]));

        $first = $this->getJson('/api/v1/products?q=witcher')->assertOk()->json('data.*.slug');
        $second = $this->getJson('/api/v1/products?q=witcher&page=2')->assertOk()->json('data.*.slug');

        expect(array_unique([...$first, ...$second]))->toHaveCount(30);
    });
});

describe('sort resolution', function () {
    beforeEach(function () {
        storeProduct('Zeta Witcher', 1000);
        storeProduct('Witcher Alpha', 3000);
        storeProduct('Aardvark', 2000);
    });

    it('defaults to relevance with a search and name without one', function () {
        expect(storeNames('?q=witcher'))->toBe(['Witcher Alpha', 'Zeta Witcher'])
            ->and(storeNames('?q=witcher&sort=relevance'))->toBe(['Witcher Alpha', 'Zeta Witcher'])
            ->and(storeNames('?q=witcher&sort=name'))->toBe(['Witcher Alpha', 'Zeta Witcher'])
            ->and(storeNames('?q=witcher&sort=price_asc'))->toBe(['Zeta Witcher', 'Witcher Alpha']);
    });

    it('reads relevance without a search as name', function (string $query) {
        expect(storeNames($query))->toBe(storeNames(''))
            ->and(storeNames(''))->toBe(['Aardvark', 'Witcher Alpha', 'Zeta Witcher']);
    })->with(['?sort=relevance', '?sort=relevance&q=%20%20']);

    it('lists by name when the action gets relevance without a search', function () {
        $products = app(ListProducts::class)->handle(new ProductFilters(sort: ProductSort::Relevance));

        expect($products->pluck('name')->all())->toBe(['Aardvark', 'Witcher Alpha', 'Zeta Witcher']);
    });
});

describe('GET /search/suggestions', function () {
    it('returns the suggestion shape', function () {
        $platform = Platform::factory()->create(['slug' => 'steam', 'name' => 'Steam']);
        $inStock = storeProduct('The Witcher 3', 1299, ['platform_id' => $platform->id]);
        $soldOut = storeProduct('Witcher Sold Out', null, ['platform_id' => $platform->id]);

        $row = fn (Product $product, ?array $price) => [
            'slug' => $product->slug,
            'name' => $product->name,
            'cover_image_url' => $product->cover_image_url,
            'platform' => ['slug' => 'steam', 'name' => 'Steam'],
            'price' => $price,
        ];

        // "Witcher Sold Out" starts with the term, so it ranks first despite having no stock.
        $this->getJson('/api/v1/search/suggestions?q=witcher')
            ->assertOk()
            ->assertExactJson(['data' => [
                $row($soldOut, null),
                $row($inStock, ['amount' => 1299, 'currency' => 'EUR']),
            ]]);
    });

    it('returns at most six active products and no pagination', function () {
        foreach (range(1, 8) as $i) {
            storeProduct("Witcher {$i}", 500);
        }
        storeProduct('Witcher Hidden', 500, ['is_active' => false]);

        $response = $this->getJson('/api/v1/search/suggestions?q=witcher')->assertOk();

        expect($response->json('data'))->toHaveCount(SuggestProducts::LIMIT)
            ->and($response->json('data.*.name'))->not->toContain('Witcher Hidden')
            ->and($response->json())->not->toHaveKeys(['links', 'meta']);
    });

    it('returns an empty list when nothing matches', function () {
        storeProduct('The Witcher 3', 500);

        $this->getJson('/api/v1/search/suggestions?q=zzzz')->assertOk()->assertExactJson(['data' => []]);
    });

    it('rejects a bad term with 422 keyed q', function (string $query) {
        $this->getJson("/api/v1/search/suggestions{$query}")
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['q']);
    })->with([
        'missing' => [''],
        'empty' => ['?q='],
        'one character after trim' => ['?q=%20a%20'],
        'too long' => ['?q='.str_repeat('a', 101)],
        'array' => ['?q[]=xx'],
        'NUL byte' => ['?q=a%00b'],
        'invalid UTF-8' => ['?q=%FF%FF'],
    ]);

    it('rejects a term of only Unicode whitespace', function (bool $trimStrings) {
        // TrimStrings strips Unicode whitespace; without it, only the request's word rule catches this term.
        if (! $trimStrings) {
            $this->withoutMiddleware(TrimStrings::class);
        }

        $this->getJson('/api/v1/search/suggestions?q='.rawurlencode("\u{3000}\u{2003}"))
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['q']);
    })->with(['with TrimStrings' => true, 'without TrimStrings' => false]);

    it('counts length in characters after trimming', function () {
        $this->getJson('/api/v1/search/suggestions?q='.rawurlencode('  '.str_repeat('ž', 100).'  '))->assertOk();
        $this->getJson('/api/v1/search/suggestions?q='.rawurlencode('žž'))->assertOk();
    });

    it('shares the catalog limiter', function () {
        for ($i = 0; $i < 120; $i++) {
            $this->getJson('/api/v1/search/suggestions?q=witcher');
        }

        $this->getJson('/api/v1/search/suggestions?q=witcher')
            ->assertTooManyRequests()
            ->assertHeader('Retry-After');
    });
});

it('runs a fixed number of queries', function (int $count) {
    Product::factory()->count($count)->sequence(fn ($sequence) => ['name' => "Witcher {$sequence->index}"])->create()
        ->each(fn (Product $product) => cartOffer(1, ['product_id' => $product->id]));

    DB::enableQueryLog();
    $this->getJson('/api/v1/search/suggestions?q=witchr')->assertOk();
    // threshold, products, platforms
    expect(DB::getQueryLog())->toHaveCount(3);

    DB::flushQueryLog();
    $this->getJson('/api/v1/products?q=witchr')->assertOk();
    // threshold, count, page, platforms, regions
    expect(DB::getQueryLog())->toHaveCount(5);
})->with([2, 12]);

it('runs the threshold and every search query in one transaction on one connection', function (string $url) {
    storeProduct('Starfield', 500);
    $log = [];
    $connections = [];

    Event::listen(TransactionBeginning::class, function () use (&$log) {
        $log[] = 'begin';
    });
    Event::listen(TransactionCommitted::class, function () use (&$log) {
        $log[] = 'commit';
    });
    DB::listen(function (QueryExecuted $query) use (&$log, &$connections) {
        $log[] = match (true) {
            str_contains($query->sql, 'set_config') => 'threshold',
            str_contains($query->sql, '<%') => 'search',
            default => 'other',
        };
        $connections[] = $query->connectionName;
    });

    $this->getJson($url)->assertOk();

    expect(implode(' ', $log))->toMatch('/^begin threshold search( search| other)* commit$/')
        ->and(array_unique($connections))->toBe([DB::getDefaultConnection()]);
})->with([
    'suggestions' => '/api/v1/search/suggestions?q=stardew',
    'products' => '/api/v1/products?q=stardew',
]);

it('adds the extension and index, and rolls back only the index', function () {
    $indexExists = fn () => DB::table('pg_indexes')->where('indexname', 'products_name_trgm_idx')->exists();
    $extensionExists = fn () => DB::table('pg_extension')->where('extname', 'pg_trgm')->exists();
    $migration = require database_path('migrations/2026_11_13_100001_add_name_trigram_index_to_products.php');

    expect($indexExists())->toBeTrue()->and($extensionExists())->toBeTrue();

    $migration->down();
    expect($indexExists())->toBeFalse()->and($extensionExists())->toBeTrue();

    $migration->up();
    expect($indexExists())->toBeTrue()->and($extensionExists())->toBeTrue();
});
