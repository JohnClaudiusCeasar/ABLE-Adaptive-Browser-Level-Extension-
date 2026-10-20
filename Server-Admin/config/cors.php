<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing
    |--------------------------------------------------------------------------
    |
    | The extension API is not served with cross-origin headers.
    |
    | The browser extension reaches the API from its background service
    | worker, and a service worker with host permissions is exempt from the
    | browser's cross-origin checks, so no CORS headers are needed for it to
    | work.
    |
    | Leaving the paths empty keeps it that way: a response without an
    | Access-Control-Allow-Origin header cannot be read by a web page, so
    | the API stays unreadable from a site a user happens to be visiting.
    |
    | If a path is added here, make sure allowed_origins below is not a
    | wildcard, or the API becomes readable from any site.
    |
    */

    'paths' => [],

    'allowed_methods' => ['GET', 'POST', 'OPTIONS'],

    /*
     | The server's own origins. A wildcard here would let any site read
     | the API.
     */
    'allowed_origins' => array_values(array_filter([
        env('APP_URL'),
    ])),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Content-Type'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
