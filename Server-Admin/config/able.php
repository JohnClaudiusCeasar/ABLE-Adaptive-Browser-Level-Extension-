<?php

return [

    /*
    |--------------------------------------------------------------------------
    | ABLE Extension - Signing Key
    |--------------------------------------------------------------------------
    |
    | The HMAC-SHA256 secret used to sign offline cache payloads (domain
    | policies, risk patterns) returned to the browser extension. The
    | extension verifies these signatures before trusting cached data.
    |
    | Generate a fresh key with:
    |   php -r "echo bin2hex(random_bytes(32));"
    |
    | The matching public key (hex) must be embedded in the extension at
    | Client-Extension/config.js under PUBLIC_KEYS[<key_version>].
    |
    */

    'signing_key' => env('ABLE_SIGNING_KEY'),
    'signing_key_version' => env('ABLE_SIGNING_KEY_VERSION', 1),

];
