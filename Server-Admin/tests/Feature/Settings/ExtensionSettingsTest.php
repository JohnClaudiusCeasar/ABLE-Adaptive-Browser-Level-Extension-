<?php

namespace Tests\Feature\Settings;

use App\Models\AbleSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExtensionSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_extension_settings_page_is_displayed()
    {
        $user = User::factory()->superAdmin()->create();

        $response = $this
            ->actingAs($user)
            ->get(route('extension-settings.edit'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->has('settings')
            ->has('status.signing_key_ok')
            ->has('status.egress_today')
        );
    }

    public function test_guests_are_redirected_from_extension_settings()
    {
        $response = $this->get(route('extension-settings.edit'));

        $response->assertRedirect(route('login'));
    }

    public function test_admin_without_settings_access_is_forbidden()
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)->get(route('extension-settings.edit'))->assertForbidden();
        $this->actingAs($admin)
            ->put(route('extension-settings.update'), ['behavior.risk_threshold' => 70])
            ->assertForbidden();
    }

    public function test_extension_settings_can_be_updated()
    {
        $user = User::factory()->superAdmin()->create();

        $response = $this
            ->actingAs($user)
            ->put(route('extension-settings.update'), [
                'behavior.risk_threshold' => 85,
                'logging.daily_egress_cap' => 250,
                'excluded_domains' => ['localhost', 'example.com'],
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('extension-settings.edit'));

        $this->assertDatabaseHas('able_settings', [
            'group' => 'extension',
            'key' => 'behavior.risk_threshold',
            'updated_by' => $user->id,
        ]);

        $this->assertSame(85, AbleSetting::where('key', 'behavior.risk_threshold')->first()->value);
    }

    public function test_extension_settings_reject_out_of_range_value()
    {
        $user = User::factory()->superAdmin()->create();

        $response = $this
            ->actingAs($user)
            ->put(route('extension-settings.update'), [
                'behavior.risk_threshold' => 999,
            ]);

        $response->assertSessionHasErrors('behavior.risk_threshold');
    }

    public function test_extension_egress_flush_interval_can_be_updated()
    {
        $user = User::factory()->superAdmin()->create();

        $response = $this
            ->actingAs($user)
            ->put(route('extension-settings.update'), [
                'sync.egress_log_flush_interval_minutes' => 10,
            ]);

        $response->assertSessionHasNoErrors();

        $this->assertSame(10, AbleSetting::where('key', 'sync.egress_log_flush_interval_minutes')->first()->value);
    }

    public function test_unsafe_modal_cooldowns_can_be_updated()
    {
        $user = User::factory()->superAdmin()->create();

        $response = $this
            ->actingAs($user)
            ->put(route('extension-settings.update'), [
                'behavior.unsafe_modal_short_cooldown_ms' => 15000,
                'behavior.unsafe_modal_stagger_cooldown_ms' => 120000,
            ]);

        $response->assertSessionHasNoErrors();

        $this->assertSame(
            15000,
            AbleSetting::where('key', 'behavior.unsafe_modal_short_cooldown_ms')->first()->value,
        );
        $this->assertSame(
            120000,
            AbleSetting::where('key', 'behavior.unsafe_modal_stagger_cooldown_ms')->first()->value,
        );
    }

    public function test_unsafe_modal_cooldown_rejects_out_of_range_value()
    {
        $user = User::factory()->superAdmin()->create();

        $response = $this
            ->actingAs($user)
            ->put(route('extension-settings.update'), [
                'behavior.unsafe_modal_short_cooldown_ms' => 3600001,
            ]);

        $response->assertSessionHasErrors('behavior.unsafe_modal_short_cooldown_ms');
    }

    public function test_extension_integrity_pin_can_be_updated()
    {
        $user = User::factory()->superAdmin()->create();
        $hash = str_repeat('a', 64);

        $response = $this
            ->actingAs($user)
            ->put(route('extension-settings.update'), [
                'integrity.expected_inject_hash' => $hash,
            ]);

        $response->assertSessionHasNoErrors();

        $this->assertSame($hash, AbleSetting::where('key', 'integrity.expected_inject_hash')->first()->value);
    }

    public function test_extension_integrity_pin_rejects_a_value_that_is_not_a_hash()
    {
        $user = User::factory()->superAdmin()->create();

        $response = $this
            ->actingAs($user)
            ->put(route('extension-settings.update'), [
                'integrity.expected_inject_hash' => 'not-a-hash',
            ]);

        $response->assertSessionHasErrors('integrity.expected_inject_hash');

        $this->assertDatabaseMissing('able_settings', [
            'group' => 'extension',
            'key' => 'integrity.expected_inject_hash',
        ]);
    }
}
