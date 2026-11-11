<?php

$frontendUrl = trim((string) env('FRONTEND_URL', ''));
$previewPattern = trim((string) env('CORS_PREVIEW_ORIGIN_PATTERN', ''));

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Only the production SPA origin and this project's Vercel previews may call
    | the API from a browser (spec 0001). Never use a wildcard origin here.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $frontendUrl === '' ? [] : [$frontendUrl],

    // The package runs preg_match on each pattern, so the bare regex needs delimiters.
    // A blank value must stay an empty list: wrapping '' gives '##', which matches every origin.
    'allowed_origins_patterns' => $previewPattern === '' ? [] : ['#'.$previewPattern.'#'],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
