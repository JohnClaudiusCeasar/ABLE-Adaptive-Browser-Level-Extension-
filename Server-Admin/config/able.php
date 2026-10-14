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

    /*
    |--------------------------------------------------------------------------
    | ABLE Extension - Excluded Domains
    |--------------------------------------------------------------------------
    |
    | Domains that the extension should ignore completely. No visits, egress
    | events, or nudge interactions are logged for these domains. This provides
    | defense-in-depth even if the extension is bypassed or outdated.
    |
    */

    'excluded_domains' => [
        'localhost',
        '127.0.0.1',
        '[::1]',
    ],

    /*
    |--------------------------------------------------------------------------
    | ABLE - UT1 Blacklist Sync
    |--------------------------------------------------------------------------
    |
    | Bulk download URL for the Université Toulouse Capitole categorized
    | blacklists. Synced via `php artisan able:import-ut1` — a bulk import,
    | never a per-visit lookup, so visited domains stay on our network.
    |
    */

    'ut1_sync_url' => env(
        'ABLE_UT1_SYNC_URL',
        'http://dsi.ut-capitole.fr/blacklists/download/blacklists.tar.gz'
    ),

    /*
    |--------------------------------------------------------------------------
    | Bootstrap Super Admin
    |--------------------------------------------------------------------------
    |
    | Guarantees at least one Super Admin account always exists. Only Super
    | Admins can reach the Team module, so without one the role system
    | deadlocks: every account is an Admin, all team routes return 403, and
    | nothing in the app can promote anyone.
    |
    | `php artisan app:bootstrap-superadmin` enforces this and the container
    | entrypoint runs it after migrations, so it also self-heals a demoted
    | or blocked account on the next boot.
    |
    | The local part is fixed and the domain is taken from APP_URL, so the
    | address follows whichever site the app is deployed on. Set
    | BOOTSTRAP_SUPERADMIN_EMAIL to override the whole address.
    |
    | NOTE: no credential is defined in this repository. Set
    | BOOTSTRAP_SUPERADMIN_PASSWORD in the environment (Render Dashboard ->
    | Environment, or your local .env) to make the account usable. While it
    | is unset the account still exists but is created with a random
    | password, so nobody can sign in as it.
    |
    | Generate one with:
    |   php -r "echo bin2hex(random_bytes(16)), PHP_EOL;"
    |
    | When set, this value is the source of truth for that account's
    | password and is re-applied on boot; change it in the environment, not
    | through the profile page.
    |
    */

    'bootstrap_superadmin_name' => env('BOOTSTRAP_SUPERADMIN_NAME', 'ABLE Super Admin'),
    'bootstrap_superadmin_local_part' => env('BOOTSTRAP_SUPERADMIN_LOCAL_PART', 'able-superadmin'),
    'bootstrap_superadmin_email' => env('BOOTSTRAP_SUPERADMIN_EMAIL'),
    'bootstrap_superadmin_password' => env('BOOTSTRAP_SUPERADMIN_PASSWORD'),

];
