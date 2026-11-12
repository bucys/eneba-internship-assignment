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
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])->getJson('/api/v1/products');
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.1'])
        ->getJson('/api/v1/products')
        ->assertTooManyRequests();

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])
        ->getJson('/api/v1/products')
        ->assertOk();
});

it('ignores a forged X-Forwarded-For when keying the limit', function () {
    $client = '203.0.113.50';

    $this->withServerVariables(['REMOTE_ADDR' => $client])
        ->getJson('/api/v1/products', ['X-Forwarded-For' => "198.51.100.7, {$client}"])
        ->assertHeader('X-RateLimit-Remaining', '119');

    $this->withServerVariables(['REMOTE_ADDR' => $client])
        ->getJson('/api/v1/products', ['X-Forwarded-For' => "198.51.100.8, {$client}"])
        ->assertHeader('X-RateLimit-Remaining', '118');
});

it('still builds https links from X-Forwarded-Proto', function () {
    $this->getJson('/api/v1/products', ['X-Forwarded-Proto' => 'https'])
        ->assertOk()
        ->assertJsonPath('links.first', fn (string $url) => str_starts_with($url, 'https://'));
});
