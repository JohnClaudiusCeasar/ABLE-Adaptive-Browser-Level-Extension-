<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE egress_events ENGINE = InnoDB');
        }

        if (! Schema::hasColumn('egress_events', 'content_hash')) {
            Schema::table('egress_events', function (Blueprint $table) {
                $table->string('content_hash')->nullable()->after('flagged_items');
            });
        }

        // Add index for deduplication within 60-second windows if not already present
        $indexes = collect(Schema::getIndexes('egress_events'))->pluck('name')->all();
        if (! in_array('egress_events_dedup_idx', $indexes)) {
            Schema::table('egress_events', function (Blueprint $table) {
                $table->index(['domain', 'file_name', 'action', 'occurred_at'], 'egress_events_dedup_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $indexes = collect(Schema::getIndexes('egress_events'))->pluck('name')->all();
        if (in_array('egress_events_dedup_idx', $indexes)) {
            Schema::table('egress_events', function (Blueprint $table) {
                $table->dropIndex('egress_events_dedup_idx');
            });
        }

        if (Schema::hasColumn('egress_events', 'content_hash')) {
            Schema::table('egress_events', function (Blueprint $table) {
                $table->dropColumn('content_hash');
            });
        }
    }
};
