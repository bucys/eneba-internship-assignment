<?php

it('limits the product list to 120 requests per minute per IP', function () {
    for ($i = 0; $i < 120; $i++) {
        $this->getJson('/api/v1/products')->assertOk();
    }

    $this->getJson('/api/v1/products')
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');
});

it('counts each IP separately', function () {
    for ($i = 0; $i < 120; $i++) {
        $this->getJson('/api/v1/products', ['REMOTE_ADDR' => '10.0.0.1']);
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])
        ->getJson('/api/v1/products')
        ->assertOk();
});
