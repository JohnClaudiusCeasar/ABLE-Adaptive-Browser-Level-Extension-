<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\AbleSettingsService;
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
}
