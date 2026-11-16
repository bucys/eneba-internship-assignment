<?php

use App\Support\RequestTimings;

// covers: spec 0016 AC-1 (the db duration is the sum of query times, n is the query count)

it('starts at zero queries and zero time', function () {
    $timings = new RequestTimings;

    expect($timings->queryCount)->toBe(0)
        ->and($timings->queryMs)->toBe(0.0);
});

it('adds up every recorded query', function () {
    $timings = new RequestTimings;

    $timings->record(1.5);
    $timings->record(2.25);
    $timings->record(0.0);

    expect($timings->queryCount)->toBe(3)
        ->and($timings->queryMs)->toBe(3.75);
});

it('starts over from zero after a reset', function () {
    $timings = new RequestTimings;
    $timings->record(4.0);

    $timings->reset();
    $timings->record(1.0);

    expect($timings->queryCount)->toBe(1)
        ->and($timings->queryMs)->toBe(1.0);
});
