<?php

namespace App\Http\Controllers;

use App\Events\NotificationUpdated;
use App\Models\CommunityMessage;
use App\Models\DomainPolicy;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CommunityMessageController extends Controller
{
    /**
     * Ensure the community_messages table exists and is seeded.
     */
    private function ensureTableExists(): void
    {
        if (! Schema::hasTable('community_messages')) {
            try {
                Artisan::call('app:baseline-migrations');
                Artisan::call('migrate', ['--force' => true]);
                if (Schema::hasTable('community_messages')) {
                    Artisan::call('db:seed', [
                        '--class' => 'CommunityMessageSeeder',
                        '--force' => true,
                    ]);
                }
            } catch (\Throwable $e) {
                Log::warning('CommunityMessage auto-migration failed: '.$e->getMessage());
            }
        }
    }

    /**
     * Store a newly created community message from public visitors or admin moderation (Moderation Policy: Pending).
     */
    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $this->ensureTableExists();

        $validated = $request->validate([
            'author' => ['nullable', 'string', 'max:32'],
            'category' => ['required', 'string', 'in:suggestion,comment,complaint,false-positive,access-request'],
            'domain' => ['nullable', 'string', 'max:100'],
            'message' => ['required', 'string', 'max:800'],
        ]);

        $author = trim($validated['author'] ?? '') ?: 'Anonymous';
        $domain = ! empty($validated['domain']) ? trim($validated['domain']) : null;
        $body = trim($validated['message']);

        /** @var CommunityMessage $record */
        $record = CommunityMessage::create([
            'author' => $author,
            'category' => $validated['category'],
            'domain' => $domain,
            'message' => $body,
            'ip_address' => $request->ip(),
            'status' => 'pending', // Requires admin approval before public visibility
        ]);

        // Dispatch in-dashboard notification for administrators
        try {
            $notification = Notification::create([
                'source' => 'community',
                'type' => $record->category === 'false-positive' ? 'false_positive_report' : 'community_feedback',
                'description' => "Community message pending review from {$record->author} ({$record->category})",
                'domain' => $record->domain,
                'ip_address' => $record->ip_address,
                'message' => 'community-message-'.$record->id,
                'status' => 'glass-unlisted',
                'occurred_at' => now(),
            ]);

            event(new NotificationUpdated('created', $notification, $record->id));
        } catch (\Throwable $e) {
            Log::warning('Failed to create notification for community message: '.$e->getMessage());
        }

        if ($request->header('X-Inertia')) {
            return Redirect::back()->with('success', 'Feedback submitted successfully.');
        }

        return response()->json([
            'success' => true,
            'message' => 'Thank you! Your submission has been received and is pending review by our research team.',
            'post' => [
                'id' => $record->id,
                'author' => $record->author,
                'category' => $record->category,
                'domain' => $record->domain ?? '',
                'time' => 'Pending Review',
                'body' => $record->message,
                'status' => 'pending',
            ],
        ], 201);
    }

    /**
     * Display the admin moderation dashboard for community feedback.
     */
    public function adminIndex(Request $request): Response
    {
        return $this->renderModerationBoard($request, null, 'community-messages');
    }

    /**
     * Display the admin board dedicated to extension "Request Access" submissions.
     */
    public function accessRequests(Request $request): Response
    {
        return $this->renderModerationBoard($request, 'access-request', 'access-requests');
    }

    /**
     * Shared moderation board renderer, optionally scoped to one category.
     */
    private function renderModerationBoard(Request $request, ?string $category, string $component): Response
    {
        $this->ensureTableExists();

        $statusFilter = $request->query('status', 'all');

        try {
            $scoped = fn () => $category !== null
                ? CommunityMessage::where('category', $category)
                : CommunityMessage::query();

            $query = $scoped()->orderByDesc('created_at');

            if (in_array($statusFilter, ['pending', 'approved', 'rejected'], true)) {
                $query->where('status', $statusFilter);
            }

            $messages = $query->paginate(20)->withQueryString();

            $counts = [
                'all' => $scoped()->count(),
                'pending' => $scoped()->where('status', 'pending')->count(),
                'approved' => $scoped()->where('status', 'approved')->count(),
                'rejected' => $scoped()->where('status', 'rejected')->count(),
            ];
        } catch (\Throwable $e) {
            Log::error('Failed to query community messages: '.$e->getMessage());
            $messages = new LengthAwarePaginator([], 0, 20);
            $counts = [
                'all' => 0,
                'pending' => 0,
                'approved' => 0,
                'rejected' => 0,
            ];
        }

        return Inertia::render($component, [
            'messages' => $messages,
            'counts' => $counts,
            'currentFilter' => $statusFilter,
        ]);
    }

    /**
     * Update a community message's fields.
     */
    public function update(Request $request, CommunityMessage $communityMessage): RedirectResponse
    {
        $validated = $request->validate([
            'author' => ['nullable', 'string', 'max:32'],
            'category' => ['required', 'string', 'in:suggestion,comment,complaint,false-positive,access-request'],
            'domain' => ['nullable', 'string', 'max:100'],
            'message' => ['required', 'string', 'max:800'],
            'status' => ['nullable', 'string', 'in:pending,approved,rejected'],
        ]);

        $author = trim($validated['author'] ?? '') ?: 'Anonymous';
        $domain = ! empty($validated['domain']) ? trim($validated['domain']) : null;
        $body = trim($validated['message']);
        $newStatus = $validated['status'] ?? $communityMessage->status;

        $communityMessage->update([
            'author' => $author,
            'category' => $validated['category'],
            'domain' => $domain,
            'message' => $body,
            'status' => $newStatus,
        ]);

        try {
            $statusMap = [
                'approved' => 'glass-safe',
                'rejected' => 'glass-unsafe',
                'pending' => 'glass-unlisted',
            ];

            $typeMap = [
                'approved' => 'community_feedback_approved',
                'rejected' => 'community_feedback_rejected',
                'pending' => $communityMessage->category === 'false-positive' ? 'false_positive_report' : 'community_feedback',
            ];

            $notification = Notification::where('source', 'community')
                ->where(function ($q) use ($communityMessage) {
                    $q->where('message', 'community-message-'.$communityMessage->id)
                        ->orWhere('message', Str::limit($communityMessage->message, 255))
                        ->orWhere('message', $communityMessage->message);
                })
                ->first();

            if ($notification) {
                $notification->update([
                    'status' => $statusMap[$newStatus] ?? 'glass-unlisted',
                    'type' => $typeMap[$newStatus] ?? 'community_feedback',
                    'domain' => $communityMessage->domain,
                    'description' => "Community message updated: {$communityMessage->author} ({$communityMessage->category})",
                ]);
            } else {
                $notification = Notification::create([
                    'source' => 'community',
                    'type' => $typeMap[$newStatus] ?? 'community_feedback',
                    'description' => "Community message updated: {$communityMessage->author} ({$communityMessage->category})",
                    'domain' => $communityMessage->domain,
                    'ip_address' => $communityMessage->ip_address,
                    'message' => 'community-message-'.$communityMessage->id,
                    'status' => $statusMap[$newStatus] ?? 'glass-unlisted',
                    'occurred_at' => now(),
                ]);
            }

            event(new NotificationUpdated('updated', $notification, $communityMessage->id));
        } catch (\Throwable $e) {
            Log::warning('Failed to update notification on feedback edit: '.$e->getMessage());
        }

        return Redirect::back()->with('success', 'Message updated successfully.');
    }

    /**
     * Approve a community message (makes it publicly visible on the landing page).
     * Approving an access request instead grants access and lifts the site block.
     */
    public function approve(CommunityMessage $communityMessage): RedirectResponse
    {
        $communityMessage->update(['status' => 'approved']);

        $isAccessRequest = $communityMessage->category === 'access-request';
        $unblockedDomain = null;

        if ($isAccessRequest && ! empty($communityMessage->domain)) {
            // Approving an access request is the grant: lift the site block.
            try {
                $policy = DomainPolicy::where('domain', $communityMessage->domain)->first();

                if ($policy && $policy->block_access) {
                    $policy->update(['block_access' => false]);
                    $unblockedDomain = $policy->domain;
                }
            } catch (\Throwable $e) {
                Log::warning('Failed to lift block for approved access request: '.$e->getMessage());
            }
        }

        $description = $isAccessRequest
            ? 'Access request approved for '.($communityMessage->domain ?? 'unknown domain')
                .($unblockedDomain ? ' — site unblocked' : '')
            : "Community message approved from {$communityMessage->author} ({$communityMessage->category})";

        try {
            $notification = Notification::where('source', 'community')
                ->where(function ($q) use ($communityMessage) {
                    $q->where('message', 'community-message-'.$communityMessage->id)
                        ->orWhere('message', Str::limit($communityMessage->message, 255))
                        ->orWhere('message', $communityMessage->message);
                })
                ->first();

            if ($notification) {
                $notification->update([
                    'status' => 'glass-safe',
                    'type' => 'community_feedback_approved',
                    'description' => $description,
                ]);
            } else {
                $notification = Notification::create([
                    'source' => 'community',
                    'type' => 'community_feedback_approved',
                    'description' => $description,
                    'domain' => $communityMessage->domain,
                    'ip_address' => $communityMessage->ip_address,
                    'message' => 'community-message-'.$communityMessage->id,
                    'status' => 'glass-safe',
                    'occurred_at' => now(),
                ]);
            }

            event(new NotificationUpdated('approved', $notification, $communityMessage->id));
        } catch (\Throwable $e) {
            Log::warning('Failed to update notification on approve: '.$e->getMessage());
        }

        if ($isAccessRequest) {
            return Redirect::back()->with(
                'success',
                $unblockedDomain
                    ? "Access request approved — access granted for {$unblockedDomain}."
                    : 'Access request approved.',
            );
        }

        return Redirect::back()->with('success', 'Message approved and published to the live landing feed.');
    }

    /**
     * Reject a community message (hides from public visibility).
     */
    public function reject(CommunityMessage $communityMessage): RedirectResponse
    {
        $communityMessage->update(['status' => 'rejected']);

        try {
            $notification = Notification::where('source', 'community')
                ->where(function ($q) use ($communityMessage) {
                    $q->where('message', 'community-message-'.$communityMessage->id)
                        ->orWhere('message', Str::limit($communityMessage->message, 255))
                        ->orWhere('message', $communityMessage->message);
                })
                ->first();

            if ($notification) {
                $notification->update([
                    'status' => 'glass-unsafe',
                    'type' => 'community_feedback_rejected',
                    'description' => "Community message rejected from {$communityMessage->author} ({$communityMessage->category})",
                ]);
            } else {
                $notification = Notification::create([
                    'source' => 'community',
                    'type' => 'community_feedback_rejected',
                    'description' => "Community message rejected from {$communityMessage->author} ({$communityMessage->category})",
                    'domain' => $communityMessage->domain,
                    'ip_address' => $communityMessage->ip_address,
                    'message' => 'community-message-'.$communityMessage->id,
                    'status' => 'glass-unsafe',
                    'occurred_at' => now(),
                ]);
            }

            event(new NotificationUpdated('rejected', $notification, $communityMessage->id));
        } catch (\Throwable $e) {
            Log::warning('Failed to update notification on reject: '.$e->getMessage());
        }

        return Redirect::back()->with('success', 'Message marked as rejected.');
    }

    /**
     * Permanently delete a community message.
     */
    public function destroy(CommunityMessage $communityMessage): RedirectResponse
    {
        $id = $communityMessage->id;
        $body = $communityMessage->message;
        $limitBody = Str::limit($body, 255);
        $communityMessage->delete();

        try {
            $deletedNotification = Notification::where('source', 'community')
                ->where(function ($q) use ($id, $limitBody, $body) {
                    $q->where('message', 'community-message-'.$id)
                        ->orWhere('message', $limitBody)
                        ->orWhere('message', $body);
                })
                ->first();

            Notification::where('source', 'community')
                ->where(function ($q) use ($id, $limitBody, $body) {
                    $q->where('message', 'community-message-'.$id)
                        ->orWhere('message', $limitBody)
                        ->orWhere('message', $body);
                })
                ->delete();

            event(new NotificationUpdated('deleted', $deletedNotification, $id));
        } catch (\Throwable $e) {
            Log::warning('Failed to delete notification on feedback destroy: '.$e->getMessage());
        }

        return Redirect::back()->with('success', 'Message permanently deleted.');
    }
}
