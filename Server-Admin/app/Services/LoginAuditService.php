<?php

namespace App\Services;

use App\Jobs\LogLoginActivity;

class LoginAuditService
{
    /**
     * Log a login activity asynchronously.
     *
     * @param  array<string, mixed>|null  $metadata
     */
    public function log(
        string $email,
        string $type,
        string $ipAddress,
        ?string $userAgent = null,
        ?int $userId = null,
        ?array $metadata = null,
    ): void {
        LogLoginActivity::dispatch(
            email: $email,
            type: $type,
            ipAddress: $ipAddress,
            userAgent: $userAgent,
            userId: $userId,
            metadata: $metadata,
        );
    }
}
