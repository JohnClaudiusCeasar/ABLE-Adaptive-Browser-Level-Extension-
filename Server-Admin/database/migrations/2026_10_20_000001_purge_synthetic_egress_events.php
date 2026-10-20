<?php

use App\Support\SyntheticFileName;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One-off cleanup: remove the placeholder rows the extension wrote into
 * egress_events. Names such as "upload.csv" or "blob.pdf" are fabricated from
 * the MIME type when the extension cannot recover the user's real file name,
 * so nothing was ever uploaded behind them — they are not egress incidents
 * and they polluted the Shadow Incidents "File Name" column with a MIME type
 * dressed up as a file name.
 *
 * /api/log-egress now rejects these names before they are persisted, so they
 * will not come back.
 *
 * nudge_interactions rows cascade on delete; the notifications generated from
 * these events carry no foreign key, so they are removed explicitly via their
 * "egress-event-{id}" message key.
 */
return new class extends Migration
{
    public function up(): void
    {
        $ids = DB::table('egress_events')
            ->orderBy('id')
            ->get(['id', 'file_name'])
            ->filter(fn ($row) => SyntheticFileName::isPlaceholder($row->file_name))
            ->pluck('id');

        foreach ($ids->chunk(400) as $chunk) {
            $keys = $chunk->map(fn ($id) => 'egress-event-'.$id)->all();

            DB::table('notifications')
                ->where('source', 'egress')
                ->whereIn('message', $keys)
                ->delete();

            DB::table('egress_events')->whereIn('id', $chunk->values()->all())->delete();
        }
    }

    public function down(): void
    {
        // Irreversible one-off cleanup of synthetic placeholder rows.
    }
};
