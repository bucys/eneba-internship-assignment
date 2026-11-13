<?php

namespace App\Http\Requests\Catalog;

use App\Support\SearchTerms;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use LogicException;

/**
 * The header search term (spec 0013 AC-4). Shares the text rules with the store search,
 * so the two requests cannot drift apart.
 */
class SearchSuggestionsRequest extends FormRequest
{
    public const MIN_QUERY_LENGTH = 2;

    protected function prepareForValidation(): void
    {
        $q = $this->query('q');

        if (is_string($q)) {
            $this->merge(['q' => trim($q)]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'q' => [
                'bail',
                'required',
                'string',
                'regex:'.ListProductsRequest::TEXT_PATTERN,
                'min:'.self::MIN_QUERY_LENGTH,
                'max:'.ListProductsRequest::MAX_QUERY_LENGTH,
                $this->hasWordsRule(),
            ],
        ];
    }

    /**
     * The `q` rules guarantee at least one word, so the throw only flags a broken rule.
     */
    public function terms(): SearchTerms
    {
        return SearchTerms::fromQuery($this->validated('q'))
            ?? throw new LogicException('A validated search term has no words.');
    }

    /**
     * Fails a term of only Unicode whitespace (U+3000, U+2003, ...), which PHP's trim() keeps.
     */
    private function hasWordsRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (SearchTerms::fromQuery((string) $value) === null) {
                $fail("The {$attribute} field must contain a word.");
            }
        };
    }
}
