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
        $indexes = collect(Schema::getIndexes('notifications'))->pluck('name')->all();

        Schema::table('notifications', function (Blueprint $table) use ($indexes) {
            if (! in_array('notifications_source_message_idx', $indexes)) {
                $table->index(['source', 'message'], 'notifications_source_message_idx');
            }
            if (! in_array('notifications_user_id_idx', $indexes)) {
                $table->index('user_id', 'notifications_user_id_idx');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $indexes = collect(Schema::getIndexes('notifications'))->pluck('name')->all();

        Schema::table('notifications', function (Blueprint $table) use ($indexes) {
            if (in_array('notifications_source_message_idx', $indexes)) {
                $table->dropIndex('notifications_source_message_idx');
            }
            if (in_array('notifications_user_id_idx', $indexes)) {
                $table->dropIndex('notifications_user_id_idx');
            }
        });
    }
};
