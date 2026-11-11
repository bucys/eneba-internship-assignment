<?php

// The SPA always talks to /api/*, so errors there must come back as JSON, never as an HTML page.

it('returns a JSON 404 for an unknown api route, even without an Accept header', function () {
    $this->get('/api/v1/route-that-does-not-exist')
        ->assertNotFound()
        ->assertHeader('Content-Type', 'application/json')
        ->assertJsonStructure(['message']);
});

it('returns a JSON 404 for any route when the client asks for JSON', function () {
    $this->getJson('/route-that-does-not-exist')
        ->assertNotFound()
        ->assertJsonStructure(['message']);
});

it('keeps HTML error pages for browser requests outside the api', function () {
    $response = $this->get('/route-that-does-not-exist', ['Accept' => 'text/html']);

    $response->assertNotFound();
    expect($response->headers->get('Content-Type'))->toContain('text/html');
});

it('does not leak a stack trace in api errors when debug is off', function () {
    config()->set('app.debug', false);

    $this->get('/api/v1/route-that-does-not-exist')
        ->assertNotFound()
        ->assertJsonMissingPath('exception')
        ->assertJsonMissingPath('trace');
});
