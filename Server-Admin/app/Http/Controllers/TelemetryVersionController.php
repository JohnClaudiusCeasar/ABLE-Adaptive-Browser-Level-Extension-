<?php

namespace App\Http\Controllers;

use App\Services\TelemetryVersion;
use Illuminate\Http\JsonResponse;

class TelemetryVersionController extends Controller
{
    /**
     * Report whether the telemetry the panel displays has moved.
     *
     * The panel polls this instead of the page itself: a page reload re-runs
     * the whole route controller, which is far more work than the two
     * aggregate queries behind this response.
     */
    public function show(TelemetryVersion $telemetry): JsonResponse
    {
        return response()->json([
            'telemetryLive' => $telemetry->payload(true),
        ])->header('Cache-Control', 'no-store');
    }
}
