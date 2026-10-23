<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Models\ExtensionLifecycle;
use App\Models\Notification;
use App\Models\User;
use App\Services\AbleSettingsService;
use App\Services\ChatService;
use App\Services\TelemetryVersion;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    public function __construct(private AbleSettingsService $settings) {}

    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'extension_version' => $this->extensionVersion(),
            'telemetryLive' => Inertia::always($this->telemetryLive($request)),
            'auth' => [
                'user' => $request->user(),
                'modules' => $request->user()
                    ? UserRole::fromValue($request->user()->role)->modules()
                    : [],
                'recommendPasswordChange' => (bool) $request->session()->get('recommend_password_change', false),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'unreadNotificationsCount' => $request->user() ? Notification::whereNull('read_at')->count() : 0,
            // On the chat page the full data is required immediately, so it is
            // provided eagerly. Every other page only needs the unread
            // badge.
            //
            // The full data used to be shared as a deferred prop, which made
            // every page view issue a second request. A deferred request
            // re-runs the whole route controller, so every dashboard and
            // report query was executed twice for every page view.
            'chat' => $request->routeIs('chat.*')
                ? $this->chatProps($request)
                : $this->chatBadgeProps($request),
        ];
    }

    /**
     * The version of the extension build this panel is showing.
     *
     * Three sources, in order of authority:
     *
     *  1. The published release, read from Client-Extension/manifest.json when
     *     the release is published. This is the exact build that was deployed.
     *  2. The newest version an installed extension reported. The extension
     *     sends its manifest version on every install and update, so the label
     *     stays current even when nobody has published a release.
     *  3. A configured fallback, so the version is never blank.
     *
     * The lookups are guarded because this prop is shared with every page,
     * including the public landing page, which must still render before the
     * settings table exists.
     */
    private function extensionVersion(): string
    {
        try {
            $published = (string) $this->settings->value(
                AbleSettingsService::GROUP_EXTENSION,
                'release.extension_version',
                '',
            );
        } catch (\Throwable) {
            $published = '';
        }

        if ($published !== '') {
            return $published;
        }

        try {
            $reported = (string) ExtensionLifecycle::query()
                ->whereIn('event', ['installed', 'updated'])
                ->whereNotNull('version')
                ->where('version', '!=', '')
                ->orderByDesc('occurred_at')
                ->value('version');
        } catch (\Throwable) {
            $reported = '';
        }

        if ($reported !== '') {
            return $reported;
        }

        return (string) config('able.extension_version', '');
    }

    /**
     * The chat data shared with every page so the Quick Chat widget can
     * render without a dedicated request.
     *
     * @return array<string, mixed>
     */
    private function chatProps(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user === null) {
            return [
                'conversations' => [],
                'users' => [],
                'unreadCount' => 0,
            ];
        }

        return [
            'conversations' => $this->conversationsFor($user),
            'users' => $this->usersFor($user),
            'unreadCount' => $this->unreadCountFor($user),
        ];
    }

    /**
     * The live telemetry payload shared with every page.
     *
     * The panel polls this to learn whether the telemetry it displays has
     * moved. The fingerprint is taken here, before the route controller runs,
     * so it is always a lower bound of the data the page is rendered with: a
     * change that lands after the fingerprint was taken but before the
     * controller queried its data is already in the page, and a change that
     * lands after that moves the fingerprint, so the panel reloads. Neither
     * ordering can miss a change.
     *
     * The payload is marked as always-included so it survives the partial
     * reloads the panel and the notification badge perform. A partial reload
     * that dropped the fingerprint would leave the panel comparing against a
     * stale baseline and reload forever.
     *
     * @return array{version: array<string, string>, pollIntervalMs: int, enabled: bool}
     */
    private function telemetryLive(Request $request): array
    {
        try {
            return app(TelemetryVersion::class)->payload($request->user() !== null);
        } catch (\Throwable) {
            // The telemetry tables may not exist yet on a fresh install. The
            // panel simply stays on manual refresh until they do.
            return [
                'version' => [],
                'pollIntervalMs' => (int) config('able.telemetry_poll_interval_ms', 5000),
                'enabled' => false,
            ];
        }
    }

    /**
     * The chat data shared with the pages that are not the chat page.
     *
     * Only the unread badge is shared. The conversation list and the user
     * list are loaded by the chat page itself, and the Quick Chat widget
     * fetches the user list when it is opened, so neither is paid for on
     * every page view.
     *
     * @return array<string, mixed>
     */
    private function chatBadgeProps(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user();

        return [
            'unreadCount' => $user === null ? 0 : $this->unreadCountFor($user),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function conversationsFor(User $user): array
    {
        return app(ChatService::class)->conversationsFor($user);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function usersFor(User $user): array
    {
        return app(ChatService::class)->usersFor($user);
    }

    private function unreadCountFor(User $user): int
    {
        return app(ChatService::class)->unreadCountFor($user);
    }
}
