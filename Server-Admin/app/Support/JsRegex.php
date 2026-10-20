<?php

namespace App\Support;

/**
 * Compiles JS-flavored regex sources (as entered in the admin panel and
 * transcribed from the regex guide) into PCRE expressions for the scoring
 * engine and the save-time validation rule.
 *
 *  - Normalizes \uXXXX escapes to \x{XXXX} so guide transcriptions
 *    (e.g. dean['\u2019]?s\s*list) compile unchanged in PCRE UTF-8 mode.
 *  - Applies the engine's match flags:
 *      i — user patterns are case-insensitive (F-04 fix): guide examples like
 *          "General Weighted Average: 2.25" must match their own patterns.
 *      u — UTF-8 mode so \x{XXXX} escapes and multibyte text behave per
 *          character.
 */
class JsRegex
{
    /**
     * Memoized compile results, keyed by flags + raw pattern.
     *
     * Compiling a pattern normalizes its escapes and then validates it with a
     * throwaway preg_match. The scoring engine compiles the same handful of
     * patterns many times per request — once per pattern, per text segment,
     * per matched hit — so without this the validation cost is paid
     * repeatedly for an identical result.
     *
     * The map is bounded by the number of distinct patterns in the database
     * plus whatever is compiled ad hoc, so it stays small.
     *
     * @var array<string, string|null>
     */
    private static array $compiled = [];

    public static function normalizeEscapes(string $pattern): string
    {
        return (string) preg_replace_callback(
            '/\\\\u([0-9a-fA-F]{4})/',
            static fn (array $m): string => '\\x{'.strtoupper($m[1]).'}',
            $pattern
        );
    }

    /**
     * Compile a pattern to a delimited PCRE expression, or null when it is
     * not compilable (treated as 0 hits by the scoring engine).
     */
    public static function compile(string $pattern, string $flags = 'iu'): ?string
    {
        $key = $flags."\0".$pattern;

        if (array_key_exists($key, self::$compiled)) {
            return self::$compiled[$key];
        }

        $delimited = '~'.addcslashes(self::normalizeEscapes($pattern), '~').'~'.$flags;

        set_error_handler(static fn (): bool => true);
        try {
            $ok = @preg_match($delimited, '') !== false;
        } finally {
            restore_error_handler();
        }

        return self::$compiled[$key] = $ok ? $delimited : null;
    }
}
