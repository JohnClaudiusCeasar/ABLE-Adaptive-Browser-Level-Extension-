<?php

namespace App\Support;

/**
 * HMAC-signed scan verdict tokens.
 *
 * Issued by RiskScoringController alongside the signed verdict envelope and
 * replayed back by the extension on /api/log-egress, so the logged score and
 * flagged items are always the server-computed ones — never client-supplied.
 *
 * Token format: JSON string of the standard signed envelope
 *   { payload: <claims>, signature: <hex HMAC-SHA256>, key_version: <int> }
 * verified byte-identically via JsCanonical (same scheme the extension's
 * verifySignedCache uses).
 */
class ScanToken
{
    /**
     * @param  array<string, mixed>  $claims
     */
    public static function issue(array $claims): string
    {
        $key = self::key();

        return (string) json_encode([
            'payload' => $claims,
            'signature' => JsCanonical::sign($claims, $key),
            'key_version' => (int) config('able.signing_key_version', 1),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Verify a scan token and return its claims, or null when the token is
     * missing, malformed, tampered with, or expired.
     *
     * @return array<string, mixed>|null
     */
    public static function verify(?string $token): ?array
    {
        if (! is_string($token) || $token === '') {
            return null;
        }

        $envelope = json_decode($token, true);
        if (! is_array($envelope)) {
            return null;
        }

        $payload = $envelope['payload'] ?? null;
        $signature = $envelope['signature'] ?? null;
        $keyVersion = $envelope['key_version'] ?? null;

        if (! is_array($payload) || ! is_string($signature)) {
            return null;
        }
        if ($keyVersion !== (int) config('able.signing_key_version', 1)) {
            return null;
        }

        $expected = JsCanonical::sign($payload, self::key());
        if (! hash_equals($expected, $signature)) {
            return null;
        }

        if (($payload['exp'] ?? 0) < now()->timestamp) {
            return null;
        }

        return $payload;
    }

    private static function key(): string
    {
        $key = config('able.signing_key');
        if (! $key || strlen($key) < 32) {
            abort(500, 'ABLE signing key not configured');
        }

        return $key;
    }
}
