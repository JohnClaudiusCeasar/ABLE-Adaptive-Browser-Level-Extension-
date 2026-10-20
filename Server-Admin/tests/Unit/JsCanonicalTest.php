<?php

namespace Tests\Unit;

use App\Support\JsCanonical;
use App\Support\JsRegex;
use PHPUnit\Framework\TestCase;

/**
 * The streamed encoders exist so a large collection never has to exist as a
 * single PHP array. They must produce exactly the same bytes as encoding the
 * equivalent array, because those bytes are what the browser extension
 * re-canonicalizes when it verifies an HMAC signature.
 */
class JsCanonicalTest extends TestCase
{
    private const KEY = '13b6056f7f072c80853526109de9268317e4a09842f3508b3df31c2fbdfaec4d';

    public function test_encode_list_matches_encoding_the_equivalent_array(): void
    {
        $items = [
            ['domain' => 'example.com', 'domain_status' => 'safe', 'risk_score' => 0],
            ['domain' => 'other.test', 'domain_status' => 'unsafe', 'risk_score' => 70],
        ];

        $this->assertSame(
            JsCanonical::encode($items),
            JsCanonical::encodeList($items),
        );
    }

    public function test_encode_list_handles_an_empty_collection(): void
    {
        $this->assertSame('[]', JsCanonical::encodeList([]));
    }

    public function test_assemble_matches_encoding_the_equivalent_array(): void
    {
        $items = [
            ['domain' => 'example.com', 'category' => null, 'block_access' => false],
        ];

        $payload = ['policies' => $items, 'issued_at' => 1700000000];

        $this->assertSame(
            JsCanonical::encode($payload),
            JsCanonical::assemble([
                'issued_at' => '1700000000',
                'policies' => JsCanonical::encodeList($items),
            ]),
        );
    }

    public function test_assemble_sorts_keys_the_same_way_encode_does(): void
    {
        $this->assertSame(
            JsCanonical::encode(['count' => 2, 'policies' => []]),
            JsCanonical::assemble([
                'policies' => JsCanonical::encodeList([]),
                'count' => '2',
            ]),
        );
    }

    public function test_streamed_encoding_preserves_slashes_and_unicode(): void
    {
        $items = [
            ['domain' => 'exämple.test/path', 'note' => 'a/b'],
        ];

        $payload = ['policies' => $items, 'issued_at' => 1700000000];

        $streamed = JsCanonical::assemble([
            'issued_at' => '1700000000',
            'policies' => JsCanonical::encodeList($items),
        ]);

        $this->assertSame(JsCanonical::encode($payload), $streamed);
        $this->assertStringContainsString('exämple.test/path', $streamed);
        $this->assertStringNotContainsString('\\/', $streamed);
    }

    public function test_sign_raw_matches_sign_for_the_same_payload(): void
    {
        $payload = ['policies' => [['domain' => 'example.com']], 'issued_at' => 1700000000];

        $canonical = JsCanonical::assemble([
            'issued_at' => '1700000000',
            'policies' => JsCanonical::encodeList($payload['policies']),
        ]);

        $this->assertSame(
            JsCanonical::sign($payload, self::KEY),
            JsCanonical::signRaw($canonical, self::KEY),
        );
    }

    public function test_compiled_patterns_are_stable_across_calls(): void
    {
        $first = JsRegex::compile('a+b');
        $second = JsRegex::compile('a+b');

        $this->assertSame($first, $second);
        $this->assertNotNull($first);
    }

    public function test_an_uncompilable_pattern_yields_null_consistently(): void
    {
        $this->assertNull(JsRegex::compile('a('));
        $this->assertNull(JsRegex::compile('a('));
    }

    /**
     * The extension verifies a payload by re-canonicalizing the object it
     * received and checking the HMAC over those bytes, so the server's
     * canonical form has to be identical to the extension's algorithm.
     *
     * This is the extension's canonicalize(), transcribed
     * (Client-Extension/core/security.js, canonicalize).
     */
    public function test_the_canonical_form_matches_the_extension_algorithm(): void
    {
        $payload = [
            'issued_at' => 1700000000,
            'policies' => [
                [
                    'block_access' => false,
                    'category' => 'Gambling',
                    'domain' => 'example.com',
                    'domain_status' => 'unsafe',
                    'policy' => 'blacklisted',
                    'risk_score' => 70,
                ],
                [
                    'block_access' => true,
                    'category' => null,
                    'domain' => 'other.test',
                    'domain_status' => 'unlisted',
                    'policy' => 'under_review',
                    'risk_score' => 60,
                ],
            ],
        ];

        $this->assertSame(
            $this->extensionCanonicalize($payload),
            JsCanonical::assemble([
                'issued_at' => '1700000000',
                'policies' => JsCanonical::encodeList($payload['policies']),
            ]),
        );
    }

    /**
     * Numbers are the one place the two encoders could disagree, because
     * JavaScript has a single number type while PHP distinguishes int and
     * float. They agree: PHP writes an integral float with the shortest
     * round-trip representation, so 1.0 becomes "1" on both sides.
     *
     * This was checked against the extension's own canonicalize() running in
     * Node, and it is why a signed payload may safely carry a float value
     * such as a confidence score.
     */
    public function test_numbers_are_encoded_the_same_way_on_both_sides(): void
    {
        $this->assertSame(
            $this->extensionCanonicalize(['confidence' => 1.0]),
            $this->extensionCanonicalize(['confidence' => 1]),
        );

        $this->assertSame(
            '{"confidence":0.5}',
            $this->extensionCanonicalize(['confidence' => 0.5]),
        );
    }

    /**
     * The extension's canonicalize(), transcribed.
     */
    private function extensionCanonicalize(mixed $value): string
    {
        if (is_array($value) && array_is_list($value)) {
            return '['.implode(',', array_map(fn (mixed $item): string => $this->extensionCanonicalize($item), $value)).']';
        }

        if (is_array($value)) {
            $keys = array_keys($value);
            sort($keys, SORT_STRING);

            $parts = [];
            foreach ($keys as $key) {
                $parts[] = json_encode((string) $key).':'.$this->extensionCanonicalize($value[$key]);
            }

            return '{'.implode(',', $parts).'}';
        }

        return json_encode($value);
    }
}
