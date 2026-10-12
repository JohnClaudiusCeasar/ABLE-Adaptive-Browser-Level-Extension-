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
}
