<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Services\SyncNotifications;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    /**
     * Display the Notifications page with live data.
     */
    public function index(): Response
    {
        (new SyncNotifications)->sync();

        $notifications = Notification::orderByDesc('occurred_at')
            ->get()
            ->map(function (Notification $notification) {
                $unread = $notification->read_at === null;

                return [
                    'id' => $notification->id,
                    'source' => $notification->source,
                    'type' => $notification->type,
                    'description' => $notification->description,
                    'domain' => $notification->domain,
                    'user' => $notification->user_id,
                    'email' => $notification->email,
                    'ip' => $notification->ip_address,
                    'riskScore' => $notification->risk_score !== null
                        ? $notification->risk_score.'%'
                        : null,
                    'status' => $notification->status,
                    'message' => $notification->message,
                    'occurred_at' => $notification->occurred_at->toIso8601String(),
                    'unread' => $unread,
                ];
            });

        return Inertia::render('notifications', [
            'notifications' => $notifications,
            'unreadCount' => $notifications->where('unread', true)->count(),
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(Notification $notification): RedirectResponse
    {
        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return Redirect::back();
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(): RedirectResponse
    {
        Notification::query()->whereNull('read_at')->update(['read_at' => now()]);

        return Redirect::back();
    }

    /**
     * Remove a single notification.
     */
    public function destroy(Notification $notification): RedirectResponse
    {
        $notification->delete();

        return Redirect::back();
    }

    /**
     * Remove all notifications.
     */
    public function destroyAll(): RedirectResponse
    {
        Notification::query()->delete();

        return Redirect::back();
    }
}
