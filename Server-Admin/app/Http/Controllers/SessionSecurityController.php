<?php

namespace App\Http\Controllers;

use App\Http\Middleware\EnforceInactivityTimeout;
use App\Models\User;
use App\Services\ActiveSessionService;
use App\Services\LoginAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class SessionSecurityController extends Controller
{
    public function __construct(
        private readonly ActiveSessionService $activeSessionService,
        private readonly LoginAuditService $loginAuditService,
    ) {}

    /**
     * Handle break-glass password confirmation when an active session conflict is detected.
     */
    public function breakGlass(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'token' => ['nullable', 'string'],
        ]);

        /** @var User|null $user */
        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password) || $user->is_blocked) {
            return back()->withErrors([
                'break_glass_password' => __('Incorrect password. Please verify and try again.'),
            ]);
        }

        // Consume token if provided
        if (! empty($validated['token'])) {
            $this->activeSessionService->consumeBreakGlassToken($validated['token']);
        }

        // Terminate any previous active session
        $this->activeSessionService->terminateSession($user->id);

        // Authenticate the current session
        Auth::guard('web')->login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        // Record initial activity
        $this->activeSessionService->recordActivity(
            $user->id,
            $request->session()->getId(),
            $request->ip() ?? 'unknown',
            $request->userAgent()
        );

        $request->session()->put('able_last_activity_time', now()->timestamp);
        $request->session()->forget(['active_conflict_required', 'active_conflict_email', 'break_glass_token']);

        // Flag security recommendation for modal in dashboard
        $request->session()->put('recommend_password_change', true);

        // Audit log
        $this->loginAuditService->log(
            email: $user->email,
            type: 'break_glass_takeover',
            ipAddress: $request->ip() ?? 'unknown',
            userAgent: $request->userAgent(),
            userId: $user->id,
        );

        return redirect()->intended(route('dashboard'));
    }

    /**
     * Refresh active session presence and record user activity.
     */
    public function heartbeat(Request $request): JsonResponse
    {
        if (! Auth::check()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        /** @var User $user */
        $user = Auth::user();
        $this->activeSessionService->recordActivity(
            $user->id,
            $request->session()->getId(),
            $request->ip() ?? 'unknown',
            $request->userAgent()
        );

        $request->session()->put('able_last_activity_time', now()->getTimestamp());

        return response()->json([
            'status' => 'ok',
            'active_until' => now()->getTimestamp() + EnforceInactivityTimeout::INACTIVITY_TIMEOUT_SECONDS,
        ]);
    }

    /**
     * Handle window/tab close termination beacon.
     */
    public function terminateBeacon(Request $request): Response
    {
        if (Auth::check()) {
            /** @var User $user */
            $user = Auth::user();
            $this->activeSessionService->markPendingTermination($user->id, $request->session()->getId());
        }

        return response()->noContent();
    }

    /**
     * Dismiss the post-break-glass password change recommendation.
     */
    public function dismissRecommendation(Request $request): JsonResponse
    {
        $request->session()->forget('recommend_password_change');

        return response()->json(['status' => 'dismissed']);
    }
}
