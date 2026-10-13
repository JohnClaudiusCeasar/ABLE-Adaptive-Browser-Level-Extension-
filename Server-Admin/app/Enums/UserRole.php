<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'superadmin';
    case Admin = 'admin';

    /**
     * All module slugs used for page-level access control.
     */
    public const array MODULES = [
        'dashboard',
        'analytics',
        'policy',
        'clients',
        'team',
        'chat',
        'feedback',
        'settings',
    ];

    /**
     * Human-readable label for UI display.
     */
    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::Admin => 'Admin',
        };
    }

    /**
     * Short description of what this role is for.
     */
    public function description(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Full access, including team management and server settings.',
            self::Admin => 'Access to analytics, policy, clients, chat, and feedback moderation.',
        };
    }

    /**
     * Module slugs this role may access.
     *
     * @return array<int, string>
     */
    public function modules(): array
    {
        return match ($this) {
            self::SuperAdmin => self::MODULES,
            self::Admin => array_values(array_diff(self::MODULES, ['team', 'settings'])),
        };
    }

    public function canAccess(string $module): bool
    {
        return in_array($module, $this->modules(), true);
    }

    /**
     * Resolve a stored role value to an enum, defaulting to Admin.
     */
    public static function fromValue(?string $value): self
    {
        return self::tryFrom($value ?? '') ?? self::Admin;
    }
}
