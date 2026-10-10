<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\AbleSettingsService;
use App\Services\SettingsStatusService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ExtensionSettingsController extends Controller
{
    public function __construct(private AbleSettingsService $settings, private SettingsStatusService $status) {}

    /**
     * Show the extension master-control settings page.
     */
    public function edit(): Response
    {
        return Inertia::render('settings/extension', [
            'settings' => $this->settings->get(AbleSettingsService::GROUP_EXTENSION),
            'status' => $this->status->extensionStatus(),
        ]);
    }

    /**
     * Persist extension settings.
     */
    public function update(Request $request): RedirectResponse
    {
        $this->settings->update(
            AbleSettingsService::GROUP_EXTENSION,
            $request->all(),
            $request->user(),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Extension settings updated.')]);

        return to_route('extension-settings.edit');
    }
}
