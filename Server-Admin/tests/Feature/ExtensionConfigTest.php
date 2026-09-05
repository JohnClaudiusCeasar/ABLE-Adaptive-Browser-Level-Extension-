<?php

namespace Tests\Feature;

use App\Support\JsCanonical;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class ExtensionConfigTest extends TestCase
{
    use RefreshDatabase;

    public function test_signed_config_endpoint_returns_verifiable_envelope()
    {
        Config::set('able.signing_key', '13b6056f7f072c80853526109de9268317e4a09842f3508b3df31c2fbdfaec4d');
        Config::set('able.signing_key_version', 1);

        $response = $this->getJson('/api/extension/config');

        $response->assertOk()
            ->assertJsonStructure([
                'payload' => [
                    'settings',
                    'issued_at',
                ],
                'signature',
                'key_version',
            ]);

        $payload = $response->json('payload');
        $signature = $response->json('signature');

        $this->assertSame(
            $signature,
            JsCanonical::sign($payload, '13b6056f7f072c80853526109de9268317e4a09842f3508b3df31c2fbdfaec4d'),
        );
    }

    public function test_signed_config_endpoint_excludes_server_keys_and_secrets()
    {
        Config::set('able.signing_key', '13b6056f7f072c80853526109de9268317e4a09842f3508b3df31c2fbdfaec4d');

        $response = $this->getJson('/api/extension/config');

        $settings = $response->json('payload.settings');

        $this->assertArrayNotHasKey('signing_key', $settings);
        $this->assertArrayNotHasKey('runtime.notification_sync_enabled', $settings);
        $this->assertArrayHasKey('behavior.risk_threshold', $settings);
    }
}
