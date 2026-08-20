<?php

namespace App\Observers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditLogObserver
{
    public function created(Model $model): void
    {
        $this->record('created', $model, null, $model->getAttributes());
    }

    public function updated(Model $model): void
    {
        $this->record('updated', $model, $model->getOriginal(), $model->getChanges());
    }

    public function deleted(Model $model): void
    {
        $this->record('deleted', $model, $model->getOriginal(), null);
    }

    protected function record(string $action, Model $model, ?array $original, ?array $changes): void
    {
        $user = Auth::user();

        AuditLog::create([
            'auditable_type' => $model::class,
            'auditable_id' => $model->id,
            'action' => $action,
            'user_id' => $user?->id,
            'user_email' => $user?->email,
            'data_changes' => array_filter([
                'original' => $original,
                'changes' => $changes,
            ]),
            'occurred_at' => now(),
        ]);
    }
}
