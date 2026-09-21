<?php

namespace Tests\Feature\Users;

use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\ExtensionLifecycle;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UsersTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_users_page_can_be_rendered()
    {
        $admin = User::factory()->create();

        $policy = DomainPolicy::create([
            'domain' => 'example.com',
            'domain_status' => 'safe',
        ]);

        ExtensionLifecycle::create([
            'user_id' => 'usr_test_client_1',
            'event' => 'installed',
            'version' => '1.0.0',
            'occurred_at' => now()->subDays(5),
        ]);

        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'user_id' => 'usr_test_client_1',
            'domain' => 'example.com',
            'visited_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($admin)
            ->get(route('users.client.index'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('users/client')
                ->has('clients', 1)
                ->where('clients.0.user_id', 'usr_test_client_1')
                ->where('clients.0.total_visits', 1),
            );
    }

    public function test_client_users_telemetry_show_endpoint()
    {
        $admin = User::factory()->create();

        $policy = DomainPolicy::create([
            'domain' => 'github.com',
            'domain_status' => 'safe',
        ]);

        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'user_id' => 'usr_test_client_2',
            'domain' => 'github.com',
            'visited_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->get(route('users.client.show', 'usr_test_client_2'));

        $response->assertOk()
            ->assertJsonPath('user_id', 'usr_test_client_2')
            ->assertJsonCount(1, 'recent_visits');
    }

    public function test_team_users_page_can_be_rendered()
    {
        $admin = User::factory()->create([
            'name' => 'Admin User',
            'email' => 'admin@able.security',
            'role' => 'Super Admin',
        ]);

        $response = $this->actingAs($admin)
            ->get(route('users.team.index'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('users/team')
                ->has('team', 1)
                ->where('team.0.email', 'admin@able.security')
                ->where('team.0.role', 'Super Admin'),
            );
    }

    public function test_team_user_can_be_updated()
    {
        $admin = User::factory()->create();
        $targetUser = User::factory()->create([
            'name' => 'Old Name',
            'email' => 'old@able.security',
            'role' => null,
        ]);

        $response = $this->actingAs($admin)
            ->patch(route('users.team.update', $targetUser), [
                'name' => 'New Name',
                'email' => 'new@able.security',
                'role' => 'Analyst',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('users', [
            'id' => $targetUser->id,
            'name' => 'New Name',
            'email' => 'new@able.security',
            'role' => 'Analyst',
        ]);
    }

    public function test_team_user_can_be_blocked_and_unblocked()
    {
        $admin = User::factory()->create();
        $targetUser = User::factory()->create(['is_blocked' => false]);

        // Block target user
        $response = $this->actingAs($admin)
            ->patch(route('users.team.toggle-block', $targetUser));

        $response->assertRedirect();
        $this->assertTrue($targetUser->fresh()->is_blocked);

        // Unblock target user
        $response = $this->actingAs($admin)
            ->patch(route('users.team.toggle-block', $targetUser));

        $response->assertRedirect();
        $this->assertFalse($targetUser->fresh()->is_blocked);
    }

    public function test_admin_cannot_block_own_account()
    {
        $admin = User::factory()->create(['is_blocked' => false]);

        $response = $this->actingAs($admin)
            ->patch(route('users.team.toggle-block', $admin));

        $response->assertRedirect();
        $this->assertFalse($admin->fresh()->is_blocked);
    }
}
