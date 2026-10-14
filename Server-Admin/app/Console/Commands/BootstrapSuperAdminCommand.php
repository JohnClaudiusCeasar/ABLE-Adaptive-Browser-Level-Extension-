<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class BootstrapSuperAdminCommand extends Command
{
    protected $signature = 'app:bootstrap-superadmin
        {--email= : Override the full email address}';

    protected $description = 'Ensure a Super Admin account exists so the Team module can never deadlock';

    public function handle(): int
    {
        $email = strtolower(trim((string) ($this->option('email') ?: $this->resolveEmail())));

        // Use the same rule login applies, so anything this accepts can
        // actually sign in. filter_var() is stricter and rejects @localhost.
        $invalid = Validator::make(['email' => $email], ['email' => 'email'])->fails();

        if ($invalid) {
            $this->error("Not a valid email address: {$email}");

            return self::FAILURE;
        }

        $user = User::firstOrNew(['email' => $email]);
        $dirty = false;

        $configured = config('able.bootstrap_superadmin_password');
        $configured = is_string($configured) && $configured !== '' ? $configured : null;

        if (! $user->exists) {
            $user->name = (string) config('able.bootstrap_superadmin_name');
            // Never fall back to a value stored in this repository: without a
            // configured password the account is inert until one is set.
            $user->password = $configured ?? Str::password(32);
            $dirty = true;

            if ($configured === null) {
                $this->warn('BOOTSTRAP_SUPERADMIN_PASSWORD is not set, so this account was created');
                $this->warn('with a random password and cannot be signed into yet. Set the variable');
                $this->warn('in the environment and re-run this command to activate it.');
            }
        } elseif ($configured !== null && ! Hash::check($configured, (string) $user->password)) {
            // The environment is the source of truth for this account, so a
            // lost or rotated password is recovered by changing the variable.
            $user->password = $configured;
            $dirty = true;
        }

        if ($user->role !== UserRole::SuperAdmin->value) {
            $user->role = UserRole::SuperAdmin->value;
            $dirty = true;
        }

        if ($user->is_blocked) {
            $user->is_blocked = false;
            $dirty = true;
        }

        if ($user->email_verified_at === null) {
            $user->email_verified_at = now();
            $dirty = true;
        }

        if ($dirty) {
            $user->save();
        }

        $this->info("Super Admin ready: {$email}");

        return self::SUCCESS;
    }

    /**
     * Build the address from the fixed local part plus the host of APP_URL,
     * so it matches whichever site the app is deployed on.
     */
    private function resolveEmail(): string
    {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'localhost';
        $localPart = trim((string) config('able.bootstrap_superadmin_local_part'));

        return "{$localPart}@{$host}";
    }
}
