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

    /*
    |--------------------------------------------------------------------------
    | ABLE Extension - Version Fallback
    |--------------------------------------------------------------------------
    |
    | The version shown in the admin sidebar next to the ABLE mark. The panel
    | prefers the version published from Client-Extension/manifest.json, then
    | the newest version an installed extension reported, and only falls back
    | to this value when neither is known. It exists so the version is never
    | blank, not as the source of truth.
    |
    | Set ABLE_EXTENSION_VERSION in the environment to match the build that
    | is deployed; publishing a release overrides it automatically.
    |
    */

    'extension_version' => env('ABLE_EXTENSION_VERSION', '0.1.2'),

    /*
    |--------------------------------------------------------------------------
    | ABLE Extension - Domain Policy Feed
    |--------------------------------------------------------------------------
    |
    | The fields the browser extension consumes from the signed domain-policy
    | feed. The extension reads exactly these and nothing else, so the feed
    | carries exactly these.
    |
    | Keeping the feed this narrow has two effects that matter for a small
    | server. The payload shrinks, and the feed stops depending on the
    | volatile visit counters — logging a visit no longer changes what the
    | extension sees, so it no longer invalidates the cached feed.
    |
    | This is the single place the feed's payload is defined. Adding a
    | column back widens both the signed and the unsigned feed, and with it
    | the memory the server needs to build them.
    |
    */

    'feed_fields' => [
        'domain',
        'domain_status',
        'category',
        'policy',
        'block_access',
        'risk_score',
    ],

    /*
    |--------------------------------------------------------------------------
    | ABLE Extension - Feed Cache
    |--------------------------------------------------------------------------
    |
    | The extension polls the signed feed every 15 minutes from every
    | installed copy. The built feed is cached and rebuilt only when a policy
    | changes in a way the extension can see.
    |
    | The feed is stored in the file cache store regardless of the default
    | store: a large policy set does not fit the `mediumText` column of the
    | database cache, and reading it from the database would turn every
    | request into a multi-megabyte round trip.
    |
    | The TTL is only a safety net for writes that bypass the model layer,
    | such as the bulk delete in the record purge.
    |
    */

    'feed_cache_store' => env('ABLE_FEED_CACHE_STORE', 'file'),

    'feed_cache_ttl' => (int) env('ABLE_FEED_CACHE_TTL', 3600),

    /*
    |--------------------------------------------------------------------------
    | ABLE - Research Data Retention
    |--------------------------------------------------------------------------
    |
    | How long research telemetry — visit events, egress events, scan
    | records and the notifications derived from them — is kept before it is
    | deleted. The window matches the retention period published in
    | PRIVACY.md.
    |
    | The prune runs from the scheduler and, on hosts without a cron, from
    | the container entrypoint.
    |
    */

    'retention_days' => (int) env('ABLE_RETENTION_DAYS', 365),

    /*
    |--------------------------------------------------------------------------
    | ABLE - Admin Page Row Limit
    |--------------------------------------------------------------------------
    |
    | The admin pages filter, sort and paginate their rows in the browser,
    | so the server sends the newest rows rather than paginating them. This
    | is how many rows it sends.
    |
    | Without a limit, a telemetry table that grew for a year would be read
    | in full on every page view and could exhaust the server's memory. When
    | the limit is reached the page says so, rather than silently showing a
    | truncated list.
    |
    */

    'admin_page_limit' => (int) env('ABLE_ADMIN_PAGE_LIMIT', 500),

    /*
    |--------------------------------------------------------------------------
    | ABLE - Live Telemetry Auto-Refresh
    |--------------------------------------------------------------------------
    |
    | How often the admin panel asks the server whether the telemetry it is
    | showing has moved. The probe is a pair of indexed aggregates, so it is
    | cheap, but it still costs a request on the same box the extension
    | writes to — keep the interval generous on a small deployment.
    |
    | The panel only re-renders a page when the fingerprint of the data that
    | page actually displays has changed, so a visit never re-renders the
    | egress view. Turning the feature off leaves the panel on manual
    | refresh only.
    |
    */

    'telemetry_poll_interval_ms' => (int) env('ABLE_TELEMETRY_POLL_INTERVAL_MS', 5000),

    'telemetry_auto_refresh_enabled' => (bool) env('ABLE_TELEMETRY_AUTO_REFRESH_ENABLED', true),

];
