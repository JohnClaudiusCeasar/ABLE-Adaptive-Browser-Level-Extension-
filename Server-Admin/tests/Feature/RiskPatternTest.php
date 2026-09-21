<?php

namespace Tests\Feature;

use App\Models\CriteriaPatternItem;
use App\Models\EgressEvent;
use App\Models\RiskPattern;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RiskPatternTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_from_risk_algorithm()
    {
        $response = $this->get(route('risk-algorithm.view', 'single'));

        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_user_can_create_a_single_pattern()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->post(route('risk-algorithm.store'), [
            'title' => 'Student ID Format',
            'type' => 'single',
            'regex' => '^\d{2}-\d{4}-\d{3}$',
            'score' => 30,
        ]);

        $response->assertRedirect();

        $pattern = RiskPattern::first();
        $this->assertNotNull($pattern);
        $this->assertSame('single', $pattern->type);
        $this->assertSame('^\d{2}-\d{4}-\d{3}$', $pattern->regex);
        $this->assertSame(30, $pattern->score);
        $this->assertSame('medium', $pattern->priority);
    }

    public function test_invalid_regex_is_rejected()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->from(route('risk-algorithm.view', 'single'))->post(route('risk-algorithm.store'), [
            'title' => 'Broken Pattern',
            'type' => 'single',
            'regex' => '([a-z', // unbalanced group
            'score' => 30,
        ]);

        $response->assertSessionHasErrors('regex');
        $this->assertSame(0, RiskPattern::count());
    }

    public function test_criteria_pattern_with_or_items_persists_operator()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->post(route('risk-algorithm.store'), [
            'title' => 'Encryption Keys',
            'type' => 'criteria',
            'score' => 50,
            'criteria_pattern_items' => [
                [
                    'title' => 'Encryption Context',
                    'regex' => '(?:encrypt|decrypt|aes|rsa)',
                    'operator' => 'and',
                    'score' => 0,
                ],
                [
                    'title' => 'Key Material',
                    'regex' => '(?:key|secret)[\s]*[=:]\s*[A-Za-z0-9/+=]{16,}',
                    'operator' => 'or',
                    'score' => 0,
                ],
            ],
        ]);

        $response->assertRedirect();

        $pattern = RiskPattern::where('type', 'criteria')->first();
        $this->assertNotNull($pattern);

        $items = CriteriaPatternItem::where('criteria_pattern_id', $pattern->id)->get();
        $this->assertCount(2, $items);
        $this->assertSame('and', $items->firstWhere('title', 'Encryption Context')->operator);
        $this->assertSame('or', $items->firstWhere('title', 'Key Material')->operator);
    }

    public function test_criteria_pattern_sub_items_are_created_recursively()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $this->post(route('risk-algorithm.store'), [
            'title' => 'Full Environment Credentials',
            'type' => 'criteria',
            'score' => 50,
            'criteria_pattern_items' => [
                [
                    'title' => 'System Name',
                    'regex' => '(?:production|staging)[\s_]?(?:server|env)',
                    'operator' => 'and',
                    'score' => 0,
                    'sub_items' => [
                        [
                            'title' => 'Username',
                            'regex' => '(?:user|admin)[\s]*[=:]\s*\S{4,}',
                            'operator' => 'and',
                            'score' => 20,
                        ],
                        [
                            'title' => 'Password',
                            'regex' => '(?:pass|pwd)[\s]*[=:]\s*\S{8,}',
                            'operator' => 'or',
                            'score' => 25,
                        ],
                    ],
                ],
            ],
        ]);

        $pattern = RiskPattern::where('type', 'criteria')->first();
        $this->assertNotNull($pattern);

        $parent = CriteriaPatternItem::where('criteria_pattern_id', $pattern->id)->first();
        $this->assertNotNull($parent);
        $this->assertNull($parent->parent_id);

        $subItems = CriteriaPatternItem::where('parent_id', $parent->id)->get();
        $this->assertCount(2, $subItems);
        $this->assertSame('or', $subItems->firstWhere('title', 'Password')->operator);
        $this->assertSame(25, $subItems->firstWhere('title', 'Password')->score);
    }

    public function test_update_recreates_criteria_items()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $pattern = RiskPattern::create([
            'title' => 'Old Title',
            'type' => 'criteria',
            'priority' => 'medium',
            'score' => 40,
        ]);

        $item = CriteriaPatternItem::create([
            'criteria_pattern_id' => $pattern->id,
            'title' => 'Old Item',
            'regex' => 'old',
            'operator' => 'and',
            'score' => 0,
        ]);

        $response = $this->patch(route('risk-algorithm.update', $pattern), [
            'title' => 'New Title',
            'type' => 'criteria',
            'priority' => 'low',
            'score' => 45,
            'criteria_pattern_items' => [
                [
                    'title' => 'New Item',
                    'regex' => 'new',
                    'operator' => 'or',
                    'score' => 0,
                ],
            ],
        ]);

        $response->assertRedirect();

        $pattern->refresh();
        $this->assertSame('New Title', $pattern->title);
        $this->assertSame('low', $pattern->priority);

        $this->assertSame(1, CriteriaPatternItem::count());
        $this->assertNull(CriteriaPatternItem::find($item->id));
        $this->assertSame('or', CriteriaPatternItem::first()->operator);
    }

    public function test_destroy_all_deletes_all_patterns()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        RiskPattern::create([
            'title' => 'Pattern A',
            'type' => 'single',
            'regex' => 'a',
            'priority' => 'medium',
            'score' => 10,
        ]);
        RiskPattern::create([
            'title' => 'Pattern B',
            'type' => 'single',
            'regex' => 'b',
            'priority' => 'medium',
            'score' => 10,
        ]);

        $response = $this->delete(route('risk-algorithm.destroyAll'));

        $response->assertRedirect();
        $this->assertSame(0, RiskPattern::count());
    }

    public function test_api_orders_patterns_by_priority()
    {
        RiskPattern::create([
            'title' => 'Low Pattern',
            'type' => 'single',
            'regex' => 'low',
            'priority' => 'low',
            'score' => 10,
        ]);
        RiskPattern::create([
            'title' => 'High Pattern',
            'type' => 'single',
            'regex' => 'high',
            'priority' => 'high',
            'score' => 10,
        ]);
        RiskPattern::create([
            'title' => 'Medium Pattern',
            'type' => 'single',
            'regex' => 'medium',
            'priority' => 'medium',
            'score' => 10,
        ]);

        $response = $this->getJson('/api/risk-patterns');

        $response->assertOk()->assertJson(['count' => 3]);
        $this->assertSame(
            ['High Pattern', 'Medium Pattern', 'Low Pattern'],
            collect($response->json('patterns'))->pluck('title')->all(),
        );
    }

    public function test_creating_criteria_pattern_auto_records_items_as_single_patterns()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $this->post(route('risk-algorithm.store'), [
            'title' => 'Test Criteria',
            'type' => 'criteria',
            'score' => 50,
            'criteria_pattern_items' => [
                [
                    'title' => 'Item A',
                    'regex' => 'patternA',
                    'operator' => 'and',
                    'score' => 30,
                    'sub_items' => [
                        [
                            'title' => 'Sub A1',
                            'regex' => 'subPatternA1',
                            'operator' => 'and',
                            'score' => 10,
                        ],
                    ],
                ],
                [
                    'title' => 'Item B',
                    'regex' => 'patternB',
                    'operator' => 'or',
                    'score' => 20,
                ],
            ],
        ]);

        $criteria = RiskPattern::where('type', 'criteria')->first();
        $this->assertNotNull($criteria);

        $linkedSingles = RiskPattern::where('parent_criteria_id', $criteria->id)
            ->where('type', 'single')
            ->get();

        $this->assertCount(3, $linkedSingles);
        $this->assertNotNull($linkedSingles->firstWhere('title', 'Item A'));
        $this->assertNotNull($linkedSingles->firstWhere('title', 'Sub A1'));
        $this->assertNotNull($linkedSingles->firstWhere('title', 'Item B'));
        $this->assertSame(30, $linkedSingles->firstWhere('title', 'Item A')->score);
    }

    public function test_updating_criteria_pattern_refreshes_auto_created_singles()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $this->post(route('risk-algorithm.store'), [
            'title' => 'Original Criteria',
            'type' => 'criteria',
            'score' => 40,
            'criteria_pattern_items' => [
                ['title' => 'Old Item', 'regex' => 'old', 'operator' => 'and', 'score' => 10],
            ],
        ]);

        $criteria = RiskPattern::where('type', 'criteria')->first();
        $this->assertCount(1, RiskPattern::where('parent_criteria_id', $criteria->id)->get());

        $this->patch(route('risk-algorithm.update', $criteria), [
            'title' => 'Updated Criteria',
            'type' => 'criteria',
            'priority' => 'medium',
            'score' => 60,
            'criteria_pattern_items' => [
                ['title' => 'New Item 1', 'regex' => 'new1', 'operator' => 'and', 'score' => 25],
                ['title' => 'New Item 2', 'regex' => 'new2', 'operator' => 'and', 'score' => 35],
            ],
        ]);

        $linkedSingles = RiskPattern::where('parent_criteria_id', $criteria->id)->get();
        $this->assertCount(2, $linkedSingles);
        $this->assertNull($linkedSingles->firstWhere('title', 'Old Item'));
        $this->assertNotNull($linkedSingles->firstWhere('title', 'New Item 1'));
        $this->assertNotNull($linkedSingles->firstWhere('title', 'New Item 2'));
    }

    public function test_deleting_criteria_pattern_removes_linked_singles()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $this->post(route('risk-algorithm.store'), [
            'title' => 'Deletable Criteria',
            'type' => 'criteria',
            'score' => 30,
            'criteria_pattern_items' => [
                ['title' => 'Linked Item', 'regex' => 'linked', 'operator' => 'and', 'score' => 30],
            ],
        ]);

        $criteria = RiskPattern::where('type', 'criteria')->first();
        $this->assertNotNull($criteria);
        $this->assertCount(1, RiskPattern::where('parent_criteria_id', $criteria->id)->get());

        $this->delete(route('risk-algorithm.destroy', $criteria));

        $this->assertNull(RiskPattern::find($criteria->id));
        $this->assertCount(0, RiskPattern::where('parent_criteria_id', $criteria->id)->get());
    }

    public function test_criteria_pattern_composite_score_is_persisted()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $this->post(route('risk-algorithm.store'), [
            'title' => 'Scored Criteria',
            'type' => 'criteria',
            'score' => 75,
            'criteria_pattern_items' => [
                ['title' => 'Item', 'regex' => 'item', 'operator' => 'and', 'score' => 25],
            ],
        ]);

        $criteria = RiskPattern::where('type', 'criteria')->first();
        $this->assertNotNull($criteria);
        $this->assertSame(75, $criteria->score);
    }

    public function test_auto_created_singles_inherit_parent_priority()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $this->post(route('risk-algorithm.store'), [
            'title' => 'Escalating Criteria',
            'type' => 'criteria',
            'score' => 50,
            'criteria_pattern_items' => [
                ['title' => 'Item', 'regex' => 'escalate', 'operator' => 'and', 'score' => 20],
            ],
        ]);

        $criteria = RiskPattern::where('type', 'criteria')->first();
        $this->assertSame('medium', $criteria->priority);
        $this->assertSame(
            'medium',
            RiskPattern::where('parent_criteria_id', $criteria->id)->first()->priority,
        );

        $this->patch(route('risk-algorithm.update', $criteria), [
            'title' => 'Escalating Criteria',
            'type' => 'criteria',
            'priority' => 'high',
            'score' => 50,
            'criteria_pattern_items' => [
                ['title' => 'Item', 'regex' => 'escalate', 'operator' => 'and', 'score' => 20],
            ],
        ]);

        $linkedSingles = RiskPattern::where('parent_criteria_id', $criteria->id)->get();
        $this->assertCount(1, $linkedSingles);
        $this->assertSame('high', $linkedSingles->first()->priority);
    }

    public function test_create_criteria_page_lists_single_and_criteria_patterns()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        RiskPattern::create([
            'title' => 'Standalone Single',
            'type' => 'single',
            'regex' => 'standalone',
            'priority' => 'high',
            'score' => 20,
        ]);
        // Pin ordering so the created_at desc sort is deterministic.
        RiskPattern::where('title', 'Standalone Single')->update([
            'created_at' => now()->subDay(),
        ]);

        $criteria = RiskPattern::create([
            'title' => 'Existing Criteria',
            'type' => 'criteria',
            'priority' => 'medium',
            'score' => 40,
        ]);
        CriteriaPatternItem::create([
            'criteria_pattern_id' => $criteria->id,
            'title' => 'Criteria Item',
            'regex' => 'criteriaregex',
            'operator' => 'and',
            'score' => 0,
        ]);

        $response = $this->actingAs($user)
            ->get(route('risk-algorithm.create-criteria'));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('risk-algorithm/create-criteria')
                ->has('existingPatterns', 2)
                ->where('existingPatterns.0.title', 'Existing Criteria')
                ->has('existingPatterns.0.criteria_pattern_items', 1)
                ->where('existingPatterns.1.title', 'Standalone Single'),
        );
    }

    public function test_criteria_item_without_regex_is_allowed_as_group()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->post(route('risk-algorithm.store'), [
            'title' => 'Grouping Criteria',
            'type' => 'criteria',
            'score' => 30,
            'criteria_pattern_items' => [
                [
                    'title' => 'Imported Group',
                    'regex' => '',
                    'operator' => 'and',
                    'score' => 15,
                    'sub_items' => [
                        [
                            'title' => 'Nested Item',
                            'regex' => 'nestedregex',
                            'operator' => 'and',
                            'score' => 10,
                        ],
                    ],
                ],
            ],
        ]);

        $response->assertRedirect();

        $criteria = RiskPattern::where('type', 'criteria')->first();
        $this->assertNotNull($criteria);

        $groupItem = CriteriaPatternItem::where(
            'criteria_pattern_id',
            $criteria->id,
        )
            ->where('title', 'Imported Group')
            ->first();
        $this->assertNotNull($groupItem);

        // The wrapper is not auto-recorded as a single; its sub-item is.
        $linkedSingles = RiskPattern::where(
            'parent_criteria_id',
            $criteria->id,
        )->get();
        $this->assertCount(1, $linkedSingles);
        $this->assertSame('Nested Item', $linkedSingles->first()->title);
    }

    public function test_egress_stats_groups_events_by_new_risk_buckets()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        // Low: 0-30
        EgressEvent::create([
            'domain' => 'safe.com',
            'user_id' => 'user-1',
            'file_name' => 'doc1.pdf',
            'risk_score' => 25,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        // Medium: 31-84
        EgressEvent::create([
            'domain' => 'unlisted.com',
            'user_id' => 'user-2',
            'file_name' => 'doc2.pdf',
            'risk_score' => 60,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        // High: 85+
        EgressEvent::create([
            'domain' => 'unsafe.com',
            'user_id' => 'user-3',
            'file_name' => 'doc3.pdf',
            'risk_score' => 88,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        $response = $this->get(route('risk-algorithm.view', 'single'));
        $response->assertOk();

        $response->assertInertia(
            fn ($page) => $page
                ->component('risk-algorithm/single')
                ->where('egressStats.bucketLow', 1)
                ->where('egressStats.bucketMedium', 1)
                ->where('egressStats.bucketHigh', 1)
                ->where('egressStats.totalEvents24h', 3),
        );
    }
}
