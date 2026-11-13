<?php

it('shares the catalog limit of 120 requests per minute per IP', function (string $path) {
    for ($i = 0; $i < 120; $i++) {
        $this->getJson($path)->assertOk();
    }

    $this->getJson($path)->assertTooManyRequests()->assertHeader('Retry-After');
})->with(['/api/v1/home', '/api/v1/home/banners', '/api/v1/home/best-sellers', '/api/v1/home/deals']);

it('is public and lets previews call it', function () {
    $this->getJson('/api/v1/home', ['Origin' => 'https://eneba-git-feature.vercel.app'])->assertOk();
});
