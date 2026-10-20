<?php

namespace Tests\Feature;

use App\Events\NotificationUpdated;
use App\Models\CommunityMessage;
use App\Models\DomainPolicy;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
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

    public function test_visitors_can_submit_access_request_message(): void
    {
        $payload = [
            'author' => 'BlockedAnalyst',
            'category' => 'access-request',
            'domain' => 'gambling-rewards-hub.com',
            'message' => 'I need access to this domain for cybersecurity threat analysis.',
        ];

        $response = $this->postJson(route('community-messages.store'), $payload);

        $response->assertStatus(201);
        $response->assertJson([
            'success' => true,
            'post' => [
                'category' => 'access-request',
                'domain' => 'gambling-rewards-hub.com',
                'status' => 'pending',
            ],
        ]);

        $this->assertDatabaseHas('community_messages', [
            'author' => 'BlockedAnalyst',
            'category' => 'access-request',
            'status' => 'pending',
        ]);

        // Existing categories must remain valid alongside the new one
        $this->postJson(route('community-messages.store'), [
            'category' => 'suggestion',
            'message' => 'Still works.',
        ])->assertStatus(201);
    }

    public function test_guest_cannot_access_moderation_dashboard(): void
    {
        $response = $this->get(route('community-messages.index'));

        $response->assertRedirect(route('login'));
    }

    public function test_request_access_redirect_prefills_the_message_board(): void
    {
        $response = $this->get('/?category=access-request&domain=gambling-rewards-hub.com');

        $response->assertOk();
        $response->assertInertia(function ($page) {
            $page->component('welcome')
                ->where('requestCategory', 'access-request')
                ->where('requestDomain', 'gambling-rewards-hub.com');
        });
    }

    public function test_home_page_without_request_params_has_no_prefill(): void
    {
        $response = $this->get(route('home'));

        $response->assertOk();
        $response->assertInertia(function ($page) {
            $page->component('welcome')
                ->where('requestCategory', null)
                ->where('requestDomain', null);
        });
    }

    public function test_access_requests_are_never_published_on_the_public_feed(): void
    {
        CommunityMessage::create([
            'author' => 'BlockedUser',
            'category' => 'access-request',
            'domain' => 'gambling-rewards-hub.com',
            'message' => 'I need access for threat analysis.',
            'status' => 'approved',
        ]);

        CommunityMessage::create([
            'author' => 'RegularUser',
            'category' => 'suggestion',
            'message' => 'A general suggestion.',
            'status' => 'approved',
        ]);

        $response = $this->get(route('home'));

        $response->assertOk();
        $response->assertInertia(function ($page) {
            $page->component('welcome')
                ->has('initialMessages', 1)
                ->where('initialMessages.0.category', 'suggestion');
        });
    }

    public function test_approving_an_access_request_lifts_the_site_block(): void
    {
        $policy = DomainPolicy::create([
            'domain' => 'gambling-rewards-hub.com',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'block_access' => true,
            'category' => 'Gambling',
            'risk_score' => 70,
        ]);

        $request = CommunityMessage::create([
            'author' => 'BlockedUser',
            'category' => 'access-request',
            'domain' => 'gambling-rewards-hub.com',
            'message' => 'I need access for threat analysis.',
            'status' => 'pending',
        ]);

        $this->actingAs(User::factory()->create())
            ->patch(route('community-messages.approve', $request))
            ->assertRedirect();

        $this->assertSame('approved', $request->fresh()->status);
        $this->assertFalse($policy->fresh()->block_access);
    }

    public function test_approving_regular_feedback_does_not_touch_site_blocks(): void
    {
        $policy = DomainPolicy::create([
            'domain' => 'gambling-rewards-hub.com',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'block_access' => true,
            'category' => 'Gambling',
            'risk_score' => 70,
        ]);

        $feedback = CommunityMessage::create([
            'author' => 'RegularUser',
            'category' => 'suggestion',
            'message' => 'A general suggestion.',
            'status' => 'pending',
        ]);

        $this->actingAs(User::factory()->create())
            ->patch(route('community-messages.approve', $feedback))
            ->assertRedirect();

        $this->assertTrue($policy->fresh()->block_access);
    }

    public function test_access_requests_board_lists_only_access_requests(): void
    {
        CommunityMessage::create([
            'author' => 'BlockedUser',
            'category' => 'access-request',
            'domain' => 'gambling-rewards-hub.com',
            'message' => 'I need access for threat analysis.',
            'status' => 'pending',
        ]);

        CommunityMessage::create([
            'author' => 'RegularUser',
            'category' => 'suggestion',
            'message' => 'A general suggestion.',
            'status' => 'pending',
        ]);

        $response = $this->actingAs(User::factory()->create())
            ->get(route('access-requests.index'));

        $response->assertOk();
        $response->assertInertia(function ($page) {
            $page->component('access-requests')
                ->has('messages.data', 1)
                ->where('messages.data.0.category', 'access-request')
                ->where('counts.all', 1);
        });

        // The shared board still shows both categories
        $sharedResponse = $this->actingAs(User::factory()->create())
            ->get(route('community-messages.index'));

        $sharedResponse->assertOk();
        $sharedResponse->assertInertia(fn ($page) => $page->component('community-messages')->has('messages.data', 2));
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
        Event::fake([NotificationUpdated::class]);

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

        Event::assertDispatched(NotificationUpdated::class, function ($event) use ($message) {
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

        Event::assertDispatched(NotificationUpdated::class, function ($event) use ($message) {
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

        Event::assertDispatched(NotificationUpdated::class, function ($event) use ($message) {
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

        Event::assertDispatched(NotificationUpdated::class, function ($event) use ($message) {
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

        Event::assertDispatched(NotificationUpdated::class, function ($event) use ($message) {
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
