<?php

namespace Tests\Feature;

use App\Models\ExtensionIntegrityEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class ExtensionIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_stores_a_guard_tamper_event(): void
    {
        $response = $this->postJson('/api/extension/integrity', [
            'user_id' => 'ABLE-TESTUSER',
            'domain' => 'example.com',
            'reason' => 'fetch,xhr.send',
            'extension_id' => 'abcdefghijklmnop',
            'version' => '1.2.3',
            'event_id' => 'integrity-event-1',
            'occurred_at' => now()->getTimestampMs(),
        ]);

        $response->assertOk()->assertJson(['success' => true]);

        $this->assertDatabaseHas('extension_integrity_events', [
            'user_id' => 'ABLE-TESTUSER',
            'domain' => 'example.com',
            'reason' => 'fetch,xhr.send',
            'event_id' => 'integrity-event-1',
        ]);
    }

    /**
     * The extension only guarantees the user id and a reason; every other field
     * is optional on the wire.
     */
    public function test_it_accepts_the_client_payload_without_optional_fields(): void
    {
        $response = $this->postJson('/api/extension/integrity', [
            'user_id' => 'ABLE-TESTUSER',
            'reason' => 'provenance module missing',
        ]);

        $response->assertOk();

        $event = ExtensionIntegrityEvent::firstOrFail();
        $this->assertSame('ABLE-TESTUSER', $event->user_id);
        $this->assertNull($event->domain);
        $this->assertSame('provenance module missing', $event->reason);
    }

    public function test_event_id_is_idempotent(): void
    {
        $payload = [
            'user_id' => 'ABLE-TESTUSER',
            'domain' => 'example.com',
            'reason' => 'fetch',
            'event_id' => 'integrity-event-1',
        ];

        $this->postJson('/api/extension/integrity', $payload)->assertOk();
        $this->postJson('/api/extension/integrity', $payload)
            ->assertOk()
            ->assertJson(['duplicate' => true]);

        $this->assertSame(1, ExtensionIntegrityEvent::count());
    }

    public function test_excluded_domains_are_skipped(): void
    {
        Config::set('able.excluded_domains', ['ignored.test']);

        $response = $this->postJson('/api/extension/integrity', [
            'user_id' => 'ABLE-TESTUSER',
            'domain' => 'ignored.test',
            'reason' => 'fetch',
        ]);

        $response->assertOk()->assertJson(['skipped' => true]);
        $this->assertSame(0, ExtensionIntegrityEvent::count());
    }

    public function test_user_id_is_required(): void
    {
        $this->postJson('/api/extension/integrity', [
            'reason' => 'fetch',
        ])->assertStatus(422);
    }
}
