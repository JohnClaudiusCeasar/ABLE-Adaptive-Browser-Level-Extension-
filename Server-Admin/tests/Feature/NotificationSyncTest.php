<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\LoginActivity;
use App\Models\Notification;
use App\Models\NudgeInteraction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationSyncTest extends TestCase
{
    use RefreshDatabase;

    private function createUser(string $email = 'admin@test.com'): User
    {
        return User::factory()->create([
            'email' => $email,
            'email_verified_at' => now(),
        ]);
    }

    private function seedAllSourceData(User $authUser): void
    {
        // Egress event + nudge
        $egress = EgressEvent::create([
            'domain' => 'unsafe-site.com',
            'user_id' => 'ABLE-TEST1',
            'file_name' => 'test.pdf',
            'file_size' => 1024,
            'risk_score' => 90,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);
        NudgeInteraction::create([
            'egress_event_id' => $egress->id,
            'domain' => 'unsafe-site.com',
            'user_id' => 'ABLE-TEST1',
            'user_action' => 'cancelled',
            'interacted_at' => now(),
        ]);

        // Domain visit
        $policy = DomainPolicy::create([
            'domain' => 'unlisted-site.com',
            'domain_status' => 'unlisted',
            'policy' => 'under_review',
            'risk_score' => 70,
            'visit_count' => 1,
            'last_visited_at' => now(),
        ]);
        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => 'unlisted-site.com',
            'user_id' => 'ABLE-TEST1',
            'visited_at' => now(),
        ]);

        // Audit log
        AuditLog::create([
            'auditable_type' => 'App\Models\DomainPolicy',
            'auditable_id' => $policy->id,
            'action' => 'updated',
            'user_id' => $authUser->id,
            'user_email' => $authUser->email,
            'data_changes' => json_encode(['original' => [], 'changes' => []]),
            'occurred_at' => now(),
        ]);

        // Extension lifecycle
        ExtensionLifecycle::create([
            'user_id' => 'ABLE-TEST1',
            'extension_id' => 'ext123',
            'event' => 'uninstalled',
            'occurred_at' => now(),
        ]);

        // Chat message (use auth user and a second user)
        $user2 = User::factory()->create(['email' => 'other@test.com', 'email_verified_at' => now()]);
        $conversation = ChatConversation::forPair($authUser, $user2);
        ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $authUser->id,
            'body' => 'Hello!',
        ]);
    }

    public function test_login_notifications_are_not_created(): void
    {
        $user = $this->createUser();
        $this->actingAs($user);

        LoginActivity::create([
            'email' => 'someone@test.com',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'test',
            'type' => 'success',
            'created_at' => now(),
        ]);

        $this->get(route('notifications'))->assertOk();

        $this->assertSame(0, Notification::where('source', 'login')->count());
    }

    public function test_all_extension_event_types_sync_to_notifications(): void
    {
        $user = $this->createUser();
        $this->actingAs($user);

        $this->seedAllSourceData($user);

        $this->get(route('notifications'))->assertOk();

        $sources = Notification::pluck('source')->unique()->toArray();
        $this->assertContains('egress', $sources);
        $this->assertContains('domain', $sources);
        $this->assertContains('extension', $sources);
    }

    public function test_each_notification_has_a_description(): void
    {
        $user = $this->createUser();
        $this->actingAs($user);

        $this->seedAllSourceData($user);

        $this->get(route('notifications'))->assertOk();

        $notifications = Notification::all();
        foreach ($notifications as $notification) {
            $this->assertNotNull($notification->description, "Notification {$notification->id} (source: {$notification->source}) has no description");
            $this->assertNotEmpty($notification->description, "Notification {$notification->id} (source: {$notification->source}) has empty description");
        }

        // Spot-check specific description patterns
        $this->assertStringContainsString('ext123', Notification::where('source', 'extension')->first()->description);
        $this->assertStringContainsString('test.pdf', Notification::where('source', 'egress')->first()->description);
        $this->assertStringContainsString('unlisted-site.com', Notification::where('source', 'domain')->first()->description);
    }

    public function test_clear_all_permanently_removes_notifications(): void
    {
        $user = $this->createUser();
        $this->actingAs($user);

        $this->seedAllSourceData($user);

        // First visit triggers sync — notifications are created
        $this->get(route('notifications'))->assertOk();

        $totalBeforeDelete = Notification::count();
        $this->assertGreaterThan(0, $totalBeforeDelete);

        // Clear all
        $this->delete(route('notifications.destroyAll'))->assertRedirect();

        // Soft-deleted records are excluded from default query
        $this->assertSame(0, Notification::count(), 'Default query excludes soft-deleted notifications');

        // Visit page again — sync runs, but soft deletes prevent recreation
        $this->get(route('notifications'))->assertOk();

        // Notifications are NOT recreated because sync uses withTrashed() dedup check
        $this->assertSame(0, Notification::count(),
            'Notifications are NOT recreated by sync after clear-all — soft delete fix works');

        // Soft-deleted records still exist in the database
        $this->assertGreaterThan(0, Notification::withTrashed()->count(),
            'Soft-deleted records are still in the database');
    }

    public function test_single_notification_delete_is_not_recreated_by_sync(): void
    {
        $user = $this->createUser();
        $this->actingAs($user);

        $this->seedAllSourceData($user);

        // Trigger sync
        $this->get(route('notifications'))->assertOk();
        $this->assertGreaterThan(0, Notification::count());

        $notification = Notification::first();
        $this->assertNotNull($notification);
        $dedupKey = $notification->message;

        // Delete single notification
        $this->delete(route('notifications.destroy', $notification))->assertRedirect();

        // Soft-deleted: excluded from default query, but still with trashed
        $this->assertNull(Notification::find($notification->id), 'Deleted notification excluded from default query');
        $this->assertNotNull(Notification::withTrashed()->find($notification->id), 'Deleted notification still with trashed');

        // Visit page again — sync should NOT recreate this notification
        $this->get(route('notifications'))->assertOk();

        // The soft-deleted notification should NOT be recreated (no duplicate)
        $this->assertSame(0, Notification::where('message', $dedupKey)->count(),
            'No active notification with this dedup key after delete + sync');

        // The soft-deleted record still exists (not duplicated)
        $this->assertSame(1, Notification::withTrashed()->where('message', $dedupKey)->count(),
            'Soft-deleted record remains but no duplicate was created');
    }

    public function test_idempotent_sync_does_not_duplicate_notifications(): void
    {
        $user = $this->createUser();
        $this->actingAs($user);

        $this->seedAllSourceData($user);

        // First page load — sync creates notifications
        $this->get(route('notifications'))->assertOk();
        $countAfterFirstSync = Notification::count();
        $this->assertGreaterThan(0, $countAfterFirstSync);

        // Second page load — sync should not create duplicates
        $this->get(route('notifications'))->assertOk();
        $countAfterSecondSync = Notification::count();

        $this->assertSame($countAfterFirstSync, $countAfterSecondSync,
            'Sync is idempotent — no duplicate notifications');
    }

    public function test_status_for_risk_maps_correctly_to_glass_status(): void
    {
        $user = $this->createUser();
        $this->actingAs($user);

        EgressEvent::create([
            'domain' => 'safe.com',
            'user_id' => 'u1',
            'file_name' => 'f1.pdf',
            'risk_score' => 25,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        EgressEvent::create([
            'domain' => 'unlisted.com',
            'user_id' => 'u2',
            'file_name' => 'f2.pdf',
            'risk_score' => 60,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        EgressEvent::create([
            'domain' => 'unsafe.com',
            'user_id' => 'u3',
            'file_name' => 'f3.pdf',
            'risk_score' => 85,
            'action' => 'proceeded',
            'occurred_at' => now(),
        ]);

        $this->get(route('notifications'))->assertOk();

        $this->assertSame('glass-safe', Notification::where('risk_score', 25)->first()->status);
        $this->assertSame('glass-unlisted', Notification::where('risk_score', 60)->first()->status);
        $this->assertSame('glass-unsafe', Notification::where('risk_score', 85)->first()->status);
    }
}
