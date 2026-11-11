<?php

$frontendUrl = trim((string) env('FRONTEND_URL', ''));
$previewPattern = trim((string) env('CORS_PREVIEW_ORIGIN_PATTERN', ''));

// The CORS package runs preg_match on each pattern, so each needs delimiters.
// FRONTEND_URL goes in as an exact pattern, not in allowed_origins: with a single
// allowed origin and no patterns, the package sends that origin to every request.
// A blank preview pattern must stay out of the list: wrapping '' gives '##', which matches every origin.
$originPatterns = [];
if ($frontendUrl !== '') {
    $originPatterns[] = '#^'.preg_quote($frontendUrl, '#').'$#';
}
if ($previewPattern !== '') {
    $originPatterns[] = '#'.$previewPattern.'#';
}

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Only the production SPA origin and this project's Vercel previews may call
    | the API from a browser (spec 0001, spec 0005 AC-6). Never use a wildcard origin.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [],

    'allowed_origins_patterns' => $originPatterns,

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
