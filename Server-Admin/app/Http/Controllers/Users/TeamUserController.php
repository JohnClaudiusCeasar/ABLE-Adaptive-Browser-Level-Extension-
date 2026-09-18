<?php

namespace App\Http\Controllers\Users;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
                    'role' => $user->role, // Nullable
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
     * Update the specified team member's details.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'role' => ['nullable', 'string', 'max:100'],
        ]);

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
}
