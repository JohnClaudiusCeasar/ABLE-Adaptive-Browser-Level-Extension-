<?php

namespace App\Listeners;

use App\Models\User;
use App\Services\LoginAuditService;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;

class LoginActivityListener
{
    public function __construct(
        private readonly LoginAuditService $auditService,
    ) {}

    public function handleLogin(Login $event): void
    {
        /** @var User $user */
        $user = $event->user;

        $this->auditService->log(
            email: $user->email,
            type: $event->guard === 'web' ? 'success' : "success_{$event->guard}",
            ipAddress: request()->ip() ?? 'unknown',
            userAgent: request()->userAgent(),
            userId: $user->id,
        );
    }

    public function handleFailed(Failed $event): void
    {
        /** @var User|null $user */
        $user = $event->user;

        $this->auditService->log(
            email: $event->credentials['email'] ?? 'unknown',
            type: 'failed',
            ipAddress: request()->ip() ?? 'unknown',
            userAgent: request()->userAgent(),
            userId: $user?->id,
        );
    }

    public function handleLogout(Logout $event): void
    {
        /** @var User|null $user */
        $user = $event->user;

        if ($user) {
            app(\App\Services\ActiveSessionService::class)->terminateSession($user->id);

            $this->auditService->log(
                email: $user->email,
                type: 'logout',
                ipAddress: request()->ip() ?? 'unknown',
                userAgent: request()->userAgent(),
                userId: $user->id,
            );
        }
    }
}
