<?php

namespace Tests\Feature;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('chat.index'));

        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_users_can_visit_the_chat_page()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->get(route('chat.index'));

        $response->assertOk();
    }

    public function test_users_can_start_a_conversation_with_another_user()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($user);

        $response = $this->post(route('chat.start', $other));

        $conversation = ChatConversation::first();

        $this->assertNotNull($conversation);
        $this->assertTrue($conversation->involves($user));
        $this->assertTrue($conversation->involves($other));
        $response->assertRedirect(route('chat.show', $conversation));
    }

    public function test_starting_a_conversation_reuses_the_existing_pair()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($user);

        $this->post(route('chat.start', $other));

        // Start the same conversation from the other direction.
        $this->post(route('chat.start', $other));

        $this->assertSame(1, ChatConversation::count());
    }

    public function test_users_can_send_a_message_in_their_conversation()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);
        $this->actingAs($user);

        $response = $this->postJson(route('chat.messages.store', $conversation), [
            'body' => 'Hello there!',
        ]);

        $response->assertStatus(201);

        $this->assertSame(1, ChatMessage::count());
        $this->assertSame('Hello there!', ChatMessage::first()->body);
        $this->assertNotNull($conversation->fresh()->last_message_at);
    }

    public function test_non_members_cannot_send_messages()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $stranger = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);
        $this->actingAs($stranger);

        $response = $this->postJson(route('chat.messages.store', $conversation), [
            'body' => 'Sneaky message',
        ]);

        $response->assertForbidden();
        $this->assertSame(0, ChatMessage::count());
    }

    public function test_messages_are_marked_read_when_the_recipient_fetches_them()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);
        ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $other->id,
            'body' => 'Read me',
        ]);
        $this->actingAs($user);

        $this->getJson(route('chat.messages.index', $conversation));

        $this->assertNotNull(ChatMessage::first()->read_at);
    }

    public function test_unread_count_reflects_incoming_messages()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);
        ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $other->id,
            'body' => 'Unread',
        ]);
        $this->actingAs($user);

        $response = $this->getJson(route('chat.unread-count'));

        $response->assertOk()->assertJson(['count' => 1]);
    }

    public function test_messages_are_ordered_newest_first_in_the_payload()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);
        $this->actingAs($user);

        foreach (range(1, 5) as $i) {
            ChatMessage::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $other->id,
                'body' => "Message {$i}",
            ]);
        }

        $response = $this->getJson(route('chat.messages.index', $conversation));

        $response->assertOk();
        $ids = collect($response->json('messages'))->pluck('id')->all();
        $this->assertSame($ids, collect($ids)->sortDesc()->values()->all());
    }

    public function test_messages_are_paginated_with_a_cursor()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);
        $this->actingAs($user);

        foreach (range(1, 25) as $i) {
            ChatMessage::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $other->id,
                'body' => "Message {$i}",
            ]);
        }

        // First page: the 10 newest, with a cursor to the oldest loaded one.
        $first = $this->getJson(route('chat.messages.index', $conversation));
        $first->assertOk();
        $this->assertCount(10, $first->json('messages'));
        $this->assertNotNull($first->json('next_cursor'));
        $this->assertSame(25, $first->json('total'));

        // Second page: the next 10 older messages.
        $second = $this->getJson(route('chat.messages.index', $conversation).'?before='.$first->json('next_cursor'));
        $second->assertOk();
        $this->assertCount(10, $second->json('messages'));
        $this->assertNotNull($second->json('next_cursor'));

        // Third page: the remaining 5, no more history.
        $third = $this->getJson(route('chat.messages.index', $conversation).'?before='.$second->json('next_cursor'));
        $third->assertOk();
        $this->assertCount(5, $third->json('messages'));
        $this->assertNull($third->json('next_cursor'));

        // Pages are disjoint and cover the full thread.
        $all = array_merge($third->json('messages'), $second->json('messages'), $first->json('messages'));
        $this->assertCount(25, $all);
        $this->assertSame(25, collect($all)->pluck('id')->unique()->count());
    }

    public function test_users_can_start_a_conversation_via_json()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($user);

        $response = $this->postJson(route('chat.start', $other));

        $response->assertOk();
        $response->assertJsonStructure([
            'conversation' => ['id', 'path', 'other_user', 'unread_count'],
            'messages',
            'next_cursor',
            'total',
        ]);
        $this->assertSame($other->id, $response->json('conversation.other_user.id'));
    }

    public function test_users_can_send_a_message_with_attachment()
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $user = User::factory()->create();
        $other = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);
        $this->actingAs($user);

        $file = \Illuminate\Http\UploadedFile::fake()->create('document.pdf', 1024, 'application/pdf');

        $response = $this->post(route('chat.messages.store', $conversation), [
            'body' => 'Here is the report',
            'attachment' => $file,
        ], ['Accept' => 'application/json']);

        $response->assertStatus(201);
        $this->assertSame(1, ChatMessage::count());
        $message = ChatMessage::first();
        $this->assertSame('Here is the report', $message->body);
        $this->assertSame('document.pdf', $message->attachment_name);
        $this->assertNotNull($message->attachment_path);
        \Illuminate\Support\Facades\Storage::disk('public')->assertExists($message->attachment_path);
    }

    public function test_disallowed_file_types_are_rejected()
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $user = User::factory()->create();
        $other = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);
        $this->actingAs($user);

        $file = \Illuminate\Http\UploadedFile::fake()->create('malicious.exe', 1024, 'application/x-msdownload');

        $response = $this->post(route('chat.messages.store', $conversation), [
            'body' => 'Run this',
            'attachment' => $file,
        ], ['Accept' => 'application/json']);

        $response->assertStatus(422);
        $this->assertArrayHasKey('attachment', $response->json('errors') ?? []);
        $this->assertSame(0, ChatMessage::count());
    }

    public function test_image_attachments_are_accepted()
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $user = User::factory()->create();
        $other = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);
        $this->actingAs($user);

        $file = \Illuminate\Http\UploadedFile::fake()->create('screenshot.png', 500, 'image/png');

        $response = $this->post(route('chat.messages.store', $conversation), [
            'body' => 'Look at this',
            'attachment' => $file,
        ], ['Accept' => 'application/json']);

        $response->assertStatus(201);
        $this->assertSame(1, ChatMessage::count());
        $this->assertSame('screenshot.png', ChatMessage::first()->attachment_name);
    }

    public function test_users_can_mark_all_incoming_messages_as_read()
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $conversation = ChatConversation::forPair($user, $other);

        ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $other->id,
            'body' => 'Unread message 1',
        ]);
        ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $other->id,
            'body' => 'Unread message 2',
        ]);

        $this->actingAs($user);

        $response = $this->postJson(route('chat.read-all'));
        $response->assertOk();
        $response->assertJson(['success' => true]);

        $this->assertSame(0, ChatMessage::whereNull('read_at')->count());
    }
}

