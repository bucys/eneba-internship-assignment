<?php

use App\Support\Discount;

it('computes the whole percent off, rounded down', function (?int $list, ?int $price, ?int $expected) {
    expect(Discount::percent($list, $price))->toBe($expected);
})->with([
    'regular discount' => [3999, 1299, 67],
    'rounds down to zero' => [1000, 999, null],
    'no discount' => [1000, 1000, null],
    'price above list' => [1000, 1200, null],
    'no list price' => [null, 500, null],
    'no price' => [1000, null, null],
]);
