<?php

namespace Tests\Feature;

use App\Models\CriteriaPatternItem;
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
        $this->assertSame('active', $pattern->status);
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
            'status' => 'active',
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
            'status' => 'inactive',
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
        $this->assertSame('inactive', $pattern->status);

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
            'status' => 'active',
            'score' => 10,
        ]);
        RiskPattern::create([
            'title' => 'Pattern B',
            'type' => 'single',
            'regex' => 'b',
            'status' => 'active',
            'score' => 10,
        ]);

        $response = $this->delete(route('risk-algorithm.destroyAll'));

        $response->assertRedirect();
        $this->assertSame(0, RiskPattern::count());
    }

    public function test_api_returns_only_active_patterns()
    {
        RiskPattern::create([
            'title' => 'Active Pattern',
            'type' => 'single',
            'regex' => 'active',
            'status' => 'active',
            'score' => 10,
        ]);
        RiskPattern::create([
            'title' => 'Inactive Pattern',
            'type' => 'single',
            'regex' => 'inactive',
            'status' => 'inactive',
            'score' => 10,
        ]);

        $response = $this->getJson('/api/risk-patterns');

        $response->assertOk()->assertJson(['count' => 1]);
        $this->assertSame('Active Pattern', $response->json('patterns.0.title'));
    }
}
