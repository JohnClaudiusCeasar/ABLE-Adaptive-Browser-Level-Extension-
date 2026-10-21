<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\EgressEvent;
use App\Models\RiskPattern;
use App\Support\ScanToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Typed text is not a file upload. It is audited only when the text itself
 * carried a risk score: the scan token's pattern score is what the scoring
 * service computed from the patterns matched in the text alone, and the
 * domain's own risk score is not part of it.
 *
 * A file upload is audited unconditionally — an upload is an egress incident
 * whether or not it turned out to be risky.
 */
class EgressAuditPolicyTest extends TestCase
{
    use RefreshDatabase;

    private const SIGNING_KEY = '13b6056f7f072c80853526109de9268317e4a09842f3508b3df31c2fbdfaec4d';

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('able.signing_key', self::SIGNING_KEY);
        Config::set('able.signing_key_version', 1);
    }

    private function ssnPattern(): void
    {
        RiskPattern::create([
            'title' => 'SSN - Standard Format',
            'type' => 'single',
            'regex' => '\b\d{3}-\d{2}-\d{4}\b',
            'score' => 35,
            'priority' => 'high',
        ]);
    }

    /**
     * The server's own verdict for a piece of text, as the extension receives it.
     */
    private function scanToken(string $domain, string $text): string
    {
        $response = $this->postJson('/api/score-content', [
            'domain' => $domain,
            'text' => $text,
        ]);

        $response->assertOk();

        return $response->json('scan_token');
    }

    private function postTextEgress(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/log-egress', array_merge([
            'domain' => 'unknown-site.test',
            'user_id' => 'ABLE-12345678',
            'file_name' => '[text-input]',
            'file_size' => 220,
            'risk_score' => 90,
            'action' => 'blocked',
            'user_action' => 'typing',
            'source' => 'text-intercept',
        ], $overrides));
    }

    public function test_text_event_without_a_scan_token_is_not_audited(): void
    {
        $response = $this->postTextEgress();

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'egress_event_id' => null,
            'skipped' => true,
            'reason' => 'unverified_scan',
        ]);

        $this->assertSame(0, EgressEvent::count());
    }

    public function test_text_event_with_a_token_for_another_domain_is_not_audited(): void
    {
        $this->ssnPattern();
        $token = $this->scanToken('other-site.test', '123-45-6789');

        $response = $this->postTextEgress(['scan_token' => $token]);

        $response->assertOk();
        $response->assertJson(['skipped' => true, 'reason' => 'unverified_scan']);

        $this->assertSame(0, EgressEvent::count());
    }

    public function test_text_event_with_a_tampered_token_is_not_audited(): void
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

        $response = $this->postTextEgress(['scan_token' => $forged]);

        $response->assertOk();
        $response->assertJson(['skipped' => true, 'reason' => 'unverified_scan']);

        $this->assertSame(0, EgressEvent::count());
    }

    public function test_text_event_with_a_pattern_hit_is_audited(): void
    {
        $this->ssnPattern();
        $token = $this->scanToken('unknown-site.test', '123-45-6789');

        $response = $this->postTextEgress(['scan_token' => $token]);

        $response->assertOk();

        $this->assertSame(1, EgressEvent::count());

        $event = EgressEvent::first();
        $this->assertSame('blocked', $event->action);
        $this->assertSame('typing', $event->nudgeInteractions()->first()->user_action);

        // The server's own score is authoritative, not the one the client sent.
        $this->assertSame(100, $event->risk_score);
        $this->assertNotNull($event->flagged_items);
    }

    public function test_text_event_without_a_pattern_hit_is_not_audited(): void
    {
        // Benign text on an unlisted domain: the domain carries risk, the text
        // does not. The domain's score is not part of the decision.
        $token = $this->scanToken('unknown-site.test', 'hello there');

        $response = $this->postTextEgress(['scan_token' => $token]);

        $response->assertOk();
        $response->assertJson(['skipped' => true, 'reason' => 'not_high_risk']);

        $this->assertSame(0, EgressEvent::count());
    }

    public function test_a_risky_domain_alone_does_not_justify_an_audit(): void
    {
        DomainPolicy::create([
            'domain' => 'risky-domain.test',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'risk_score' => 90,
        ]);

        // The domain scores 90 on its own — well past the risk threshold — but
        // the text matched nothing, so there is no incident.
        $token = $this->scanToken('risky-domain.test', 'hello there');

        $response = $this->postTextEgress([
            'domain' => 'risky-domain.test',
            'scan_token' => $token,
        ]);

        $response->assertOk();
        $response->assertJson(['skipped' => true, 'reason' => 'not_high_risk']);

        $this->assertSame(0, EgressEvent::count());
    }

    public function test_an_expired_but_signed_token_is_still_accepted(): void
    {
        // The event was queued while the server was unreachable and flushed
        // hours later: the signature still proves the verdict.
        $token = ScanToken::issue([
            'total_score' => 90,
            'pattern_score' => 70,
            'domain_risk_score' => 60,
            'flagged_items' => [],
            'domain' => 'unknown-site.test',
            'exp' => now()->subMinute()->timestamp,
        ]);

        $response = $this->postTextEgress(['scan_token' => $token]);

        $response->assertOk();

        $this->assertSame(1, EgressEvent::count());
        $this->assertSame(90, EgressEvent::first()->risk_score);
    }

    public function test_a_text_event_is_recognised_without_a_source_marker(): void
    {
        // A legacy client sends neither "source" nor "user_action" — only the
        // placeholder name.
        $this->ssnPattern();
        $token = $this->scanToken('unknown-site.test', '123-45-6789');

        $response = $this->postTextEgress([
            'scan_token' => $token,
            'source' => null,
            'user_action' => null,
        ]);

        $response->assertOk();

        $this->assertSame(1, EgressEvent::count());
    }

    public function test_file_events_are_audited_unconditionally(): void
    {
        $response = $this->postJson('/api/log-egress', [
            'domain' => 'unknown-site.test',
            'user_id' => 'ABLE-12345678',
            'file_name' => 'salaries.xlsx',
            'file_size' => 4096,
            'risk_score' => 0,
            'action' => 'proceeded',
            'user_action' => 'proceeded',
            'source' => 'file',
            'name_source' => 'user',
        ]);

        $response->assertOk();

        $this->assertSame(1, EgressEvent::count());
        $this->assertSame('salaries.xlsx', EgressEvent::first()->file_name);
    }
}
