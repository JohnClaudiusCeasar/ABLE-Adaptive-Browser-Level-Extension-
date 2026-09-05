<?php

namespace App\Jobs;

use App\Models\LoginActivity;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class LogLoginActivity implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * @param  array<string, mixed>|null  $metadata
     */
    public function __construct(
        public string $email,
        public string $type,
        public string $ipAddress,
        public ?string $userAgent = null,
        public ?int $userId = null,
        public ?array $metadata = null,
    ) {}

    public function handle(): void
    {
        LoginActivity::create([
            'user_id' => $this->userId,
            'email' => $this->email,
            'ip_address' => $this->ipAddress,
            'user_agent' => $this->userAgent,
            'type' => $this->type,
            'metadata' => $this->metadata,
            'created_at' => now(),
        ]);
    }
}
