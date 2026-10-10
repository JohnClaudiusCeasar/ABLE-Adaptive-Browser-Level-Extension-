<?php

namespace App\Services;

use App\Models\DomainPolicy;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SettingsStatusService
{
    public function __construct(private AbleSettingsService $settings) {}

    /**
     * @return array<string, mixed>
     */
    public function extensionStatus(): array
    {
        $signingKey = (string) config('able.signing_key', '');

        return [
            'signing_key_ok' => strlen($signingKey) >= 32,
            'key_version' => (int) config('able.signing_key_version', 1),
            'extensions_24h' => $this->safeCount(fn () => ExtensionLifecycle::where('occurred_at', '>=', now()->subDay())->distinct('user_id')->count('user_id')),
            'egress_today' => $this->safeCount(fn () => EgressEvent::whereDate('occurred_at', today())->count()),
            'egress_cap' => (int) $this->settings->value('extension', 'logging.daily_egress_cap', 500),
            'jobs_pending' => $this->safeCount(fn () => DB::table('jobs')->count()),
            'extension_threshold' => (int) $this->settings->value('extension', 'behavior.risk_threshold', 85),
            'server_threshold' => (int) $this->settings->value('server', 'algorithm.default_risk_threshold', 85),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serverStatus(): array
    {
        $signingKey = (string) config('able.signing_key', '');

        return [
            'signing_key_ok' => strlen($signingKey) >= 32,
            'key_version' => (int) config('able.signing_key_version', 1),
            'ut1_enabled' => (bool) $this->settings->value('server', 'ut1.sync_enabled', false),
            'ut1_last_run' => Cache::get('ut1.last_import'),
            'ut1_url_fallback' => (string) config('able.ut1_sync_url'),
            'policy_counts' => $this->policyCounts(),
            'notification_sync_on' => (bool) $this->settings->value('server', 'runtime.notification_sync_enabled', true),
            'audit_on' => (bool) $this->settings->value('server', 'runtime.audit_logging_enabled', true),
            'api_rate_limit' => (int) $this->settings->value('server', 'runtime.api_rate_limit', 120),
            'extension_threshold' => (int) $this->settings->value('extension', 'behavior.risk_threshold', 85),
            'server_threshold' => (int) $this->settings->value('server', 'algorithm.default_risk_threshold', 85),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function policyCounts(): array
    {
        try {
            $rows = DomainPolicy::select('policy', DB::raw('count(*) as total'))->groupBy('policy')->pluck('total', 'policy');

            return [
                'whitelisted' => (int) ($rows['whitelisted'] ?? 0),
                'blacklisted' => (int) ($rows['blacklisted'] ?? 0),
                'under_review' => (int) ($rows['under_review'] ?? 0),
            ];
        } catch (\Throwable) {
            return ['whitelisted' => 0, 'blacklisted' => 0, 'under_review' => 0];
        }
    }

    private function safeCount(callable $callback): int
    {
        try {
            return (int) $callback();
        } catch (\Throwable) {
            return 0;
        }
    }
}
