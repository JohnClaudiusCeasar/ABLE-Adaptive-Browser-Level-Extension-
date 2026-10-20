<?php

namespace App\Http\Controllers\Settings;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ClearRecordsRequest;
use App\Services\AbleSettingsService;
use App\Services\RecordPurgeService;
use App\Services\SettingsStatusService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ServerSettingsController extends Controller
{
    public function __construct(private AbleSettingsService $settings, private SettingsStatusService $status) {}

    /**
     * Show the server master-control settings page.
     */
    public function edit(): Response
    {
        return Inertia::render('settings/server', [
            'settings' => $this->settings->get(AbleSettingsService::GROUP_SERVER),
            'status' => $this->status->serverStatus(),
        ]);
    }

    /**
     * Persist server settings.
     */
    public function update(Request $request): RedirectResponse
    {
        $this->settings->update(
            AbleSettingsService::GROUP_SERVER,
            $request->all(),
            $request->user(),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Server settings updated.')]);

        return to_route('server-settings.edit');
    }

    /**
     * Permanently delete every record in the app.
     */
    public function clearRecords(ClearRecordsRequest $request, RecordPurgeService $purge): RedirectResponse
    {
        // The module middleware already keeps the settings page away from
        // regular admins, but the purge is destructive enough to be guarded
        // explicitly as well.
        abort_unless(UserRole::fromValue($request->user()->role) === UserRole::SuperAdmin, 403);

        $purge->purge();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('All records cleared.')]);

        return to_route('server-settings.edit');
    }
}
