<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\DomainRecommendation;
use App\Models\User;
use App\Services\DomainPolicyFeed;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class RecommendationPolicyTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_the_page_renders_the_hardcoded_categories_and_grouped_recommendations(): void
    {
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'notion.so']);
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'asana.com']);
        DomainRecommendation::create(['category' => 'AI', 'domain' => 'openai.com']);

        $response = $this->actingAs($this->admin())->get(route('recommendation-policy'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('recommendation-policy')
            ->has('categories', 25)
            ->where('limit', 6)
            ->has('recommendations.Productivity', 2)
            ->has('recommendations.AI', 1));
    }

    public function test_the_page_lists_existing_domain_policy_domains(): void
    {
        DomainPolicy::create([
            'domain' => 'notion.so',
            'domain_status' => 'safe',
            'policy' => 'whitelisted',
            'risk_score' => 0,
            'category' => 'Productivity',
        ]);
        DomainPolicy::create([
            'domain' => 'blocked.test',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'risk_score' => 80,
            'category' => 'Gambling',
        ]);

        $response = $this->actingAs($this->admin())->get(route('recommendation-policy'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('recommendation-policy')
            ->has('existingDomains', 2)
            ->where('existingDomains.0.domain', 'blocked.test')
            ->where('existingDomains.1.domain', 'notion.so'));
    }

    public function test_gambling_and_adult_are_not_configurable(): void
    {
        foreach (['Gambling', 'Adult'] as $category) {
            $response = $this->actingAs($this->admin())
                ->from(route('recommendation-policy'))
                ->post(route('recommendation-policy.store'), [
                    'category' => $category,
                    'domain' => 'alternative.test',
                ]);

            $response->assertSessionHasErrors('category');
        }

        $this->assertSame(0, DomainRecommendation::count());
    }

    public function test_deleting_a_category_card_removes_only_that_category(): void
    {
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'notion.so']);
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'asana.com']);
        DomainRecommendation::create(['category' => 'AI', 'domain' => 'openai.com']);

        $response = $this->actingAs($this->admin())
            ->from(route('recommendation-policy'))
            ->delete(route('recommendation-policy.destroy-category', ['category' => 'Productivity']));

        $response->assertRedirect(route('recommendation-policy'));
        $this->assertSame(0, DomainRecommendation::where('category', 'Productivity')->count());
        $this->assertSame(1, DomainRecommendation::where('category', 'AI')->count());
    }

    public function test_an_excluded_category_card_cannot_be_deleted(): void
    {
        $response = $this->actingAs($this->admin())
            ->delete(route('recommendation-policy.destroy-category', ['category' => 'Gambling']));

        $response->assertNotFound();
    }

    public function test_a_domain_is_normalized_before_it_is_stored(): void
    {
        $response = $this->actingAs($this->admin())
            ->from(route('recommendation-policy'))
            ->post(route('recommendation-policy.store'), [
                'category' => 'Productivity',
                'domain' => 'HTTPS://WWW.Notion.so/workspace',
            ]);

        $response->assertRedirect(route('recommendation-policy'));
        $this->assertDatabaseHas('domain_recommendations', [
            'category' => 'Productivity',
            'domain' => 'notion.so',
        ]);
    }

    public function test_a_duplicate_domain_in_the_same_category_is_rejected(): void
    {
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'notion.so']);

        $response = $this->actingAs($this->admin())
            ->from(route('recommendation-policy'))
            ->post(route('recommendation-policy.store'), [
                'category' => 'Productivity',
                'domain' => 'www.notion.so',
            ]);

        $response->assertSessionHasErrors('domain');
        $this->assertSame(1, DomainRecommendation::count());
    }

    public function test_the_same_domain_can_be_recommended_for_a_different_category(): void
    {
        DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'notion.so']);

        $response = $this->actingAs($this->admin())
            ->from(route('recommendation-policy'))
            ->post(route('recommendation-policy.store'), [
                'category' => 'AI',
                'domain' => 'notion.so',
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertSame(2, DomainRecommendation::count());
    }

    public function test_a_category_outside_the_hardcoded_taxonomy_is_rejected(): void
    {
        $response = $this->actingAs($this->admin())
            ->from(route('recommendation-policy'))
            ->post(route('recommendation-policy.store'), [
                'category' => 'Not A Real Category',
                'domain' => 'notion.so',
            ]);

        $response->assertSessionHasErrors('category');
        $this->assertSame(0, DomainRecommendation::count());
    }

    public function test_a_category_cannot_exceed_the_configured_limit(): void
    {
        for ($i = 0; $i < 6; $i++) {
            DomainRecommendation::create([
                'category' => 'Productivity',
                'domain' => 'tool-'.$i.'.test',
            ]);
        }

        $response = $this->actingAs($this->admin())
            ->from(route('recommendation-policy'))
            ->post(route('recommendation-policy.store'), [
                'category' => 'Productivity',
                'domain' => 'seventh.test',
            ]);

        $response->assertSessionHasErrors('domain');
        $this->assertSame(6, DomainRecommendation::where('category', 'Productivity')->count());
    }

    public function test_a_recommendation_can_be_removed(): void
    {
        $keep = DomainRecommendation::create(['category' => 'Productivity', 'domain' => 'notion.so']);
        $remove = DomainRecommendation::create(['category' => 'AI', 'domain' => 'openai.com']);

        $response = $this->actingAs($this->admin())
            ->from(route('recommendation-policy'))
            ->delete(route('recommendation-policy.destroy', $remove));

        $response->assertRedirect(route('recommendation-policy'));
        $this->assertDatabaseMissing('domain_recommendations', ['id' => $remove->id]);
        $this->assertDatabaseHas('domain_recommendations', ['id' => $keep->id]);
    }

    public function test_adding_a_recommendation_invalidates_the_cached_feed(): void
    {
        $feed = app(DomainPolicyFeed::class);
        $before = $feed->feed()['unsigned']['body'];

        $this->actingAs($this->admin())
            ->from(route('recommendation-policy'))
            ->post(route('recommendation-policy.store'), [
                'category' => 'Productivity',
                'domain' => 'notion.so',
            ]);

        $after = $feed->feed()['unsigned']['body'];

        $this->assertNotSame($before, $after);
        $this->assertStringContainsString('notion.so', $after);
    }

    public function test_adding_a_recommendation_does_not_change_domain_policy(): void
    {
        $this->actingAs($this->admin())
            ->from(route('recommendation-policy'))
            ->post(route('recommendation-policy.store'), [
                'category' => 'Productivity',
                'domain' => 'notion.so',
            ]);

        $this->assertSame(0, DomainPolicy::count());
    }
}
