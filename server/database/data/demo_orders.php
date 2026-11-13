<?php

/*
 * Demo orders for the Best sellers block (spec 0014 AC-7). DemoOrdersSeeder places each one
 * through the real cart and checkout code as demo-buyer@example.com. Keys are fixed, so a rerun
 * skips orders already placed.
 *
 * Every product here has planned stock (OfferPlanner) well above its total. Intended units per
 * product, which is the Best sellers order on a fresh database:
 *
 *   15  elden-ring-steam-global
 *   14  cyberpunk-2077-steam-global
 *   13  red-dead-redemption-2-playstation-europe
 *   12  hogwarts-legacy-steam-global
 *   11  the-witcher-3-wild-hunt-complete-edition-playstation-europe
 *   10  call-of-duty-black-ops-iii-steam-global
 *    9  ea-sports-fc-25-playstation-europe
 *    8  god-of-war-steam-global
 *    7  hollow-knight-steam-global
 *    6  black-myth-wukong-playstation-europe
 *    5  grand-theft-auto-v-steam-global
 *    4  helldivers-2-steam-global
 */

return [
    [
        'key' => 'c6192dc0-d4d5-44fa-bdae-9591b5edc7f1',
        'lines' => [
            ['elden-ring-steam-global', 3],
            ['hogwarts-legacy-steam-global', 3],
            ['god-of-war-steam-global', 3],
        ],
    ],
    [
        'key' => 'a865f687-1501-4f6a-905e-b23507fbc312',
        'lines' => [
            ['elden-ring-steam-global', 3],
            ['hogwarts-legacy-steam-global', 3],
            ['god-of-war-steam-global', 3],
        ],
    ],
    [
        'key' => '1b6f0c23-94a1-44c4-b374-7c040191c783',
        'lines' => [
            ['elden-ring-steam-global', 3],
            ['hogwarts-legacy-steam-global', 3],
            ['god-of-war-steam-global', 2],
        ],
    ],
    [
        'key' => '66974e2a-e89e-421a-ab34-811af07e86fa',
        'lines' => [
            ['elden-ring-steam-global', 3],
            ['hogwarts-legacy-steam-global', 3],
            ['hollow-knight-steam-global', 3],
        ],
    ],
    [
        'key' => 'c28762af-0b41-45a1-a5b4-27e5eeeed18a',
        'lines' => [
            ['elden-ring-steam-global', 3],
            ['the-witcher-3-wild-hunt-complete-edition-playstation-europe', 3],
            ['hollow-knight-steam-global', 3],
        ],
    ],
    [
        'key' => 'c9f7581e-0a01-4833-8bfc-d692d530beca',
        'lines' => [
            ['cyberpunk-2077-steam-global', 3],
            ['the-witcher-3-wild-hunt-complete-edition-playstation-europe', 3],
            ['hollow-knight-steam-global', 1],
        ],
    ],
    [
        'key' => '8822a4ed-a651-47dc-95c6-5fcf56d439a7',
        'lines' => [
            ['cyberpunk-2077-steam-global', 3],
            ['the-witcher-3-wild-hunt-complete-edition-playstation-europe', 3],
            ['black-myth-wukong-playstation-europe', 3],
        ],
    ],
    [
        'key' => 'eba9f3b0-2632-4174-8e8f-9cc32b861263',
        'lines' => [
            ['cyberpunk-2077-steam-global', 3],
            ['the-witcher-3-wild-hunt-complete-edition-playstation-europe', 2],
            ['black-myth-wukong-playstation-europe', 3],
        ],
    ],
    [
        'key' => '9ef14e3e-2791-4b7c-9cb3-902d7210daa7',
        'lines' => [
            ['cyberpunk-2077-steam-global', 3],
            ['call-of-duty-black-ops-iii-steam-global', 3],
            ['grand-theft-auto-v-steam-global', 3],
        ],
    ],
    [
        'key' => 'cddc88e0-322f-45b0-8847-465c7ca6ffca',
        'lines' => [
            ['cyberpunk-2077-steam-global', 2],
            ['call-of-duty-black-ops-iii-steam-global', 3],
            ['grand-theft-auto-v-steam-global', 2],
        ],
    ],
    [
        'key' => '44fd12f3-9b69-4521-ab05-24f760b8608d',
        'lines' => [
            ['red-dead-redemption-2-playstation-europe', 3],
            ['call-of-duty-black-ops-iii-steam-global', 3],
            ['helldivers-2-steam-global', 3],
        ],
    ],
    [
        'key' => '1bcd1e40-8988-4228-84dd-94ffcdc4d3fc',
        'lines' => [
            ['red-dead-redemption-2-playstation-europe', 3],
            ['call-of-duty-black-ops-iii-steam-global', 1],
            ['helldivers-2-steam-global', 1],
        ],
    ],
    [
        'key' => 'd7de30bb-f4b6-43ba-b65d-0a82b1b8678c',
        'lines' => [
            ['red-dead-redemption-2-playstation-europe', 3],
            ['ea-sports-fc-25-playstation-europe', 3],
        ],
    ],
    [
        'key' => '3f1dd8d2-c645-4e72-9c29-ebabbe5d4e68',
        'lines' => [
            ['red-dead-redemption-2-playstation-europe', 3],
            ['ea-sports-fc-25-playstation-europe', 3],
        ],
    ],
    [
        'key' => 'fc3a3546-7939-43ca-a15c-44b9851656e8',
        'lines' => [
            ['red-dead-redemption-2-playstation-europe', 1],
            ['ea-sports-fc-25-playstation-europe', 3],
        ],
    ],
];
