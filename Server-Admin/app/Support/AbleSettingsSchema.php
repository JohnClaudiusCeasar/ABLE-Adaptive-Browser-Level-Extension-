<?php

namespace App\Support;

/**
 * Single source of truth for editable ABLE settings.
 *
 * Every key declares its group, storage type, default value, validation rule,
 * and human description so the UI, validation, and runtime payload can all be
 * derived from one place instead of drifting apart.
 */
class AbleSettingsSchema
{
    public const GROUP_EXTENSION = 'extension';

    public const GROUP_SERVER = 'server';

    /**
     * Return every editable key keyed by group.
     *
     * @return array<string, array<string, array<string, mixed>>>
     */
    public static function all(): array
    {
        return [
            self::GROUP_EXTENSION => self::extension(),
            self::GROUP_SERVER => self::server(),
        ];
    }

    /**
     * Return the schema for a single group.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function group(string $group): array
    {
        return self::all()[$group] ?? [];
    }

    /**
     * Return flat defaults for a group.
     *
     * @return array<string, mixed>
     */
    public static function defaults(string $group): array
    {
        return collect(self::group($group))->map(fn (array $field) => $field['default'])->all();
    }

    /**
     * Return validation rules for a group.
     *
     * @return array<string, mixed>
     */
    public static function rules(string $group): array
    {
        return collect(self::group($group))
            ->mapWithKeys(fn (array $field, string $key) => [$key => $field['rule']])
            ->all();
    }

    /**
     * Return the public extension runtime schema (never includes secrets).
     *
     * @return array<string, array<string, mixed>>
     */
    public static function runtimeFields(): array
    {
        return collect(self::extension())
            ->reject(fn (array $field) => $field['sensitive'] ?? false)
            ->all();
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private static function extension(): array
    {
        return [
            'behavior.risk_threshold' => [
                'type' => 'integer',
                'default' => 85,
                'rule' => 'required|integer|min:0|max:100',
                'description' => 'Upload intercept threshold. A file triggers the modal when its risk score exceeds this value.',
            ],
            'behavior.modal_short_cooldown_ms' => [
                'type' => 'integer',
                'default' => 35000,
                'rule' => 'required|integer|min:0|max:3600000',
                'description' => 'Short cooldown between repeat-visit modals.',
            ],
            'behavior.modal_stagger_cooldown_ms' => [
                'type' => 'integer',
                'default' => 300000,
                'rule' => 'required|integer|min:0|max:3600000',
                'description' => 'Staggered cooldown used every third repeat-visit interaction.',
            ],
            'behavior.unsafe_modal_short_cooldown_ms' => [
                'type' => 'integer',
                'default' => 15000,
                'rule' => 'required|integer|min:0|max:3600000',
                'description' => 'Short cooldown between repeat-visit modals on unsafe domains.',
            ],
            'behavior.unsafe_modal_stagger_cooldown_ms' => [
                'type' => 'integer',
                'default' => 120000,
                'rule' => 'required|integer|min:0|max:3600000',
                'description' => 'Staggered cooldown used every third repeat-visit interaction on unsafe domains.',
            ],
            'behavior.session_consent_enabled' => [
                'type' => 'boolean',
                'default' => true,
                'rule' => 'required|boolean',
                'description' => 'Honor per-domain session consent before intercepting uploads.',
            ],
            'sync.cache_ttl_ms' => [
                'type' => 'integer',
                'default' => 60000,
                'rule' => 'required|integer|min:1000|max:86400000',
                'description' => 'In-memory domain classification cache TTL. Lower values make policy changes (such as enabling block access) take effect sooner.',
            ],
            'sync.risk_patterns_interval_minutes' => [
                'type' => 'integer',
                'default' => 1440,
                'rule' => 'required|integer|min:1|max:10080',
                'description' => 'How often the extension syncs risk patterns.',
            ],
            'sync.visit_log_flush_interval_minutes' => [
                'type' => 'integer',
                'default' => 5,
                'rule' => 'required|integer|min:1|max:1440',
                'description' => 'How often the extension retries queued visit logs.',
            ],
            'sync.egress_log_flush_interval_minutes' => [
                'type' => 'integer',
                'default' => 5,
                'rule' => 'required|integer|min:1|max:1440',
                'description' => 'How often the extension retries queued egress logs.',
            ],
            'connection.allowed_origins' => [
                'type' => 'array',
                'default' => [],
                'rule' => 'nullable|array',
                'description' => 'Origins the extension is allowed to contact. Empty falls back to the origin of SERVER_URL.',
            ],
            'connection.tls_pins' => [
                'type' => 'object',
                'default' => [],
                'rule' => 'nullable|array',
                'description' => 'TLS SPKI pins keyed by hostname. Each host maps to an array of base64 hashes.',
            ],
            'logging.rate_limit_default_backoff_ms' => [
                'type' => 'integer',
                'default' => 60000,
                'rule' => 'required|integer|min:1000|max:600000',
                'description' => 'Default backoff when a server returns 429 without a Retry-After header.',
            ],
            'logging.daily_egress_cap' => [
                'type' => 'integer',
                'default' => 500,
                'rule' => 'required|integer|min:1|max:100000',
                'description' => 'Per-user daily cap for egress log submissions.',
            ],
            'logging.visit_debounce_ms' => [
                'type' => 'integer',
                'default' => 5000,
                'rule' => 'required|integer|min:0|max:3600000',
                'description' => 'Same-domain visit debounce window.',
            ],
            'logging.skip_search_results' => [
                'type' => 'boolean',
                'default' => true,
                'rule' => 'required|boolean',
                'description' => 'Skip domain visit auditing for search engine result listings (e.g. Google, Yahoo, Bing).',
            ],
            'excluded_domains' => [
                'type' => 'array',
                'default' => ['localhost', '127.0.0.1', '[::1]'],
                'rule' => 'nullable|array',
                'description' => 'Domains the extension ignores completely.',
            ],
            'integrity.expected_inject_hash' => [
                'type' => 'string',
                'default' => '',
                'rule' => 'nullable|string|regex:/^[0-9a-fA-F]{64}$/',
                'description' => 'SHA-256 of inject/inject.js for the extension build that is deployed to users. Published inside the signed runtime payload so installed extensions can adopt the new pin without being reinstalled.',
            ],
            'integrity.expected_content_css_hash' => [
                'type' => 'string',
                'default' => '',
                'rule' => 'nullable|string|regex:/^[0-9a-fA-F]{64}$/',
                'description' => 'SHA-256 of content.css for the extension build that is deployed to users. Published inside the signed runtime payload alongside the inject.js pin.',
            ],
            'integrity.expected_synthetic_names_hash' => [
                'type' => 'string',
                'default' => '',
                'rule' => 'nullable|string|regex:/^[0-9a-fA-F]{64}$/',
                'description' => 'SHA-256 of core/synthetic-names.js, which is injected into the page world.',
            ],
            'integrity.expected_file_extractor_hash' => [
                'type' => 'string',
                'default' => '',
                'rule' => 'nullable|string|regex:/^[0-9a-fA-F]{64}$/',
                'description' => 'SHA-256 of inject/file-extractor.js, which is injected into the page world.',
            ],
            'integrity.expected_network_interceptor_hash' => [
                'type' => 'string',
                'default' => '',
                'rule' => 'nullable|string|regex:/^[0-9a-fA-F]{64}$/',
                'description' => 'SHA-256 of inject/network-interceptor.js, which wraps fetch and XHR in the page world.',
            ],
            'integrity.expected_file_tracker_hash' => [
                'type' => 'string',
                'default' => '',
                'rule' => 'nullable|string|regex:/^[0-9a-fA-F]{64}$/',
                'description' => 'SHA-256 of inject/file-tracker.js, which is injected into the page world.',
            ],
            'release.extension_version' => [
                'type' => 'string',
                'default' => '',
                'rule' => 'nullable|string|max:50',
                'description' => 'Version of the extension build that is deployed to users, read from Client-Extension/manifest.json when the release is published. Keeps the admin panel from advertising a version the extension does not have.',
            ],
        ];
    }

    /**
     * The web-accessible assets that are pinned by SHA-256, as
     * settings key => path inside the extension.
     *
     * Single source of truth on the server: the publish command writes these
     * keys and the admin panel renders them, so the two can never drift.
     *
     * @return array<string, string>
     */
    public static function integrityPinFiles(): array
    {
        return [
            'integrity.expected_inject_hash' => 'inject/inject.js',
            'integrity.expected_content_css_hash' => 'content.css',
            'integrity.expected_synthetic_names_hash' => 'core/synthetic-names.js',
            'integrity.expected_file_extractor_hash' => 'inject/file-extractor.js',
            'integrity.expected_network_interceptor_hash' => 'inject/network-interceptor.js',
            'integrity.expected_file_tracker_hash' => 'inject/file-tracker.js',
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private static function server(): array
    {
        return [
            'algorithm.default_risk_threshold' => [
                'type' => 'integer',
                'default' => 85,
                'rule' => 'required|integer|min:0|max:100',
                'description' => 'Fallback threshold used by server-side classification.',
            ],
            'algorithm.default_risk_score' => [
                'type' => 'integer',
                'default' => 60,
                'rule' => 'required|integer|min:0|max:100',
                'description' => 'Risk score assigned to unlisted domains.',
            ],
            'algorithm.safe_patterns' => [
                'type' => 'array',
                'default' => [
                    '/^([\w-]+\.)*\.(edu|gov|org)$/i',
                    '/^([\w-]+\.)*gov\.(uk|au|nz|ca)$/i',
                ],
                'rule' => 'nullable|array',
                'description' => 'Regexes that classify a domain as safe when no policy exists.',
            ],
            'algorithm.fallback_policy' => [
                'type' => 'string',
                'default' => 'under_review',
                'rule' => 'required|in:whitelisted,blacklisted,under_review',
                'description' => 'Policy assigned to unmatched domains.',
            ],
            'algorithm.auto_categorize_enabled' => [
                'type' => 'boolean',
                'default' => true,
                'rule' => 'required|boolean',
                'description' => 'Auto-assign a category to unlisted domains from page signals sent by the extension.',
            ],
            'ut1.sync_enabled' => [
                'type' => 'boolean',
                'default' => false,
                'rule' => 'required|boolean',
                'description' => 'Allow the weekly UT1 blacklist import (able:import-ut1) to upsert domain categories.',
            ],
            'ut1.sync_url' => [
                'type' => 'string',
                'default' => 'http://dsi.ut-capitole.fr/blacklists/download/blacklists.tar.gz',
                'rule' => 'nullable|string|max:2048',
                'description' => 'Download URL for the UT1 categorized blacklist tarball.',
            ],
            'security.tls_pins' => [
                'type' => 'object',
                'default' => [],
                'rule' => 'nullable|array',
                'description' => 'Server-side TLS SPKI pins keyed by hostname.',
            ],
            'security.excluded_domains' => [
                'type' => 'array',
                'default' => ['localhost', '127.0.0.1', '[::1]'],
                'rule' => 'nullable|array',
                'description' => 'Server-side excluded domains for telemetry.',
            ],
            'runtime.notification_sync_enabled' => [
                'type' => 'boolean',
                'default' => true,
                'rule' => 'required|boolean',
                'description' => 'Enable notification sync from source tables.',
            ],
            'runtime.audit_logging_enabled' => [
                'type' => 'boolean',
                'default' => true,
                'rule' => 'required|boolean',
                'description' => 'Enable audit logging of admin-editable entities.',
            ],
            'runtime.api_rate_limit' => [
                'type' => 'integer',
                'default' => 120,
                'rule' => 'required|integer|min:1|max:10000',
                'description' => 'Default per-minute API throttle for classification.',
            ],
        ];
    }
}
