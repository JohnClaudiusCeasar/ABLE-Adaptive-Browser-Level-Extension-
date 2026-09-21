<?php

namespace Tests\Feature;

use App\Models\DomainPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClassifyDomainTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_get_classify_still_works(): void
    {
        $response = $this->getJson('/api/classify-domain?url=https://example.com/page');

        $response->assertOk()->assertJson([
            'status' => 'unlisted',
            'domain' => 'example.com',
            'source' => 'pending',
        ]);
    }

    public function test_post_classify_auto_categorizes_finance_domain(): void
    {
        $response = $this->postJson('/api/classify-domain', [
            'url' => 'https://mybank-portal.com/login',
            'signals' => [
                'title' => 'MyBank Online Banking Login',
                'meta' => ['description' => 'Secure banking, loans and credit cards'],
                'headings' => ['Account balance'],
                'excerpt' => 'Welcome to online banking. Check your mortgage and investment accounts.',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'unlisted')
            ->assertJsonPath('domain', 'mybank-portal.com')
            ->assertJsonPath('category', 'Finance')
            ->assertJsonPath('source', 'heuristic')
            ->assertJsonPath('classification_source', 'heuristic');

        $this->assertSame('Finance', DomainPolicy::where('domain', 'mybank-portal.com')->value('category'));
        $this->assertSame('heuristic', DomainPolicy::where('domain', 'mybank-portal.com')->value('classification_source'));
    }

    public function test_known_domain_served_from_database(): void
    {
        DomainPolicy::create([
            'domain' => 'shop.example',
            'domain_status' => 'unlisted',
            'policy' => 'under_review',
            'category' => 'E-commerce',
            'classification_source' => 'manual',
            'risk_score' => 55,
        ]);

        $this->postJson('/api/classify-domain', [
            'url' => 'https://shop.example/products',
            'signals' => ['title' => 'Bank loans here'],
        ])->assertOk()->assertJson([
            'category' => 'E-commerce',
            'source' => 'database',
            'classification_source' => 'manual',
        ]);
    }

    public function test_gambling_domain_gets_blacklisted_policy(): void
    {
        $response = $this->postJson('/api/classify-domain', [
            'url' => 'https://luckycasino-bet.com',
            'signals' => [
                'title' => 'Lucky Casino - Poker, Slots and Sportsbook',
                'excerpt' => 'Place your wager. Best odds on blackjack and lottery.',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('category', 'Gambling')
            ->assertJsonPath('policy', 'blacklisted');
    }

    public function test_no_matching_signals_parks_domain_in_review_queue(): void
    {
        $response = $this->postJson('/api/classify-domain', [
            'url' => 'https://xqz-zzz-random-12345.com',
            'signals' => ['title' => 'xqz zzz 12345'],
        ]);

        $response->assertOk()
            ->assertJsonPath('category', null)
            ->assertJsonPath('source', 'pending')
            ->assertJsonPath('classification_source', 'pending');

        $this->assertSame('pending', DomainPolicy::where('domain', 'xqz-zzz-random-12345.com')->value('classification_source'));
    }

    public function test_brand_map_resolves_mainstream_domain(): void
    {
        $response = $this->postJson('/api/classify-domain', [
            'url' => 'https://www.youtube.com/',
            'signals' => ['title' => 'YouTube'],
        ]);

        $response->assertOk()
            ->assertJsonPath('domain', 'youtube.com')
            ->assertJsonPath('category', 'Streaming')
            ->assertJsonPath('source', 'brand')
            ->assertJsonPath('classification_source', 'brand');

        $this->assertSame('Streaming', DomainPolicy::where('domain', 'youtube.com')->value('category'));
    }

    public function test_brand_map_resolves_subdomain_via_suffix(): void
    {
        $response = $this->postJson('/api/classify-domain', [
            'url' => 'https://mail.google.com/mail/u/0/',
            'signals' => ['title' => 'Sign in'],
        ]);

        $response->assertOk()
            ->assertJsonPath('domain', 'mail.google.com')
            ->assertJsonPath('category', 'Email')
            ->assertJsonPath('source', 'brand');
    }

    public function test_rich_jsonld_signals_classify_streaming(): void
    {
        $response = $this->postJson('/api/classify-domain', [
            'url' => 'https://obscure-clips.example/watch/abc123',
            'signals' => [
                'title' => 'Watch',
                'meta' => ['og:type' => 'video.other', 'og:site_name' => 'ClipHub'],
                'ldJson' => ['{"@context":"https://schema.org","@type":"VideoObject","name":"Funny clip"}'],
                'urlTokens' => ['hostParts' => ['obscure-clips', 'example'], 'pathSegs' => ['watch', 'abc123']],
                'anchors' => ['topText' => [['text' => 'watch later', 'count' => 12]]],
                'excerpt' => 'a b c d e f g',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('category', 'Streaming')
            ->assertJsonPath('source', 'heuristic');
    }

    public function test_login_form_with_mail_signals_classifies_email(): void
    {
        $response = $this->postJson('/api/classify-domain', [
            'url' => 'https://webmail-obscure.example/',
            'signals' => [
                'title' => 'Sign in',
                'forms' => ['hasPassword' => true],
                'anchors' => ['topText' => [['text' => 'inbox', 'count' => 5], ['text' => 'compose mail', 'count' => 3]]],
                'excerpt' => 'sign in to continue',
            ],
        ]);

        $response->assertOk()->assertJsonPath('category', 'Email');
    }

    public function test_post_classify_auto_categorizes_ai_domain(): void
    {
        $response = $this->postJson('/api/classify-domain', [
            'url' => 'https://genai-chat-tool.io/models',
            'signals' => [
                'title' => 'GenAI Chat - LLM & AI Assistant',
                'meta' => ['description' => 'Access state of the art generative AI models and chatbots'],
                'headings' => ['Generative AI Models & Prompt Engineering'],
                'excerpt' => 'Our AI assistant provides large language model capabilities and generative AI text completion.',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'unlisted')
            ->assertJsonPath('domain', 'genai-chat-tool.io')
            ->assertJsonPath('category', 'AI')
            ->assertJsonPath('source', 'heuristic')
            ->assertJsonPath('classification_source', 'heuristic')
            ->assertJsonPath('risk_score', 50);

        $this->assertSame('AI', DomainPolicy::where('domain', 'genai-chat-tool.io')->value('category'));
        $this->assertSame('heuristic', DomainPolicy::where('domain', 'genai-chat-tool.io')->value('classification_source'));
    }

    public function test_brand_map_resolves_ai_domain(): void
    {
        $response = $this->postJson('/api/classify-domain', [
            'url' => 'https://chatgpt.com/',
            'signals' => ['title' => 'ChatGPT'],
        ]);

        $response->assertOk()
            ->assertJsonPath('domain', 'chatgpt.com')
            ->assertJsonPath('category', 'AI')
            ->assertJsonPath('source', 'brand')
            ->assertJsonPath('classification_source', 'brand')
            ->assertJsonPath('risk_score', 50);

        $this->assertSame('AI', DomainPolicy::where('domain', 'chatgpt.com')->value('category'));
    }
}
