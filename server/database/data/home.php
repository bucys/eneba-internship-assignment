<?php

/*
 * Homepage banners (spec 0014). HomeSeeder upserts them; the layout rows live in HomeSeeder.
 *
 * Banner copy is original and never names a price: the tile shows the live cheapest price.
 * Each banner's art is its product's cover_image_url, unless it names an `image` (a path under
 * server/public/, spec 0015 AC-12), which becomes an absolute URL built from APP_URL.
 */

return [
    'banners' => [
        [
            'product_slug' => 'cyberpunk-2077-xbox-europe',
            'title' => 'Cyberpunk 2077',
            'tagline' => 'Rewrite your body, pick your crew, and carve a name for yourself in Night City.',
            'cta_label' => 'Shop now',
            'image' => 'images/banners/cyberpunk-2077-featured.webp',
            'position' => 1,
        ],
        [
            'product_slug' => 'elden-ring-shadow-of-the-erdtree-steam-global',
            'title' => 'Shadow of the Erdtree',
            'tagline' => 'Cross into the Land of Shadow and face the hardest fights the Lands Between has ever seen.',
            'cta_label' => 'Buy now',
            'position' => 2,
        ],
        [
            'product_slug' => 'black-myth-wukong-playstation-europe',
            'title' => 'Black Myth: Wukong',
            'tagline' => 'Take up the staff of the Destined One and walk straight into a living myth.',
            'cta_label' => 'Buy now',
            'position' => 3,
        ],
        [
            'product_slug' => 'hollow-knight-xbox-north-america',
            'title' => 'Hollow Knight',
            'tagline' => 'Dive into a ruined bug kingdom full of secrets, charms, and brutal bosses.',
            'cta_label' => 'Get it now',
            'position' => 4,
        ],
        [
            'product_slug' => 'baldurs-gate-3-steam-global',
            'title' => "Baldur's Gate 3",
            'tagline' => 'Gather your party. Every roll of the dice writes a story only your group will tell.',
            'cta_label' => 'Shop now',
            'position' => 5,
        ],
        [
            'product_slug' => 'it-takes-two-nintendo-europe',
            'title' => 'It Takes Two',
            'tagline' => 'Grab a friend and fix a broken marriage, one wild co-op level at a time.',
            'cta_label' => 'Play together',
            'position' => 6,
        ],
        [
            'product_slug' => 'helldivers-2-playstation-europe',
            'title' => 'Helldivers 2',
            'tagline' => 'Drop in with your squad and spread managed democracy across the galaxy.',
            'cta_label' => 'Enlist now',
            'position' => 7,
        ],
        [
            'product_slug' => 'stardew-valley-nintendo-europe',
            'title' => 'Stardew Valley',
            'tagline' => 'Trade the city for an old farm, a quiet town, and seasons that fly by.',
            'cta_label' => 'Get it now',
            'position' => 8,
        ],
    ],
];
