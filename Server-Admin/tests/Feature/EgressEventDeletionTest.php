<?php

namespace Tests\Feature;

use App\Models\EgressEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The egress event delete endpoints used to sit in the public API group,
 * where anyone who knew the URL could remove a single event or the whole
 * table. They are administrative actions, so they require a signed-in
 * administrator.
 */
class EgressEventDeletionTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);
    }

    public function test_deleting_a_single_event_requires_authentication(): void
    {
        $event = EgressEvent::create([
            'domain' => 'example.test',
            'user_id' => 'ABLE-TEST1',
            'file_name' => 'file.pdf',
            'file_size' => 10,
            'risk_score' => 60,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        $this->deleteJson("/egress-events/{$event->id}")->assertUnauthorized();

        $this->assertNotNull(EgressEvent::find($event->id));
    }

    public function test_deleting_every_event_requires_authentication(): void
    {
        EgressEvent::create([
            'domain' => 'example.test',
            'user_id' => 'ABLE-TEST1',
            'file_name' => 'file.pdf',
            'file_size' => 10,
            'risk_score' => 60,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        $this->deleteJson('/egress-events')->assertUnauthorized();

        $this->assertSame(1, EgressEvent::count());
    }

    public function test_an_administrator_can_delete_an_event(): void
    {
        $event = EgressEvent::create([
            'domain' => 'example.test',
            'user_id' => 'ABLE-TEST1',
            'file_name' => 'file.pdf',
            'file_size' => 10,
            'risk_score' => 60,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        $this->actingAs($this->admin())
            ->deleteJson("/egress-events/{$event->id}")
            ->assertOk();

        $this->assertNull(EgressEvent::find($event->id));
    }

    public function test_the_public_api_no_longer_exposes_the_delete_endpoints(): void
    {
        $this->deleteJson('/api/egress-events')->assertNotFound();
        $this->deleteJson('/api/egress-events/1')->assertNotFound();
    }
}
