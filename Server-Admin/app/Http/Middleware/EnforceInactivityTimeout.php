<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\ActiveSessionService;
use App\Services\LoginAuditService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnforceInactivityTimeout
{
    /**
     * Maximum idle duration in seconds (40 minutes = 2400 seconds).
     */
    public const int INACTIVITY_TIMEOUT_SECONDS = 2400;

    public function __construct(
        private readonly ActiveSessionService $activeSessionService,
        private readonly LoginAuditService $loginAuditService,
    ) {}

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::check()) {
            /** @var User $user */
            $user = Auth::user();
            $now = now()->getTimestamp();
            $lastActivity = $request->session()->get('able_last_activity_time');

            // If last activity exists and has exceeded 40 minutes (2400 seconds)
            if ($lastActivity !== null && ($now - (int) $lastActivity) > self::INACTIVITY_TIMEOUT_SECONDS) {
                $this->loginAuditService->log(
                    email: $user->email,
                    type: 'inactivity_timeout',
                    ipAddress: $request->ip() ?? 'unknown',
                    userAgent: $request->userAgent(),
                    userId: $user->id,
                );

                $this->activeSessionService->terminateSession($user->id);

                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                if ($request->expectsJson() || $request->is('api/*')) {
                    return response()->json([
                        'message' => __('Your session has timed out due to 40 minutes of inactivity.'),
                        'timeout' => true,
                    ], 401);
                }

                return redirect()->route('login')->with('status', __('You were logged out due to 40 minutes of inactivity.'));
            }

            // Exclude termination beacon and telemetry probe requests from
            // resetting the activity timer. The beacon fires on page unload
            // and the probe polls every few seconds while a panel tab is
            // open; neither represents the operator doing anything, so
            // neither should keep an idle session alive.
            if (! $request->is('session/terminate-beacon', 'telemetry/*')) {
                $request->session()->put('able_last_activity_time', $now);
                $this->activeSessionService->recordActivity(
                    $user->id,
                    $request->session()->getId(),
                    $request->ip() ?? 'unknown',
                    $request->userAgent()
                );
            }
        }

        return $next($request);
    }
}
