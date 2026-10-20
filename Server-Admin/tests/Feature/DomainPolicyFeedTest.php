<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Services\DomainPolicyFeed;
use App\Support\JsCanonical;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class DomainPolicyFeedTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = '13b6056f7f072c80853526109de9268317e4a09842f3508b3df31c2fbdfaec4d';

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('able.signing_key', self::KEY);
        Config::set('able.signing_key_version', 1);
    }

    private function policy(string $domain = 'example.test'): DomainPolicy
    {
        return DomainPolicy::create([
            'domain' => $domain,
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'block_access' => true,
            'category' => 'Gambling',
            'risk_score' => 70,
        ]);
    }

    public function test_signed_feed_signature_verifies_against_the_returned_payload(): void
    {
        $this->policy();

        $response = $this->getJson('/api/domain-policies/signed');

        $response->assertOk()->assertJsonStructure([
            'payload' => ['policies', 'issued_at'],
            'signature',
            'key_version',
        ]);

        // The extension re-canonicalizes the payload it received and checks
        // the signature against it, so the two must agree byte for byte.
        $this->assertSame(
            $response->json('signature'),
            JsCanonical::sign($response->json('payload'), self::KEY),
        );
    }

    public function test_signed_feed_carries_only_the_fields_the_extension_reads(): void
    {
        $this->policy();

        $policy = $this->getJson('/api/domain-policies/signed')->json('payload.policies.0');

        $this->assertSame(
            ['block_access', 'category', 'domain', 'domain_status', 'policy', 'risk_score'],
            array_keys($policy),
        );
        $this->assertSame('example.test', $policy['domain']);
        $this->assertTrue($policy['block_access']);
        $this->assertSame(70, $policy['risk_score']);
    }

    public function test_signed_feed_carries_an_etag_and_revalidates_with_304(): void
    {
        $this->policy();

        $first = $this->get('/api/domain-policies/signed');
        $etag = $first->headers->get('ETag');

        $this->assertNotNull($etag);
        $this->assertNotSame('', $etag);

        $this->get('/api/domain-policies/signed', ['If-None-Match' => $etag])
            ->assertStatus(304);
    }

    public function test_unsigned_feed_reports_the_policy_count(): void
    {
        $this->policy('one.test');
        $this->policy('two.test');

        $response = $this->getJson('/api/domain-policies');

        $response->assertOk();
        $this->assertSame(2, $response->json('count'));
        $this->assertCount(2, $response->json('policies'));
    }

    public function test_a_policy_change_is_reflected_in_the_served_feed(): void
    {
        $policy = $this->policy();

        $before = $this->get('/api/domain-policies/signed')->getContent();

        $policy->update(['domain_status' => 'safe', 'risk_score' => 0]);

        $after = $this->get('/api/domain-policies/signed')->getContent();

        $this->assertNotSame($before, $after);
        $this->assertSame('safe', $this->getJson('/api/domain-policies/signed')->json('payload.policies.0.domain_status'));
    }

    public function test_visit_counters_do_not_affect_the_feed(): void
    {
        $feed = app(DomainPolicyFeed::class);

        // Logging a visit bumps the counter and the last-visit stamp. Neither
        // is part of the feed, so a visit must not force a rebuild.
        $this->assertFalse($feed->affectsFeed([
            'visit_count' => 3,
            'last_visited_at' => now(),
            'last_source' => 'extension',
            'updated_at' => now(),
        ]));

        $this->assertTrue($feed->affectsFeed(['domain_status' => 'unsafe']));
        $this->assertTrue($feed->affectsFeed(['risk_score' => 10]));
        $this->assertTrue($feed->affectsFeed(['block_access' => true]));
        $this->assertTrue($feed->affectsFeed(['policy' => 'blacklisted']));
        $this->assertTrue($feed->affectsFeed(['category' => 'Gambling']));
        $this->assertTrue($feed->affectsFeed(['domain' => 'other.test']));
    }
}
