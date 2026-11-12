<?php

namespace App\Http\Requests\Cart;

use App\Support\CartLimits;
use Illuminate\Foundation\Http\FormRequest;

class AddCartItemRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'offer_id' => ['required', 'integer', 'min:1', 'max:'.PHP_INT_MAX],
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:'.CartLimits::MAX_LINE_QUANTITY],
        ];
    }
}
