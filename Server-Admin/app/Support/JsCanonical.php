<?php

namespace App\Support;

/**
 * Produces a JSON byte sequence that is byte-identical to what
 * `security.js#canonicalize(payload)` produces in the browser extension.
 *
 * Both the server (signing) and the client (verifying) MUST use this
 * exact algorithm so an HMAC signature generated here is verifiable there.
 *
 * Rules:
 *   - object keys sorted lexicographically at every depth
 *   - no whitespace
 *   - slashes and unicode characters emitted verbatim (not escaped)
 *
 * Anything outside these rules (e.g. JSON_UNESCAPED_LINE_TERMINATORS) is
 * intentionally not used, so the byte stream stays portable between PHP
 * and JavaScript.
 */
class JsCanonical
{
    /**
     * Flags shared by every encoder in this class.
     */
    private const JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR;

    /**
     * Encode a value into the canonical byte form used for signing.
     */
    public static function encode(mixed $value): string
    {
        return json_encode(
            self::sortKeys($value),
            self::JSON_FLAGS
        );
    }

    /**
     * Encode a list into canonical JSON.
     *
     * Each member is encoded on its own, so a large collection never has to
     * exist as a single PHP array. The bytes are identical to encoding the
     * equivalent array: every member's keys are sorted and the list order is
     * preserved.
     *
     * @param  iterable<array<string, mixed>>  $items
     */
    public static function encodeList(iterable $items): string
    {
        $encoded = '';
        $first = true;

        foreach ($items as $item) {
            if (! $first) {
                $encoded .= ',';
            }

            $first = false;
            $encoded .= self::encode($item);
        }

        return '['.$encoded.']';
    }

    /**
     * Assemble an object from already-encoded JSON values.
     *
     * The keys are sorted the same way encode() sorts them, so the result is
     * byte-identical to encoding the equivalent array.
     *
     * @param  array<string, string>  $encoded  key => encoded JSON value
     */
    public static function assemble(array $encoded): string
    {
        ksort($encoded, SORT_STRING);

        $parts = [];
        foreach ($encoded as $key => $value) {
            $parts[] = json_encode((string) $key, self::JSON_FLAGS).':'.$value;
        }

        return '{'.implode(',', $parts).'}';
    }

    /**
     * Sign a payload and return the hex HMAC-SHA256 digest.
     *
     * The key is a hex string (64 chars = 32 raw bytes). It is decoded to
     * raw bytes here so it matches how the browser extension's
     * `crypto.subtle.importKey("raw", ..., "HMAC")` consumes it.
     */
    public static function sign(mixed $payload, string $keyHex): string
    {
        return self::signRaw(self::encode($payload), $keyHex);
    }

    /**
     * Sign an already-canonicalized JSON string.
     *
     * Used by the streamed encoders, which produce the canonical bytes
     * directly instead of building the payload array first.
     */
    public static function signRaw(string $canonicalJson, string $keyHex): string
    {
        return hash_hmac('sha256', $canonicalJson, self::hexToRawKey($keyHex));
    }

    /**
     * Decode a 64-char hex string to 32 raw bytes. Throws on malformed input.
     */
    private static function hexToRawKey(string $hex): string
    {
        if (! preg_match('/^[0-9a-fA-F]{64}$/', $hex)) {
            throw new \InvalidArgumentException('Signing key must be 64 hex chars (32 raw bytes).');
        }

        /** @var string $rawKey */
        $rawKey = hex2bin($hex);

        return $rawKey;
    }

    /**
     * Recursively sort array keys. Scalar values pass through untouched.
     */
    private static function sortKeys(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $isAssoc = array_keys($value) !== range(0, count($value) - 1);

        if ($isAssoc) {
            ksort($value, SORT_STRING);
        }

        foreach ($value as $k => $v) {
            $value[$k] = self::sortKeys($v);
        }

        return $value;
    }
}
