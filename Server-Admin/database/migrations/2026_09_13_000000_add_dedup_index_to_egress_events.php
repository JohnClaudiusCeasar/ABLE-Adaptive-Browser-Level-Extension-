<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('egress_events', function (Blueprint $table) {
            $table->string('content_hash')->nullable()->after('flagged_items');
        });

        // Add unique partial index for deduplication within 60-second windows
        Schema::table('egress_events', function (Blueprint $table) {
            $table->index(['domain', 'file_name', 'action', 'occurred_at'], 'egress_events_dedup_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('egress_events', function (Blueprint $table) {
            $table->dropIndex('egress_events_dedup_idx');
            $table->dropColumn('content_hash');
        });
    }
};