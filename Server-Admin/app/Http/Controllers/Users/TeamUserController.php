<?php

namespace App\Http\Controllers\Users;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamUserController extends Controller
{
    /**
     * Display a listing of registered server website team members.
     */
    public function index(): Response
    {
        $team = User::orderBy('id')
            ->get()
            ->map(function (User $user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'is_blocked' => (bool) $user->is_blocked,
                    'created_at' => $user->created_at?->toIso8601String(),
                    'email_verified_at' => $user->email_verified_at?->toIso8601String(),
                    'two_factor_enabled' => (bool) $user->two_factor_confirmed_at,
                ];
            });

        return Inertia::render('users/team', [
            'team' => $team,
        ]);
    }

    /**
     * Display the expanded profile page for a team member.
     */
    public function show(Request $request, User $user): Response
    {
        $currentUser = $request->user();

        return Inertia::render('users/team-show', [
            'member' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'is_blocked' => (bool) $user->is_blocked,
                'created_at' => $user->created_at?->toIso8601String(),
                'email_verified_at' => $user->email_verified_at?->toIso8601String(),
                'two_factor_enabled' => (bool) $user->two_factor_confirmed_at,
            ],
            'roleOptions' => array_map(fn (UserRole $role) => [
                'value' => $role->value,
                'label' => $role->label(),
                'description' => $role->description(),
                'modules' => $role->modules(),
            ], UserRole::cases()),
            'canManage' => UserRole::fromValue($currentUser?->role) === UserRole::SuperAdmin,
        ]);
    }

    /**
     * Update the specified team member's details.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'role' => ['required', Rule::enum(UserRole::class)],
        ]);

        $newRole = UserRole::from($validated['role']);

        if ($request->user()?->id === $user->id && $newRole !== UserRole::fromValue($user->role)) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => __('You cannot change your own role.'),
            ]);

            return back();
        }

        if ($this->isLastSuperAdmin($user) && $newRole !== UserRole::SuperAdmin) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => __('The last Super Admin cannot be demoted.'),
            ]);

            return back();
        }

        $user->update($validated);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Team member updated successfully.'),
        ]);

        return back();
    }

    /**
     * Toggle the block/unblock status of a team member.
     */
    public function toggleBlock(Request $request, User $user): RedirectResponse
    {
        // Prevent user from blocking their own account
        if ($request->user()?->id === $user->id) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => __('You cannot block your own account.'),
            ]);

            return back();
        }

        if (! $user->is_blocked && $this->isLastSuperAdmin($user)) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => __('The last Super Admin cannot be blocked.'),
            ]);

            return back();
        }

        $user->update([
            'is_blocked' => ! $user->is_blocked,
        ]);

        $statusMessage = $user->is_blocked
            ? __('User :name has been blocked.', ['name' => $user->name])
            : __('User :name has been unblocked.', ['name' => $user->name]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $statusMessage,
        ]);

        return back();
    }

    /**
     * True when the user is the only remaining Super Admin.
     */
    private function isLastSuperAdmin(User $user): bool
    {
        return $user->role === UserRole::SuperAdmin->value
            && User::where('role', UserRole::SuperAdmin->value)
                ->where('is_blocked', false)
                ->count() <= 1;
    }
}
