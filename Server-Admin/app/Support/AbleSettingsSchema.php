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
                'default' => 90,
                'rule' => 'required|integer|min:0|max:100',
                'description' => 'Upload intercept threshold. A file triggers the modal when its risk score exceeds this value.',
            ],
            'behavior.modal_short_cooldown_ms' => [
                'type' => 'integer',
                'default' => 10000,
                'rule' => 'required|integer|min:0|max:3600000',
                'description' => 'Short cooldown between repeat-visit modals.',
            ],
            'behavior.modal_stagger_cooldown_ms' => [
                'type' => 'integer',
                'default' => 300000,
                'rule' => 'required|integer|min:0|max:3600000',
                'description' => 'Staggered cooldown used every third repeat-visit interaction.',
            ],
            'behavior.session_consent_enabled' => [
                'type' => 'boolean',
                'default' => true,
                'rule' => 'required|boolean',
                'description' => 'Honor per-domain session consent before intercepting uploads.',
            ],
            'sync.cache_ttl_ms' => [
                'type' => 'integer',
                'default' => 300000,
                'rule' => 'required|integer|min:1000|max:86400000',
                'description' => 'In-memory domain classification cache TTL.',
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
            'excluded_domains' => [
                'type' => 'array',
                'default' => ['localhost', '127.0.0.1', '[::1]'],
                'rule' => 'nullable|array',
                'description' => 'Domains the extension ignores completely.',
            ],
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
                'default' => 90,
                'rule' => 'required|integer|min:0|max:100',
                'description' => 'Fallback threshold used by server-side classification.',
            ],
            'algorithm.default_risk_score' => [
                'type' => 'integer',
                'default' => 70,
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
