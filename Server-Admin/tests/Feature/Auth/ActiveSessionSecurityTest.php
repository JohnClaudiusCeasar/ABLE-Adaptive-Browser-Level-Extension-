<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Services\ActiveSessionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActiveSessionSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_user_cannot_log_in_if_account_is_already_actively_operating_elsewhere(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@able.security',
            'password' => bcrypt('SecurePassword123!'),
            'role' => 'admin',
        ]);

        /** @var ActiveSessionService $activeSessionService */
        $activeSessionService = app(ActiveSessionService::class);
        $activeSessionService->recordActivity(
            userId: $user->id,
            sessionId: 'existing_active_session_abc123',
            ipAddress: '192.168.1.50',
            userAgent: 'Mozilla/5.0 Test Browser',
        );

        // Attempt login from another session
        $response = $this->post(route('login'), [
            'email' => 'admin@able.security',
            'password' => 'SecurePassword123!',
        ]);

        $response->assertSessionHasErrors(['active_conflict']);
        $this->assertGuest();

        // Verify break-glass flags are prepared
        $response->assertSessionHas('active_conflict_required', true);
        $response->assertSessionHas('break_glass_token');
    }

    public function test_break_glass_password_confirmation_terminates_previous_session_and_authenticates(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@able.security',
            'password' => bcrypt('SecurePassword123!'),
            'role' => 'admin',
        ]);

        /** @var ActiveSessionService $activeSessionService */
        $activeSessionService = app(ActiveSessionService::class);
        $activeSessionService->recordActivity(
            userId: $user->id,
            sessionId: 'previous_device_session_xyz',
            ipAddress: '192.168.1.50',
            userAgent: 'Mozilla/5.0 Previous Browser',
        );

        $token = $activeSessionService->createBreakGlassToken($user->id);

        $response = $this->post(route('login.break-glass'), [
            'email' => 'admin@able.security',
            'password' => 'SecurePassword123!',
            'token' => $token,
        ]);

        $this->assertAuthenticatedAs($user);
        $response->assertRedirect(route('dashboard'));
        $response->assertSessionHas('recommend_password_change', true);

        // Previous session is no longer the active one
        $this->assertFalse(
            $activeSessionService->isActivelyOperating($user->id, session()->getId())
        );
    }

    public function test_break_glass_fails_with_incorrect_password(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@able.security',
            'password' => bcrypt('SecurePassword123!'),
            'role' => 'admin',
        ]);

        $response = $this->post(route('login.break-glass'), [
            'email' => 'admin@able.security',
            'password' => 'WrongPassword!',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors(['break_glass_password']);
    }

    public function test_inactivity_middleware_terminates_session_after_5_minutes_idle(): void
    {
        $user = User::factory()->create();

        // Simulate a session with last activity 301 seconds ago (exceeding 300s limit)
        $response = $this->actingAs($user)
            ->withSession(['able_last_activity_time' => now()->timestamp - 301])
            ->get(route('dashboard'));

        $this->assertGuest();
        $response->assertRedirect(route('login'));
        $response->assertSessionHas('status', __('You were logged out due to 5 minutes of inactivity.'));
    }

    public function test_inactivity_middleware_allows_active_requests_and_updates_timestamp(): void
    {
        $user = User::factory()->create();

        // Simulate a session with last activity 10 seconds ago
        $response = $this->actingAs($user)
            ->withSession(['able_last_activity_time' => now()->timestamp - 10])
            ->get(route('dashboard'));

        $this->assertAuthenticatedAs($user);
        $response->assertOk();
    }

    public function test_heartbeat_endpoint_refreshes_session_presence(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson(route('session.heartbeat'));

        $response->assertOk();
        $response->assertJson(['status' => 'ok']);
    }

    public function test_logout_clears_active_session_lock(): void
    {
        $user = User::factory()->create();

        /** @var ActiveSessionService $activeSessionService */
        $activeSessionService = app(ActiveSessionService::class);
        $activeSessionService->recordActivity(
            userId: $user->id,
            sessionId: 'current_session_123',
            ipAddress: '127.0.0.1',
        );

        $this->actingAs($user)->post(route('logout'));

        $this->assertGuest();
        $this->assertFalse($activeSessionService->isActivelyOperating($user->id));
    }
}
