<?php

namespace App\Services\RiskScoring;

use App\Support\JsRegex;

/**
 * ReDoS-safe, chunked PCRE matcher with JS-regex normalization.
 */
class SafeRegexMatcher
{
    private const MAX_PATTERN_LENGTH = 500;

    private const MAX_TEXT_SLICE = 10000;

    private const RE_DANGEROUS_PATTERN = '~(\(\s*[^)]*[+*][^)]*\)\s*[+*{])|(\[\s*[^]]*\]\s*[+*]\s*[+*])~';

    public function isPatternSafe(?string $pattern): bool
    {
        if (! is_string($pattern) || $pattern === '') {
            return true;
        }
        if (mb_strlen($pattern, 'UTF-8') > self::MAX_PATTERN_LENGTH) {
            return false;
        }

        return ! preg_match(self::RE_DANGEROUS_PATTERN, $pattern);
    }

    /**
     * Count non-overlapping matches of a pattern in text. Returns 0 for
     * unsafe/invalid patterns (parity with safeTestPattern in the JS engine).
     *
     * @param  list<array{label: string, reason: string}>|null  $suppressed
     */
    public function safeTestPattern(?string $pattern, string $text, ?array &$suppressed = null): int
    {
        if (! is_string($pattern) || $pattern === '') {
            return 0;
        }
        if (! $this->isPatternSafe($pattern)) {
            if ($suppressed !== null) {
                $suppressed[] = ['label' => mb_substr($pattern, 0, 60), 'reason' => 'redos_guard'];
            }

            return 0;
        }
        $delimited = $this->compile($pattern);
        if ($delimited === null) {
            if ($suppressed !== null) {
                $suppressed[] = ['label' => mb_substr($pattern, 0, 60), 'reason' => 'compile_failed'];
            }

            return 0;
        }

        // Chunked matching to avoid ReDoS on large texts (parity with the JS engine)
        $length = mb_strlen($text, 'UTF-8');
        if ($length > self::MAX_TEXT_SLICE) {
            $count = 0;
            for ($i = 0; $i < $length; $i += self::MAX_TEXT_SLICE) {
                $slice = mb_substr($text, $i, self::MAX_TEXT_SLICE, 'UTF-8');
                $count += $this->matchCount($delimited, $slice);
            }

            return $count;
        }

        return $this->matchCount($delimited, $text);
    }

    /**
     * Compile a JS-flavored pattern to a delimited PCRE expression.
     * Returns null on compile failure (treated as 0 hits by the scoring loop).
     */
    public function compile(string $pattern): ?string
    {
        return JsRegex::compile($pattern);
    }

    /**
     * @return array{index: int, value: string}|null
     */
    public function firstHit(string $delimited, string $text): ?array
    {
        $matches = [];
        set_error_handler(static fn (): bool => true);
        try {
            $count = @preg_match($delimited, $text, $matches, PREG_OFFSET_CAPTURE);
        } finally {
            restore_error_handler();
        }
        if ($count !== 1 || ! isset($matches[0])) {
            return null;
        }

        return [
            'index' => mb_strlen(substr($text, 0, (int) $matches[0][1]), 'UTF-8'),
            'value' => (string) $matches[0][0],
        ];
    }

    /**
     * @return int Match count (0 when the regex errors, e.g. invalid UTF-8 subject)
     */
    public function matchCount(string $delimited, string $text): int
    {
        set_error_handler(static fn (): bool => true);
        try {
            $count = @preg_match_all($delimited, $text);
        } finally {
            restore_error_handler();
        }

        return $count === false ? 0 : $count;
    }

    /**
     * @return list<array{index: int, value: string}>
     */
    public function matchHits(string $delimited, string $text): array
    {
        $matches = [];
        set_error_handler(static fn (): bool => true);
        try {
            $count = @preg_match_all($delimited, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        } finally {
            restore_error_handler();
        }
        if ($count === false || $count === 0) {
            return [];
        }

        $hits = [];

        // preg_match_all reports byte offsets in ascending order, so the
        // character offset can be advanced incrementally.
        $consumedBytes = 0;
        $charOffset = 0;

        foreach ($matches as $m) {
            $value = (string) $m[0][0];
            $offsetBytes = (int) $m[0][1];

            if ($offsetBytes > $consumedBytes) {
                $charOffset += mb_strlen(
                    substr($text, $consumedBytes, $offsetBytes - $consumedBytes),
                    'UTF-8'
                );
                $consumedBytes = $offsetBytes;
            }

            $hits[] = [
                'index' => $charOffset,
                'value' => $value,
            ];
        }

        return $hits;
    }
}
