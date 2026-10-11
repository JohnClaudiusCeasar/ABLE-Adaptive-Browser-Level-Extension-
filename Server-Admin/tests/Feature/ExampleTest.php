<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_renders_welcome_page_for_guests()
    {
        $response = $this->get(route('home'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('welcome'));
    }

    public function test_home_redirects_authenticated_users_to_dashboard()
    {
        $user = \App\Models\User::factory()->create();

        $response = $this->actingAs($user)->get(route('home'));

        $response->assertRedirect(route('dashboard'));
    }
}
