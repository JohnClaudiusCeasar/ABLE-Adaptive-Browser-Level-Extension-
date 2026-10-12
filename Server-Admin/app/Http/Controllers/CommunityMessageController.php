<?php

namespace App\Http\Controllers;

use App\Models\CommunityMessage;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
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
        if (! \Illuminate\Support\Facades\Schema::hasTable('community_messages')) {
            try {
                \Illuminate\Support\Facades\Artisan::call('app:baseline-migrations');
                \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
                if (\Illuminate\Support\Facades\Schema::hasTable('community_messages')) {
                    \Illuminate\Support\Facades\Artisan::call('db:seed', [
                        '--class' => 'CommunityMessageSeeder',
                        '--force' => true,
                    ]);
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('CommunityMessage auto-migration failed: ' . $e->getMessage());
            }
        }
    }

    /**
     * Store a newly created community message from public visitors (Moderation Policy: Pending).
     */
    public function store(Request $request): JsonResponse
    {
        $this->ensureTableExists();

        $validated = $request->validate([
            'author' => ['nullable', 'string', 'max:32'],
            'category' => ['required', 'string', 'in:suggestion,comment,complaint,false-positive'],
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

        // Dispatch in-dashboard notification for administrators (best-effort)
        try {
            Notification::create([
                'source' => 'community',
                'type' => $record->category === 'false-positive' ? 'false_positive_report' : 'community_feedback',
                'description' => "Community message pending review from {$record->author} ({$record->category})",
                'domain' => $record->domain,
                'ip_address' => $record->ip_address,
                'message' => Str::limit($record->message, 255),
                'status' => 'glass-unlisted',
                'occurred_at' => now(),
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to create notification for community message: ' . $e->getMessage());
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
        $this->ensureTableExists();

        $statusFilter = $request->query('status', 'all');

        try {
            $query = CommunityMessage::orderByDesc('created_at');

            if (in_array($statusFilter, ['pending', 'approved', 'rejected'], true)) {
                $query->where('status', $statusFilter);
            }

            $messages = $query->paginate(20)->withQueryString();

            $counts = [
                'all' => CommunityMessage::count(),
                'pending' => CommunityMessage::where('status', 'pending')->count(),
                'approved' => CommunityMessage::where('status', 'approved')->count(),
                'rejected' => CommunityMessage::where('status', 'rejected')->count(),
            ];
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to query community messages: ' . $e->getMessage());
            $messages = new \Illuminate\Pagination\LengthAwarePaginator([], 0, 20);
            $counts = [
                'all' => 0,
                'pending' => 0,
                'approved' => 0,
                'rejected' => 0,
            ];
        }

        return Inertia::render('community-messages', [
            'messages' => $messages,
            'counts' => $counts,
            'currentFilter' => $statusFilter,
        ]);
    }

    /**
     * Approve a community message (makes it publicly visible on the landing page).
     */
    public function approve(CommunityMessage $communityMessage): RedirectResponse
    {
        $communityMessage->update(['status' => 'approved']);

        return Redirect::back()->with('success', 'Message approved and published to the live landing feed.');
    }

    /**
     * Reject a community message (hides from public visibility).
     */
    public function reject(CommunityMessage $communityMessage): RedirectResponse
    {
        $communityMessage->update(['status' => 'rejected']);

        return Redirect::back()->with('success', 'Message marked as rejected.');
    }

    /**
     * Permanently delete a community message.
     */
    public function destroy(CommunityMessage $communityMessage): RedirectResponse
    {
        $communityMessage->delete();

        return Redirect::back()->with('success', 'Message permanently deleted.');
    }
}
