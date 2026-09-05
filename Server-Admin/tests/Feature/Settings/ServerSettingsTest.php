<?php

namespace Tests\Feature\Settings;

use App\Models\AbleSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServerSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_server_settings_page_is_displayed()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->get(route('server-settings.edit'));

        $response->assertOk();
    }

    public function test_guests_are_redirected_from_server_settings()
    {
        $response = $this->get(route('server-settings.edit'));

        $response->assertRedirect(route('login'));
    }

    public function test_server_settings_can_be_updated()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->put(route('server-settings.update'), [
                'algorithm.default_risk_score' => 55,
                'runtime.notification_sync_enabled' => false,
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('server-settings.edit'));

        $this->assertSame(55, AbleSetting::where('key', 'algorithm.default_risk_score')->first()->value);
        $this->assertFalse(AbleSetting::where('key', 'runtime.notification_sync_enabled')->first()->value);
    }

    public function test_server_settings_reject_invalid_policy()
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->put(route('server-settings.update'), [
                'algorithm.fallback_policy' => 'not-a-policy',
            ]);

        $response->assertSessionHasErrors('algorithm.fallback_policy');
    }
}
