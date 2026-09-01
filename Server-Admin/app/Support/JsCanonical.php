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
     * Encode a value into the canonical byte form used for signing.
     *
     * @param  mixed  $value
     */
    public static function encode(mixed $value): string
    {
        return json_encode(
            self::sortKeys($value),
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
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
        $rawKey = self::hexToRawKey($keyHex);
        return hash_hmac('sha256', self::encode($payload), $rawKey);
    }

    /**
     * Decode a 64-char hex string to 32 raw bytes. Throws on malformed input.
     */
    private static function hexToRawKey(string $hex): string
    {
        if (!preg_match('/^[0-9a-fA-F]{64}$/', $hex)) {
            throw new \InvalidArgumentException('Signing key must be 64 hex chars (32 raw bytes).');
        }
        return hex2bin($hex);
    }

    /**
     * Recursively sort array keys. Scalar values pass through untouched.
     *
     * @param  mixed  $value
     * @return mixed
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