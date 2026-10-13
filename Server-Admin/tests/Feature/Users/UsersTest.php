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
            ->assertJsonCount(1, 'recent_visits')
            ->assertJsonPath('profile.user_id', 'usr_test_client_2')
            ->assertJsonStructure([
                'profile',
                'summary',
                'daily_series',
                'top_domains',
                'risk_breakdown',
                'recent_egress',
                'category_distribution',
            ]);
    }

    public function test_client_users_telemetry_page_renders_with_range()
    {
        $admin = User::factory()->create();

        $policy = DomainPolicy::create([
            'domain' => 'example.org',
            'domain_status' => 'safe',
        ]);

        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'user_id' => 'usr_test_client_3',
            'domain' => 'example.org',
            'visited_at' => now()->subDays(2),
        ]);

        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'user_id' => 'usr_test_client_3',
            'domain' => 'example.org',
            'visited_at' => now(),
        ]);

        // Another user's categorized domain — must not leak into this client's breakdown.
        $foreignPolicy = DomainPolicy::create([
            'domain' => 'foreign-portal.com',
            'domain_status' => 'unsafe',
            'category' => 'Streaming',
        ]);

        DomainVisit::create([
            'domain_policy_id' => $foreignPolicy->id,
            'user_id' => 'usr_other_client',
            'domain' => 'foreign-portal.com',
            'visited_at' => now(),
        ]);

        // This client's domain visited outside the window — must not appear in range.
        $stalePolicy = DomainPolicy::create([
            'domain' => 'stale-domain.com',
            'domain_status' => 'safe',
            'category' => 'Gaming',
        ]);

        DomainVisit::create([
            'domain_policy_id' => $stalePolicy->id,
            'user_id' => 'usr_test_client_3',
            'domain' => 'stale-domain.com',
            'visited_at' => now()->subDays(10),
        ]);

        $from = now()->subDays(2)->toDateString();
        $to = now()->toDateString();

        $response = $this->actingAs($admin)
            ->get(route('users.client.telemetry', ['userId' => 'usr_test_client_3', 'date_from' => $from, 'date_to' => $to]));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('users/client-show')
                ->where('profile.user_id', 'usr_test_client_3')
                ->where('date_from', $from)
                ->where('date_to', $to)
                ->has('daily_series', 3)
                ->has('top_domains', 1)
                ->has('category_distribution', 1)
                ->where('category_distribution.0.category', 'General Cloud')
                ->where('category_distribution.0.percentage', 100)
                ->where('summary.visits', 2),
            );
    }

    public function test_team_users_page_can_be_rendered()
    {
        $admin = User::factory()->superAdmin()->create([
            'name' => 'Admin User',
            'email' => 'admin@able.security',
        ]);

        $response = $this->actingAs($admin)
            ->get(route('users.team.index'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('users/team')
                ->has('team', 1)
                ->where('team.0.email', 'admin@able.security')
                ->where('team.0.role', 'superadmin'),
            );
    }

    public function test_admin_cannot_access_team_routes()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $targetUser = User::factory()->create();

        $this->actingAs($admin)->get(route('users.team.index'))->assertForbidden();
        $this->actingAs($admin)->get(route('users.team.show', $targetUser))->assertForbidden();
        $this->actingAs($admin)->patch(route('users.team.update', $targetUser), [
            'name' => 'New Name',
            'email' => 'new@able.security',
            'role' => 'admin',
        ])->assertForbidden();
        $this->actingAs($admin)->patch(route('users.team.toggle-block', $targetUser))->assertForbidden();
    }

    public function test_team_member_profile_page_can_be_rendered()
    {
        $superAdmin = User::factory()->superAdmin()->create();
        $targetUser = User::factory()->create([
            'name' => 'Jane Analyst',
            'role' => 'admin',
        ]);

        $response = $this->actingAs($superAdmin)
            ->get(route('users.team.show', $targetUser));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('users/team-show')
                ->where('member.id', $targetUser->id)
                ->where('member.role', 'admin')
                ->where('canManage', true)
                ->has('roleOptions', 2),
            );
    }

    public function test_team_user_can_be_updated()
    {
        $admin = User::factory()->superAdmin()->create();
        $targetUser = User::factory()->create([
            'name' => 'Old Name',
            'email' => 'old@able.security',
            'role' => 'admin',
        ]);

        $response = $this->actingAs($admin)
            ->patch(route('users.team.update', $targetUser), [
                'name' => 'New Name',
                'email' => 'new@able.security',
                'role' => 'superadmin',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('users', [
            'id' => $targetUser->id,
            'name' => 'New Name',
            'email' => 'new@able.security',
            'role' => 'superadmin',
        ]);
    }

    public function test_team_user_role_rejects_unknown_values()
    {
        $admin = User::factory()->superAdmin()->create();
        $targetUser = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin)
            ->patch(route('users.team.update', $targetUser), [
                'name' => $targetUser->name,
                'email' => $targetUser->email,
                'role' => 'Analyst',
            ]);

        $response->assertSessionHasErrors('role');
        $this->assertDatabaseHas('users', [
            'id' => $targetUser->id,
            'role' => 'admin',
        ]);
    }

    public function test_super_admin_cannot_change_own_role()
    {
        $superAdmin = User::factory()->superAdmin()->create();

        $response = $this->actingAs($superAdmin)
            ->patch(route('users.team.update', $superAdmin), [
                'name' => $superAdmin->name,
                'email' => $superAdmin->email,
                'role' => 'admin',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('users', [
            'id' => $superAdmin->id,
            'role' => 'superadmin',
        ]);
    }

    public function test_last_super_admin_cannot_be_demoted()
    {
        // The only way to demote the last Super Admin is changing your own role,
        // which the self-role-change guard rejects above; verify the DB stays put.
        $superAdmin = User::factory()->superAdmin()->create();

        $this->actingAs($superAdmin)
            ->patch(route('users.team.update', $superAdmin), [
                'name' => $superAdmin->name,
                'email' => $superAdmin->email,
                'role' => 'admin',
            ])->assertRedirect();

        $this->assertSame('superadmin', $superAdmin->fresh()->role);
        $this->assertSame(
            1,
            User::where('role', 'superadmin')->count(),
        );
    }

    public function test_team_user_can_be_blocked_and_unblocked()
    {
        $admin = User::factory()->superAdmin()->create();
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
        $admin = User::factory()->superAdmin()->create(['is_blocked' => false]);

        $response = $this->actingAs($admin)
            ->patch(route('users.team.toggle-block', $admin));

        $response->assertRedirect();
        $this->assertFalse($admin->fresh()->is_blocked);
    }
}
