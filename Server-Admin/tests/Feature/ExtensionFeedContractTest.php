<?php

namespace Tests\Feature;

use App\Models\CriteriaPatternItem;
use App\Models\DomainPolicy;
use App\Models\RiskPattern;
use App\Support\JsCanonical;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Locks the payloads the browser extension depends on.
 *
 * The extension verifies a signed payload by re-canonicalizing the object it
 * received and checking the HMAC over those bytes, so two things have to
 * hold for every feed:
 *
 *  - the payload carries the fields the extension reads, and
 *  - the signature verifies against the payload the extension reconstructs.
 *
 * These tests assert both. The field lists below are transcribed from the
 * extension's own readers:
 *
 *  - api/classification.js and background.js read the policy fields
 *  - content/risk-scoring.js reads the pattern fields and scores locally
 *    when the server is unreachable
 */
class ExtensionFeedContractTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = '13b6056f7f072c80853526109de9268317e4a09842f3508b3df31c2fbdfaec4d';

    /**
     * The fields the extension reads from a cached policy.
     *
     * @var list<string>
     */
    private const POLICY_FIELDS = [
        'domain',
        'domain_status',
        'category',
        'policy',
        'block_access',
        'risk_score',
    ];

    /**
     * The fields the extension's local scorer reads from a risk pattern.
     *
     * @var list<string>
     */
    private const PATTERN_FIELDS = [
        'id',
        'title',
        'type',
        'regex',
        'score',
        'priority',
        'negation_context_regex',
        'amplifier_context_regex',
        'negation_window',
        'parent_criteria_id',
        'criteria_pattern_items',
    ];

    /**
     * The fields the extension's local scorer reads from a criteria item.
     *
     * @var list<string>
     */
    private const ITEM_FIELDS = [
        'id',
        'title',
        'regex',
        'operator',
        'score',
        'risk_weight',
        'sub_items',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('able.signing_key', self::KEY);
        Config::set('able.signing_key_version', 1);
    }

    public function test_the_signed_policy_feed_carries_the_fields_the_extension_reads(): void
    {
        $this->policy();

        $policy = $this->getJson('/api/domain-policies/signed')->json('payload.policies.0');

        $this->assertIsArray($policy);

        foreach (self::POLICY_FIELDS as $field) {
            $this->assertArrayHasKey($field, $policy);
        }
    }

    public function test_the_signed_policy_feed_signature_verifies_against_the_received_payload(): void
    {
        $this->policy();

        $response = $this->getJson('/api/domain-policies/signed');

        $this->assertSame(
            $response->json('signature'),
            JsCanonical::sign($response->json('payload'), self::KEY),
        );
    }

    public function test_the_signed_pattern_feed_carries_the_fields_the_extension_scores_with(): void
    {
        $this->pattern();

        $pattern = $this->getJson('/api/risk-patterns/signed')->json('payload.patterns.0');

        $this->assertIsArray($pattern);

        foreach (self::PATTERN_FIELDS as $field) {
            $this->assertArrayHasKey($field, $pattern);
        }
    }

    public function test_the_signed_pattern_feed_signature_verifies_against_the_received_payload(): void
    {
        $this->pattern();

        $response = $this->getJson('/api/risk-patterns/signed');

        $this->assertSame(
            $response->json('signature'),
            JsCanonical::sign($response->json('payload'), self::KEY),
        );
    }

    public function test_the_criteria_items_carry_the_fields_the_extension_scores_with(): void
    {
        $this->pattern();

        $items = $this->getJson('/api/risk-patterns/signed')->json('payload.patterns.0.criteria_pattern_items');

        $this->assertIsArray($items);
        $this->assertNotEmpty($items);

        foreach (self::ITEM_FIELDS as $field) {
            $this->assertArrayHasKey($field, $items[0]);
        }
    }

    public function test_the_extension_config_feed_signature_verifies_against_the_received_payload(): void
    {
        $response = $this->getJson('/api/extension/config');

        $this->assertSame(
            $response->json('signature'),
            JsCanonical::sign($response->json('payload'), self::KEY),
        );
    }

    private function policy(): DomainPolicy
    {
        return DomainPolicy::create([
            'domain' => 'contract.test',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'block_access' => true,
            'category' => 'Gambling',
            'classification_source' => 'manual',
            'confidence' => 0.9,
            'risk_score' => 70,
        ]);
    }

    private function pattern(): RiskPattern
    {
        $pattern = RiskPattern::create([
            'title' => 'Contract Card',
            'type' => 'criteria',
            'regex' => null,
            'score' => 0,
            'priority' => 'high',
        ]);

        $item = CriteriaPatternItem::create([
            'criteria_pattern_id' => $pattern->id,
            'title' => 'Contract Item',
            'regex' => 'secret',
            'operator' => 'and',
            'score' => 40,
            'risk_weight' => 'high',
        ]);

        CriteriaPatternItem::create([
            'criteria_pattern_id' => $pattern->id,
            'parent_id' => $item->id,
            'title' => 'Contract Sub Item',
            'regex' => 'token',
            'operator' => 'or',
            'score' => 20,
            'risk_weight' => 'medium',
        ]);

        return $pattern;
    }
}
