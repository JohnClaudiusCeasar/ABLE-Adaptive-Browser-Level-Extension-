<?php

namespace Tests\Feature;

use App\Models\EgressEvent;
use App\Models\RiskPattern;
use App\Support\JsCanonical;
use App\Support\ScanToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class ScoreContentTest extends TestCase
{
    use RefreshDatabase;

    private const SIGNING_KEY = '13b6056f7f072c80853526109de9268317e4a09842f3508b3df31c2fbdfaec4d';

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('able.signing_key', self::SIGNING_KEY);
        Config::set('able.signing_key_version', 1);
    }

    public function test_null_text_returns_domain_baseline_never_zero(): void
    {
        $response = $this->postJson('/api/score-content', [
            'domain' => 'unknown-site.test',
            'file_name' => 'upload.pdf',
            'file_size' => 4096,
        ]);

        $response->assertOk();

        $payload = $response->json('payload');
        $this->assertSame(60, $payload['domain_risk_score']);
        $this->assertSame(60, $payload['total_score']);
        $this->assertSame(0, $payload['pattern_score']);
        $this->assertSame('unlisted', $payload['domain_status']);
        $this->assertSame('Domain Risk (Unlisted)', $payload['flagged_items'][0]['label']);

        // Envelope is HMAC-signed and verifiable.
        $this->assertSame(JsCanonical::sign($payload, self::SIGNING_KEY), $response->json('signature'));
        $this->assertSame(1, $response->json('key_version'));

        $claims = ScanToken::verify($response->json('scan_token'));
        $this->assertNotNull($claims);
        $this->assertSame(60, $claims['total_score']);
    }

    public function test_scores_text_against_database_patterns(): void
    {
        RiskPattern::create([
            'title' => 'SSN - Standard Format',
            'type' => 'single',
            'regex' => '\b\d{3}-\d{2}-\d{4}\b',
            'score' => 35,
            'priority' => 'high',
        ]);

        $response = $this->postJson('/api/score-content', [
            'domain' => 'unknown-site.test',
            'text' => '123-45-6789',
            'file_name' => 'records.txt',
        ]);

        $response->assertOk();

        $payload = $response->json('payload');
        $this->assertSame(70, $payload['pattern_score']);
        $this->assertSame(100, $payload['total_score']);
        $this->assertSame('SSN - Standard Format', $payload['flagged_items'][1]['label']);
        $this->assertSame(70, $payload['flagged_items'][1]['weight']);
    }

    public function test_file_type_multiplier_applies_to_pattern_score_only(): void
    {
        RiskPattern::create([
            'title' => 'SSN - Standard Format',
            'type' => 'single',
            'regex' => '\b\d{3}-\d{2}-\d{4}\b',
            'score' => 10,
            'priority' => 'high',
        ]);

        $base = $this->postJson('/api/score-content', [
            'domain' => 'unknown-site.test',
            'text' => '123-45-6789',
        ])->json('payload');

        $csv = $this->postJson('/api/score-content', [
            'domain' => 'unknown-site.test',
            'text' => '123-45-6789',
            'file_type' => 'csv',
        ])->json('payload');

        // 10 * 2.0 (density) = 20 raw; csv multiplier 1.5 => 30.
        $this->assertSame(20, $base['pattern_score']);
        $this->assertSame(30, $csv['pattern_score']);
    }

    public function test_scan_token_overrides_client_supplied_score_on_log_egress(): void
    {
        $score = $this->postJson('/api/score-content', [
            'domain' => 'unknown-site.test',
            'text' => '123-45-6789',
            'event_id' => 'evt-1',
        ])->json();

        $response = $this->postJson('/api/log-egress', [
            'domain' => 'unknown-site.test',
            'user_id' => 'ABLE-TESTTEST',
            'file_name' => 'records.txt',
            'file_size' => 11,
            'risk_score' => 0,
            'action' => 'proceeded',
            'scan_token' => $score['scan_token'],
        ]);

        $response->assertOk();

        $event = EgressEvent::first();
        $this->assertNotNull($event);
        $this->assertSame($score['payload']['total_score'], $event->risk_score);
        $this->assertSame('Domain Risk (Unlisted)', $event->flagged_items[0]['label']);
    }

    public function test_tampered_scan_token_is_ignored(): void
    {
        $forged = ScanToken::issue([
            'total_score' => 99,
            'pattern_score' => 99,
            'domain_risk_score' => 0,
            'flagged_items' => [],
            'domain' => 'unknown-site.test',
            'exp' => now()->addHour()->timestamp,
        ]);
        $forged = str_replace('"total_score":99', '"total_score":5', $forged);

        $response = $this->postJson('/api/log-egress', [
            'domain' => 'unknown-site.test',
            'user_id' => 'ABLE-TESTTEST',
            'file_name' => 'records.txt',
            'file_size' => 11,
            'risk_score' => 7,
            'action' => 'proceeded',
            'scan_token' => $forged,
        ]);

        $response->assertOk();
        $event = EgressEvent::first();
        $this->assertNotNull($event);
        $this->assertSame(7, $event->risk_score);
    }

    public function test_expired_scan_token_is_ignored(): void
    {
        $expired = ScanToken::issue([
            'total_score' => 99,
            'pattern_score' => 99,
            'domain_risk_score' => 0,
            'flagged_items' => [],
            'domain' => 'unknown-site.test',
            'exp' => now()->subMinute()->timestamp,
        ]);

        $response = $this->postJson('/api/log-egress', [
            'domain' => 'unknown-site.test',
            'user_id' => 'ABLE-TESTTEST',
            'file_name' => 'records.txt',
            'file_size' => 11,
            'risk_score' => 7,
            'action' => 'proceeded',
            'scan_token' => $expired,
        ]);

        $response->assertOk();
        $this->assertSame(7, EgressEvent::first()->risk_score);
    }

    public function test_blocked_text_check_events_persist(): void
    {
        $response = $this->postJson('/api/log-egress', [
            'domain' => 'unknown-site.test',
            'user_id' => 'ABLE-TESTTEST',
            'file_name' => '[text-input]',
            'file_size' => 220,
            'risk_score' => 92,
            'action' => 'blocked',
            'user_action' => 'typing',
        ]);

        $response->assertOk();
        $this->assertSame(1, EgressEvent::count());
        $this->assertSame('blocked', EgressEvent::first()->action);
    }

    public function test_scored_event_upgrades_unscored_duplicate_row(): void
    {
        // Unscored fallback row (no scan data) logged first.
        $this->postJson('/api/log-egress', [
            'domain' => 'unknown-site.test',
            'user_id' => 'ABLE-TESTTEST',
            'file_name' => 'records.txt',
            'file_size' => 11,
            'risk_score' => 60,
            'action' => 'proceeded',
        ])->assertOk();

        $this->assertSame(1, EgressEvent::count());
        $this->assertNull(EgressEvent::first()->flagged_items);

        // The scanned verdict for the same upload arrives moments later.
        $score = $this->postJson('/api/score-content', [
            'domain' => 'unknown-site.test',
            'text' => '123-45-6789',
        ])->json();

        $response = $this->postJson('/api/log-egress', [
            'domain' => 'unknown-site.test',
            'user_id' => 'ABLE-TESTTEST',
            'file_name' => 'records.txt',
            'file_size' => 11,
            'risk_score' => 0,
            'action' => 'proceeded',
            'content_hash' => 'abc123',
            'scan_token' => $score['scan_token'],
        ]);

        $response->assertOk()->assertJson(['duplicate' => false, 'upgraded' => true]);

        $this->assertSame(1, EgressEvent::count());
        $event = EgressEvent::first();
        $this->assertSame($score['payload']['total_score'], $event->risk_score);
        $this->assertSame('Domain Risk (Unlisted)', $event->flagged_items[0]['label']);
        $this->assertSame('abc123', $event->content_hash);
    }

    public function test_scored_duplicates_are_still_deduplicated(): void
    {
        $score = $this->postJson('/api/score-content', [
            'domain' => 'unknown-site.test',
            'text' => '123-45-6789',
        ])->json();

        foreach ([1, 2] as $attempt) {
            $this->postJson('/api/log-egress', [
                'domain' => 'unknown-site.test',
                'user_id' => 'ABLE-TESTTEST',
                'file_name' => 'records.txt',
                'file_size' => 11,
                'risk_score' => 0,
                'action' => 'proceeded',
                'content_hash' => 'abc123',
                'scan_token' => $score['scan_token'],
            ])->assertOk();
        }

        $this->assertSame(1, EgressEvent::count());
    }

    public function test_oversized_text_is_rejected(): void
    {
        $response = $this->postJson('/api/score-content', [
            'domain' => 'unknown-site.test',
            'text' => str_repeat('a', 200001),
        ]);

        $response->assertStatus(422);
    }
}
