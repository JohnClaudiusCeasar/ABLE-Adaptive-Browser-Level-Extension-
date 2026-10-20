<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DomainPolicyBlockAccessTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_block_access_is_persisted_for_a_blacklisted_domain(): void
    {
        $response = $this->actingAs($this->admin())->post(route('policy-algorithm.store'), [
            'domain' => 'blocked-shop.example',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'block_access' => true,
            'category' => 'Gambling',
            'risk_score' => 70,
        ]);

        $response->assertRedirect();

        $policy = DomainPolicy::where('domain', 'blocked-shop.example')->first();

        $this->assertNotNull($policy);
        $this->assertTrue($policy->block_access);
    }

    public function test_block_access_is_forced_off_when_the_policy_is_not_blacklisted(): void
    {
        $this->actingAs($this->admin())->post(route('policy-algorithm.store'), [
            'domain' => 'reviewed-shop.example',
            'domain_status' => 'safe',
            'policy' => 'whitelisted',
            'block_access' => true,
            'risk_score' => 0,
        ])->assertRedirect();

        $policy = DomainPolicy::where('domain', 'reviewed-shop.example')->first();

        $this->assertNotNull($policy);
        $this->assertFalse($policy->block_access);
    }

    public function test_partial_update_does_not_silently_unblock_a_domain(): void
    {
        $policy = DomainPolicy::create([
            'domain' => 'partial-update.example',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'block_access' => true,
            'category' => 'Gambling',
            'risk_score' => 70,
        ]);

        // A client that does not send block_access must not disable the block.
        $this->actingAs($this->admin())->patch(route('policy-algorithm.update', $policy), [
            'domain' => 'partial-update.example',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'risk_score' => 70,
        ])->assertRedirect();

        $this->assertTrue($policy->fresh()->block_access);
    }

    public function test_changing_the_policy_away_from_blacklisted_turns_the_block_off(): void
    {
        $policy = DomainPolicy::create([
            'domain' => 'unblock-me.example',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'block_access' => true,
            'category' => 'Gambling',
            'risk_score' => 70,
        ]);

        $this->actingAs($this->admin())->patch(route('policy-algorithm.update', $policy), [
            'domain' => 'unblock-me.example',
            'domain_status' => 'unlisted',
            'policy' => 'under_review',
            'block_access' => true,
            'risk_score' => 60,
        ])->assertRedirect();

        $this->assertFalse($policy->fresh()->block_access);
    }
}
