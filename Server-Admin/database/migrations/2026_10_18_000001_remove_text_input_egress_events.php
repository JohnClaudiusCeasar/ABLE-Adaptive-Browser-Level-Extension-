<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One-off cleanup: remove the synthetic "[text-input]" rows that the
 * text-intercept path wrote into egress_events. That string is a placeholder
 * file name handed to /api/score-content only because the endpoint requires a
 * fileName — no file is ever uploaded when a user presses Enter in a text
 * field, so these rows are not egress incidents and polluted the Shadow
 * Incidents "File Name" column.
 *
 * The extension now writes no row for routine typed text (only blocked or
 * pattern-matched checks are audited), so these will not come back.
 * nudge_interactions rows cascade on delete; the notifications generated from
 * these events carry no foreign key, so they are removed explicitly via their
 * "egress-event-{id}" message key.
 */
return new class extends Migration
{
    public function up(): void
    {
        $ids = DB::table('egress_events')
            ->where('file_name', '[text-input]')
            ->pluck('id');

        foreach ($ids->chunk(400) as $chunk) {
            $keys = $chunk->map(fn ($id) => 'egress-event-'.$id)->all();

            DB::table('notifications')
                ->where('source', 'egress')
                ->whereIn('message', $keys)
                ->delete();

            DB::table('egress_events')->whereIn('id', $chunk->all())->delete();
        }
    }

    public function down(): void
    {
        // Irreversible one-off cleanup of synthetic placeholder rows.
    }
};
