<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ActiveSessionService
{
    /**
     * Cache key prefix for tracking active sessions.
     */
    private const string ACTIVE_SESSION_PREFIX = 'active_admin_session:';

    /**
     * Cache key prefix for break-glass tokens.
     */
    private const string BREAK_GLASS_PREFIX = 'break_glass:';

    /**
     * Cache key prefix for termination grace windows (e.g. page reload).
     */
    private const string TERMINATION_PENDING_PREFIX = 'terminate_pending:';

    /**
     * Active threshold in seconds (session considered active if heartbeat received within this window).
     */
    public const int ACTIVE_THRESHOLD_SECONDS = 60;

    /**
     * Record or refresh activity for the user's active session.
     */
    public function recordActivity(int $userId, string $sessionId, string $ipAddress, ?string $userAgent = null): void
    {
        // Cancel any pending termination (e.g. from page reload)
        $this->cancelPendingTermination($userId);

        Cache::put(
            self::ACTIVE_SESSION_PREFIX.$userId,
            [
                'session_id' => $sessionId,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'last_active_at' => now()->timestamp,
            ],
            now()->addSeconds(self::ACTIVE_THRESHOLD_SECONDS + 15)
        );
    }

    /**
     * Determine if the user is actively operating on a different session/device.
     */
    public function isActivelyOperating(int $userId, ?string $currentSessionId = null): bool
    {
        $cached = Cache::get(self::ACTIVE_SESSION_PREFIX.$userId);

        if (! is_array($cached)) {
            return false;
        }

        // Check if a pending termination has passed its grace window
        $pendingTermination = Cache::get(self::TERMINATION_PENDING_PREFIX.$userId);
        if ($pendingTermination !== null && (now()->timestamp - $pendingTermination) >= 5) {
            $this->terminateSession($userId);

            return false;
        }

        // If the active session is the current one, it is not a conflict
        if ($currentSessionId !== null && isset($cached['session_id']) && $cached['session_id'] === $currentSessionId) {
            return false;
        }

        // Check if the last activity was within the active threshold
        $lastActiveAt = $cached['last_active_at'] ?? 0;

        return (now()->timestamp - $lastActiveAt) <= self::ACTIVE_THRESHOLD_SECONDS;
    }

    /**
     * Terminate the active session for the given user.
     */
    public function terminateSession(int $userId, ?string $exceptSessionId = null): void
    {
        Cache::forget(self::ACTIVE_SESSION_PREFIX.$userId);
        Cache::forget(self::TERMINATION_PENDING_PREFIX.$userId);

        // If database sessions are used, purge old sessions
        if (config('session.driver') === 'database' || Schema::hasTable('sessions')) {
            $query = DB::table('sessions')->where('user_id', $userId);
            if ($exceptSessionId !== null) {
                $query->where('id', '!=', $exceptSessionId);
            }
            $query->delete();
        }
    }

    /**
     * Mark an active session for pending termination with a grace period (handles tab close vs reload).
     */
    public function markPendingTermination(int $userId, string $sessionId): void
    {
        $cached = Cache::get(self::ACTIVE_SESSION_PREFIX.$userId);
        if (is_array($cached) && ($cached['session_id'] ?? null) === $sessionId) {
            Cache::put(self::TERMINATION_PENDING_PREFIX.$userId, now()->timestamp, now()->addSeconds(15));
        }
    }

    /**
     * Cancel any pending termination for the user.
     */
    public function cancelPendingTermination(int $userId): void
    {
        Cache::forget(self::TERMINATION_PENDING_PREFIX.$userId);
    }

    /**
     * Create a secure single-use break-glass token for password confirmation.
     */
    public function createBreakGlassToken(int $userId): string
    {
        $token = Str::random(48);
        Cache::put(self::BREAK_GLASS_PREFIX.$token, $userId, now()->addMinutes(3));

        return $token;
    }

    /**
     * Verify and consume a break-glass token, returning the user ID if valid.
     */
    public function consumeBreakGlassToken(string $token): ?int
    {
        $key = self::BREAK_GLASS_PREFIX.$token;
        $userId = Cache::pull($key);

        return $userId !== null ? (int) $userId : null;
    }
}
