<?php

namespace App\Http\Controllers\Settings;

use App\Enums\UserRole;
use App\Exceptions\RecordCountChangedException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ClearRecordsRequest;
use App\Services\AbleSettingsService;
use App\Services\RecordPurgeService;
use App\Services\SettingsStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
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
     * Count the records a scoped telemetry purge would remove.
     */
    public function previewRecords(Request $request, RecordPurgeService $purge): JsonResponse
    {
        abort_unless(UserRole::fromValue($request->user()->role) === UserRole::SuperAdmin, 403);

        $validated = $request->validate([
            'targets' => ['required', 'array', 'min:1'],
            'targets.*' => ['string', Rule::in(RecordPurgeService::telemetryKeys())],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        $from = filled($validated['date_from'] ?? null)
            ? Carbon::parse($validated['date_from'])->startOfDay()
            : null;
        $to = filled($validated['date_to'] ?? null)
            ? Carbon::parse($validated['date_to'])->endOfDay()
            : null;

        if (($from === null) !== ($to === null)) {
            throw ValidationException::withMessages([
                'date_from' => __('Choose both a start and an end date, or neither.'),
            ]);
        }

        $counts = $purge->preview($validated['targets'], $from, $to);

        return response()->json([
            'counts' => $counts,
            'total' => array_sum(array_column($counts, 'count')),
            'date_from' => $from?->toDateString(),
            'date_to' => $to?->toDateString(),
        ]);
    }

    /**
     * Permanently delete every record, or only the selected telemetry.
     */
    public function clearRecords(ClearRecordsRequest $request, RecordPurgeService $purge): RedirectResponse
    {
        // The module middleware already keeps the settings page away from
        // regular admins, but the purge is destructive enough to be guarded
        // explicitly as well.
        abort_unless(UserRole::fromValue($request->user()->role) === UserRole::SuperAdmin, 403);

        $targets = $request->input('targets');

        if (blank($targets)) {
            $purge->purge();

            Inertia::flash('toast', ['type' => 'success', 'message' => __('All records cleared.')]);

            return to_route('server-settings.edit');
        }

        $from = $request->filled('date_from')
            ? Carbon::parse((string) $request->input('date_from'))->startOfDay()
            : null;
        $to = $request->filled('date_to')
            ? Carbon::parse((string) $request->input('date_to'))->endOfDay()
            : null;

        try {
            $deleted = $purge->purgeSelection(
                array_values((array) $targets),
                $from,
                $to,
                (int) $request->input('confirmation'),
            );
        } catch (RecordCountChangedException $exception) {
            throw ValidationException::withMessages([
                'confirmation' => __('The number of matching records changed (:actual). Review the impact and try again.', [
                    'actual' => number_format($exception->actual),
                ]),
            ]);
        }

        $total = array_sum($deleted);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $total === 1
                ? __('Deleted 1 telemetry record.')
                : __('Deleted :count telemetry records.', ['count' => number_format($total)]),
        ]);

        return to_route('server-settings.edit');
    }
}
