<?php

namespace App\Listeners;

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
        $this->auditService->log(
            email: $event->credentials['email'] ?? 'unknown',
            type: 'failed',
            ipAddress: request()->ip() ?? 'unknown',
            userAgent: request()->userAgent(),
            userId: $event->user?->id,
        );
    }

    public function handleLogout(Logout $event): void
    {
        $user = $event->user;
        $this->auditService->log(
            email: $user->email,
            type: 'logout',
            ipAddress: request()->ip() ?? 'unknown',
            userAgent: request()->userAgent(),
            userId: $user->id,
        );
    }
}
