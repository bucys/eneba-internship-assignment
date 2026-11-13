<?php

namespace App\Http\Requests\Checkout;

use App\Payments\CardDetails;
use App\Rules\Luhn;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The checkout body (spec 0009 AC-3). Each field has one message for every rule failure,
 * except the expiry, which also says when the card has expired. `bail` keeps it to one message.
 * Validated values are never echoed back (AC-7).
 */
class CheckoutRequest extends FormRequest
{
    private const CARD_NUMBER_MESSAGE = 'Enter a valid card number.';

    private const EXPIRY_FORMAT_MESSAGE = 'Enter the expiry date as MM/YY.';

    private const EXPIRED_MESSAGE = 'This card has expired.';

    private const MAX_YEARS_AHEAD = 20;

    /**
     * Only string values are normalised; any other type fails the `string` rule.
     */
    protected function prepareForValidation(): void
    {
        $number = $this->input('card_number');
        $name = $this->input('card_name');

        $this->merge(array_filter([
            'card_number' => is_string($number) ? str_replace([' ', '-'], '', $number) : null,
            'card_name' => is_string($name) ? trim($name) : null,
        ], fn ($value) => $value !== null));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'card_number' => ['bail', 'required', 'string', 'regex:/\A[0-9]{12,19}\z/', new Luhn(self::CARD_NUMBER_MESSAGE)],
            'card_expiry' => ['bail', 'required', 'string', 'regex:/\A(0[1-9]|1[0-2])\/[0-9]{2}\z/', $this->expiryRule()],
            'card_cvc' => ['bail', 'required', 'string', 'regex:/\A[0-9]{3,4}\z/'],
            'card_name' => ['bail', 'required', 'string', 'min:1', 'max:100'],
            'expected_total' => ['bail', 'required', 'integer:strict', 'min:0', 'max:2147483647'],
        ];
    }

    /**
     * Keyed per rule, not with `field.*`: a wildcard would also replace the expiry closure's
     * "expired" message. Rule objects (Luhn, the expiry closure) set their own message.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        $fields = [
            'card_number' => ['required', 'string', 'regex'],
            'card_expiry' => ['required', 'string', 'regex'],
            'card_cvc' => ['required', 'string', 'regex'],
            'card_name' => ['required', 'string', 'min', 'max'],
            'expected_total' => ['required', 'integer', 'min', 'max'],
        ];
        $text = [
            'card_number' => self::CARD_NUMBER_MESSAGE,
            'card_expiry' => self::EXPIRY_FORMAT_MESSAGE,
            'card_cvc' => 'Enter the 3 or 4 digit security code.',
            'card_name' => 'Enter the name on the card.',
            'expected_total' => 'Invalid total.',
        ];

        $messages = [];

        foreach ($fields as $field => $rules) {
            foreach ($rules as $rule) {
                $messages["{$field}.{$rule}"] = $text[$field];
            }
        }

        return $messages;
    }

    public function card(): CardDetails
    {
        [$month, $year] = self::parseExpiry($this->string('card_expiry')->value());

        return new CardDetails(
            number: $this->string('card_number')->value(),
            expiryMonth: $month,
            expiryYear: $year,
            cvc: $this->string('card_cvc')->value(),
            name: $this->string('card_name')->value(),
        );
    }

    public function expectedTotal(): int
    {
        return $this->integer('expected_total');
    }

    /**
     * Runs after the MM/YY regex, so the value is well formed. Compared in UTC.
     */
    private function expiryRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            [$month, $year] = self::parseExpiry((string) $value);
            $now = now('UTC');

            if ($year > $now->year + self::MAX_YEARS_AHEAD) {
                $fail(self::EXPIRY_FORMAT_MESSAGE);
            } elseif ($year * 12 + $month < $now->year * 12 + $now->month) {
                $fail(self::EXPIRED_MESSAGE);
            }
        };
    }

    /**
     * @return array{0: int, 1: int} month, four digit year
     */
    private static function parseExpiry(string $expiry): array
    {
        [$month, $year] = explode('/', $expiry);

        return [(int) $month, 2000 + (int) $year];
    }
}
