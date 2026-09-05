<?php

namespace App\Http\Controllers;

use App\Services\AbleSettingsService;
use App\Support\JsCanonical;
use Illuminate\Http\JsonResponse;

class ExtensionConfigController extends Controller
{
    public function __construct(private AbleSettingsService $settings) {}

    /**
     * Return the extension runtime settings wrapped in an HMAC-signed envelope.
     *
     * The payload intentionally excludes the signing secret and all server
     * group keys, so an unauthenticated reader cannot learn anything sensitive.
     */
    public function signed(): JsonResponse
    {
        $payload = [
            'settings' => $this->settings->runtimePayload(),
            'issued_at' => now()->timestamp,
        ];

        $key = config('able.signing_key');
        if (! $key || strlen($key) < 32) {
            abort(500, 'ABLE signing key not configured');
        }

        return response()->json([
            'payload' => $payload,
            'signature' => JsCanonical::sign($payload, $key),
            'key_version' => (int) config('able.signing_key_version', 1),
        ]);
    }
}
