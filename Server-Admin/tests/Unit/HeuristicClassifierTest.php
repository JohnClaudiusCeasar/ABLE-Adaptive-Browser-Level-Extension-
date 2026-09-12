<?php

namespace Tests\Unit;

use App\Support\HeuristicClassifier;
use App\Support\Ut1CategoryMapper;
use PHPUnit\Framework\TestCase;

class HeuristicClassifierTest extends TestCase
{
    public function test_finance_signals_classify_as_finance(): void
    {
        $result = HeuristicClassifier::classify('mybank.example', [
            'url' => 'https://mybank.example/login',
            'title' => 'Online Banking',
            'meta' => [],
            'headings' => [],
            'excerpt' => 'Check your loan and mortgage account balance.',
        ]);

        $this->assertSame('Finance', $result['category']);
        $this->assertGreaterThanOrEqual(0.3, $result['confidence']);
    }

    public function test_null_signals_return_null_or_tld_fallback(): void
    {
        $this->assertNull(HeuristicClassifier::classify('random-xyz-123.com', null));
    }

    public function test_edu_tld_falls_back_to_education(): void
    {
        $result = HeuristicClassifier::classify('stanford.edu', []);

        $this->assertSame('Education', $result['category']);
        $this->assertSame('whitelisted', $result['policy']);
    }

    public function test_jsonld_video_object_classifies_streaming(): void
    {
        $result = HeuristicClassifier::classify('clips.example', [
            'url' => 'https://clips.example/watch/abc',
            'title' => 'Watch',
            'meta' => ['og:type' => 'video.other'],
            'ldJson' => ['{"@type":"VideoObject","name":"clip"}'],
            'urlTokens' => ['hostParts' => ['clips', 'example'], 'pathSegs' => ['watch', 'abc']],
            'excerpt' => 'lorem ipsum dolor sit amet',
        ]);

        $this->assertSame('Streaming', $result['category']);
    }

    public function test_url_path_tokens_classify_ecommerce(): void
    {
        $result = HeuristicClassifier::classify('shop-obscure.example', [
            'url' => 'https://shop-obscure.example/products/item-1',
            'title' => 'Item 1',
            'meta' => [],
            'urlTokens' => ['hostParts' => ['shop-obscure', 'example'], 'pathSegs' => ['products', 'item-1']],
            'excerpt' => 'lorem ipsum',
        ]);

        $this->assertSame('E-commerce', $result['category']);
    }

    public function test_password_form_with_mail_anchors_classifies_email(): void
    {
        $result = HeuristicClassifier::classify('webmail-obscure.example', [
            'url' => 'https://webmail-obscure.example/',
            'title' => 'Sign in',
            'forms' => ['hasPassword' => true],
            'anchors' => ['topText' => [['text' => 'inbox', 'count' => 4]]],
            'excerpt' => 'sign in to continue',
        ]);

        $this->assertSame('Email', $result['category']);
    }

    public function test_ut1_mapper_maps_known_categories(): void
    {
        $this->assertSame('Adult', Ut1CategoryMapper::map('adult')['category']);
        $this->assertSame('blacklisted', Ut1CategoryMapper::map('gambling')['policy']);
        $this->assertNull(Ut1CategoryMapper::map('does-not-exist'));
    }

    public function test_brand_entries_cover_mainstream_domains(): void
    {
        /** @var array<string, string> $brands */
        $brands = require __DIR__.'/../../config/domain_brands.php';

        $this->assertSame('Streaming', $brands['youtube.com']);
        $this->assertSame('Email', $brands['mail.google.com']);
        $this->assertSame('Developer Tools', $brands['github.com']);
        $this->assertGreaterThan(200, count($brands));
    }
}
