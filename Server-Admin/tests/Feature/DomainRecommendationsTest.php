<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainRecommendation;
use App\Services\DomainRecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class DomainRecommendationsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Create a sanctioned (whitelisted) policy that can be recommended.
     */
    private function sanctioned(string $domain, ?string $category = 'Productivity'): DomainPolicy
    {
        return DomainPolicy::create([
            'domain' => $domain,
            'domain_status' => 'safe',
            'policy' => 'whitelisted',
            'block_access' => false,
            'category' => $category,
            'classification_source' => 'manual',
            'risk_score' => 0,
        ]);
    }

    /**
     * Create the unsafe/unlisted domain the user is visiting.
     */
    private function visited(string $domain, ?string $category = 'Productivity', string $status = 'unsafe'): DomainPolicy
    {
        return DomainPolicy::create([
            'domain' => $domain,
            'domain_status' => $status,
            'policy' => $status === 'unsafe' ? 'blacklisted' : 'under_review',
            'block_access' => false,
            'category' => $category,
            'classification_source' => 'manual',
            'risk_score' => $status === 'unsafe' ? 70 : 60,
        ]);
    }

    private function classify(string $url): array
    {
        return $this->postJson('/api/classify-domain', ['url' => $url])
            ->assertOk()
            ->json();
    }

    public function test_an_unsafe_domain_receives_the_sanctioned_alternatives_in_its_category(): void
    {
        $this->sanctioned('notion.test');
        $this->sanctioned('asana.test');
        $this->sanctioned('slack.test', 'Communication');
        $this->visited('trello.test');

        $payload = $this->classify('https://trello.test/boards');

        $this->assertSame('unsafe', $payload['status']);
        $this->assertSame(['asana.test', 'notion.test'], $payload['recommendations']);
    }

    public function test_the_current_domain_and_its_relatives_are_excluded(): void
    {
        $this->sanctioned('example.test');
        $this->visited('app.example.test');

        $payload = $this->classify('https://app.example.test/');

        $this->assertSame('unsafe', $payload['status']);
        $this->assertSame([], $payload['recommendations']);
    }

    public function test_only_whitelisted_policies_are_recommended(): void
    {
        $this->sanctioned('approved.test');
        DomainPolicy::create([
            'domain' => 'review.test',
            'domain_status' => 'safe',
            'policy' => 'under_review',
            'category' => 'Productivity',
            'classification_source' => 'manual',
            'risk_score' => 0,
        ]);
        DomainPolicy::create([
            'domain' => 'blocked.test',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'category' => 'Productivity',
            'classification_source' => 'manual',
            'risk_score' => 70,
        ]);
        $this->visited('visited.test');

        $payload = $this->classify('https://visited.test/');

        $this->assertSame(['approved.test'], $payload['recommendations']);
    }

    public function test_category_matching_is_case_and_whitespace_insensitive(): void
    {
        $this->sanctioned('notion.test', '  productivity ');
        $this->visited('trello.test', 'Productivity');

        $payload = $this->classify('https://trello.test/');

        $this->assertSame(['notion.test'], $payload['recommendations']);
    }

    public function test_a_missing_category_yields_no_recommendations(): void
    {
        $this->sanctioned('notion.test');
        $this->visited('uncategorized.test', null);

        $payload = $this->classify('https://uncategorized.test/');

        $this->assertArrayHasKey('recommendations', $payload);
        $this->assertSame([], $payload['recommendations']);
    }

    public function test_a_category_with_no_sanctioned_domains_yields_no_recommendations(): void
    {
        $this->visited('lonely.test', 'Legal');

        $payload = $this->classify('https://lonely.test/');

        $this->assertSame([], $payload['recommendations']);
    }

    public function test_safe_domains_never_receive_recommendations(): void
    {
        $this->sanctioned('notion.test');
        $this->sanctioned('safe.test');

        $payload = $this->classify('https://safe.test/');

        $this->assertSame('safe', $payload['status']);
        $this->assertSame([], $payload['recommendations']);
    }

    public function test_recommendations_are_sorted_and_respect_the_configured_limit(): void
    {
        Config::set('able.recommendations_limit', 2);

        $this->sanctioned('charlie.test');
        $this->sanctioned('alpha.test');
        $this->sanctioned('bravo.test');
        $this->visited('visited.test');

        $service = app(DomainRecommendationService::class);

        $this->assertSame(
            ['alpha.test', 'bravo.test'],
            $service->forCategory('Productivity', 'visited.test')
        );
    }

    public function test_the_manual_recommendation_list_wins_over_whitelisted_domains(): void
    {
        $this->sanctioned('asana.test');
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'notion.test']);
        $this->visited('trello.test');

        $payload = $this->classify('https://trello.test/');

        $this->assertSame(['notion.test'], $payload['recommendations']);
    }

    public function test_the_manual_list_excludes_related_domains_and_respects_the_limit(): void
    {
        Config::set('able.recommendations_limit', 2);

        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'app.example.test']);
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'charlie.test']);
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'alpha.test']);
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'bravo.test']);
        $this->visited('app.example.test');

        $payload = $this->classify('https://app.example.test/');

        $this->assertSame(['alpha.test', 'bravo.test'], $payload['recommendations']);
    }

    public function test_excluded_categories_never_receive_recommendations(): void
    {
        $this->sanctioned('casino.test', 'Gambling');
        DomainRecommendation::create(['category' => 'Gambling', 'domain' => 'manual-casino.test']);
        $this->visited('bet.test', 'Gambling');

        $this->assertSame([], $this->classify('https://bet.test/')['recommendations']);

        $this->sanctioned('adult.test', 'Adult');
        $this->visited('explicit.test', 'Adult');

        $this->assertSame([], $this->classify('https://explicit.test/')['recommendations']);
    }

    public function test_the_offline_cache_fields_are_enough_to_build_recommendations(): void
    {
        $this->sanctioned('notion.test');
        $this->visited('trello.test');

        $policy = $this->getJson('/api/domain-policies/signed')
            ->assertOk()
            ->json('payload.policies');

        $sanctioned = collect($policy)->firstWhere('domain', 'notion.test');

        $this->assertSame('whitelisted', $sanctioned['policy']);
        $this->assertSame('Productivity', $sanctioned['category']);
    }
}
