<?php

namespace Tests\Feature;

use App\Models\CommunityMessage;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommunityMessageTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_page_supplies_approved_community_messages(): void
    {
        // Seed approved and pending messages
        CommunityMessage::create([
            'author' => 'ApprovedUser',
            'category' => 'suggestion',
            'domain' => 'chat.openai.com',
            'message' => 'This is an approved suggestion.',
            'status' => 'approved',
        ]);

        CommunityMessage::create([
            'author' => 'PendingUser',
            'category' => 'comment',
            'domain' => 'claude.ai',
            'message' => 'This is a pending comment awaiting review.',
            'status' => 'pending',
        ]);

        $response = $this->get(route('home'));

        $response->assertOk();
        $response->assertInertia(function ($page) {
            $page->component('welcome')
                ->has('initialMessages', 1)
                ->where('initialMessages.0.author', 'ApprovedUser');
        });
    }

    public function test_visitors_can_submit_message_with_pending_status(): void
    {
        $payload = [
            'author' => 'AuditorBeta',
            'category' => 'false-positive',
            'domain' => 'gitlab.corp',
            'message' => 'Observed a false positive on a high-entropy git commit hash.',
        ];

        $response = $this->postJson(route('community-messages.store'), $payload);

        $response->assertStatus(201);
        $response->assertJson([
            'success' => true,
            'post' => [
                'author' => 'AuditorBeta',
                'category' => 'false-positive',
                'domain' => 'gitlab.corp',
                'status' => 'pending',
            ],
        ]);

        // Assert stored in database with pending status
        $this->assertDatabaseHas('community_messages', [
            'author' => 'AuditorBeta',
            'category' => 'false-positive',
            'status' => 'pending',
        ]);

        // Assert in-dashboard notification created for admins
        $this->assertDatabaseHas('notifications', [
            'source' => 'community',
            'type' => 'false_positive_report',
        ]);
    }

    public function test_submission_requires_valid_category_and_message(): void
    {
        $response = $this->postJson(route('community-messages.store'), [
            'category' => 'invalid-cat',
            'message' => '',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['category', 'message']);
    }

    public function test_guest_cannot_access_moderation_dashboard(): void
    {
        $response = $this->get(route('community-messages.index'));

        $response->assertRedirect(route('login'));
    }

    public function test_admin_can_view_and_moderate_community_messages(): void
    {
        $user = User::factory()->create();

        $message = CommunityMessage::create([
            'author' => 'TestVisitor',
            'category' => 'suggestion',
            'message' => 'A valuable suggestion needing review.',
            'status' => 'pending',
        ]);

        // Admin views list
        $indexResponse = $this->actingAs($user)->get(route('community-messages.index'));
        $indexResponse->assertOk();
        $indexResponse->assertInertia(fn ($page) => $page->component('community-messages'));

        // Admin approves message
        $approveResponse = $this->actingAs($user)->patch(route('community-messages.approve', $message));
        $approveResponse->assertRedirect();
        $this->assertEquals('approved', $message->fresh()->status);

        // Admin rejects message
        $rejectResponse = $this->actingAs($user)->patch(route('community-messages.reject', $message));
        $rejectResponse->assertRedirect();
        $this->assertEquals('rejected', $message->fresh()->status);

        // Admin deletes message
        $deleteResponse = $this->actingAs($user)->delete(route('community-messages.destroy', $message));
        $deleteResponse->assertRedirect();
        $this->assertDatabaseMissing('community_messages', ['id' => $message->id]);
    }

    public function test_crud_operations_sync_notifications_and_dispatch_events(): void
    {
        \Illuminate\Support\Facades\Event::fake([\App\Events\NotificationUpdated::class]);

        $user = User::factory()->create();

        // 1. CREATE Feedback
        $payload = [
            'author' => 'SecEngineer',
            'category' => 'suggestion',
            'domain' => 'api.openai.com',
            'message' => 'Add token inspection for headers.',
        ];

        $createResponse = $this->actingAs($user)->post(route('community-messages.store'), $payload, [
            'X-Inertia' => 'true',
        ]);
        $createResponse->assertRedirect();

        $message = CommunityMessage::where('author', 'SecEngineer')->first();
        $this->assertNotNull($message);

        // Assert notification created
        $this->assertDatabaseHas('notifications', [
            'source' => 'community',
            'status' => 'glass-unlisted',
            'message' => 'community-message-'.$message->id,
        ]);

        \Illuminate\Support\Facades\Event::assertDispatched(\App\Events\NotificationUpdated::class, function ($event) use ($message) {
            return $event->action === 'created' && $event->communityMessageId === $message->id;
        });

        // 2. UPDATE Feedback (Edit)
        $updateResponse = $this->actingAs($user)->patch(route('community-messages.update', $message), [
            'author' => 'SecEngineerUpdated',
            'category' => 'suggestion',
            'domain' => 'api.openai.com',
            'message' => 'Add token inspection for headers and body.',
            'status' => 'pending',
        ]);
        $updateResponse->assertRedirect();
        $this->assertSame('SecEngineerUpdated', $message->fresh()->author);

        \Illuminate\Support\Facades\Event::assertDispatched(\App\Events\NotificationUpdated::class, function ($event) use ($message) {
            return $event->action === 'updated' && $event->communityMessageId === $message->id;
        });

        // 3. APPROVE Feedback
        $approveResponse = $this->actingAs($user)->patch(route('community-messages.approve', $message));
        $approveResponse->assertRedirect();
        $this->assertSame('approved', $message->fresh()->status);

        // Assert notification updated to glass-safe
        $this->assertDatabaseHas('notifications', [
            'source' => 'community',
            'status' => 'glass-safe',
            'type' => 'community_feedback_approved',
            'message' => 'community-message-'.$message->id,
        ]);

        \Illuminate\Support\Facades\Event::assertDispatched(\App\Events\NotificationUpdated::class, function ($event) use ($message) {
            return $event->action === 'approved' && $event->communityMessageId === $message->id;
        });

        // 4. REJECT Feedback
        $rejectResponse = $this->actingAs($user)->patch(route('community-messages.reject', $message));
        $rejectResponse->assertRedirect();
        $this->assertSame('rejected', $message->fresh()->status);

        // Assert notification updated to glass-unsafe
        $this->assertDatabaseHas('notifications', [
            'source' => 'community',
            'status' => 'glass-unsafe',
            'type' => 'community_feedback_rejected',
            'message' => 'community-message-'.$message->id,
        ]);

        \Illuminate\Support\Facades\Event::assertDispatched(\App\Events\NotificationUpdated::class, function ($event) use ($message) {
            return $event->action === 'rejected' && $event->communityMessageId === $message->id;
        });

        // 5. DELETE Feedback
        $deleteResponse = $this->actingAs($user)->delete(route('community-messages.destroy', $message));
        $deleteResponse->assertRedirect();
        $this->assertDatabaseMissing('community_messages', ['id' => $message->id]);

        // Assert notification removed
        $this->assertDatabaseMissing('notifications', [
            'message' => 'community-message-'.$message->id,
            'deleted_at' => null,
        ]);

        \Illuminate\Support\Facades\Event::assertDispatched(\App\Events\NotificationUpdated::class, function ($event) use ($message) {
            return $event->action === 'deleted' && $event->communityMessageId === $message->id;
        });
    }

    public function test_notifications_page_renders_community_feedback_notifications(): void
    {
        $user = User::factory()->create();

        $message = CommunityMessage::create([
            'author' => 'VisitorAlpha',
            'category' => 'false-positive',
            'domain' => 'gitlab.com',
            'message' => 'Hash triggered false positive alert.',
            'status' => 'pending',
        ]);

        Notification::create([
            'source' => 'community',
            'type' => 'false_positive_report',
            'description' => "Community message pending review from {$message->author} ({$message->category})",
            'domain' => $message->domain,
            'status' => 'glass-unlisted',
            'message' => 'community-message-'.$message->id,
            'occurred_at' => now(),
        ]);

        $response = $this->actingAs($user)->get(route('notifications'));
        $response->assertOk();
        $response->assertInertia(function ($page) {
            $page->component('notifications')
                ->has('notifications', 1)
                ->where('notifications.0.source', 'community')
                ->where('notifications.0.type', 'False Positive Report')
                ->where('unreadCount', 1);
        });
    }
}
