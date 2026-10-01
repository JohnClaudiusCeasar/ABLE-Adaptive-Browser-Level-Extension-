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
        Schema::table('domain_visits', function (Blueprint $table) {
            $table->string('event_id')->nullable()->after('id');
            $table->unique('event_id', 'domain_visits_event_id_unique');
        });

        Schema::table('egress_events', function (Blueprint $table) {
            $table->string('event_id')->nullable()->after('id');
            $table->unique('event_id', 'egress_events_event_id_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domain_visits', function (Blueprint $table) {
            $table->dropUnique('domain_visits_event_id_unique');
            $table->dropColumn('event_id');
        });

        Schema::table('egress_events', function (Blueprint $table) {
            $table->dropUnique('egress_events_event_id_unique');
            $table->dropColumn('event_id');
        });
    }
};
