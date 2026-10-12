<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Text-check events log action "blocked" and user_action "typing", which the
 * original enum columns rejected (the events 500'd and never persisted).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE egress_events DROP CONSTRAINT IF EXISTS egress_events_action_check');
            DB::statement("ALTER TABLE egress_events ADD CONSTRAINT egress_events_action_check CHECK (action IN ('proceeded', 'denied', 'allowed', 'blocked'))");

            DB::statement('ALTER TABLE nudge_interactions DROP CONSTRAINT IF EXISTS nudge_interactions_user_action_check');
            DB::statement("ALTER TABLE nudge_interactions ADD CONSTRAINT nudge_interactions_user_action_check CHECK (user_action IN ('proceeded', 'cancelled', 'allowed', 'typing'))");
        } else {
            Schema::table('egress_events', function (Blueprint $table) {
                $table->enum('action', ['proceeded', 'denied', 'allowed', 'blocked'])->default('denied')->change();
            });

            Schema::table('nudge_interactions', function (Blueprint $table) {
                $table->enum('user_action', ['proceeded', 'cancelled', 'allowed', 'typing'])->default('cancelled')->change();
            });
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE egress_events DROP CONSTRAINT IF EXISTS egress_events_action_check');
            DB::statement("ALTER TABLE egress_events ADD CONSTRAINT egress_events_action_check CHECK (action IN ('proceeded', 'denied', 'allowed'))");

            DB::statement('ALTER TABLE nudge_interactions DROP CONSTRAINT IF EXISTS nudge_interactions_user_action_check');
            DB::statement("ALTER TABLE nudge_interactions ADD CONSTRAINT nudge_interactions_user_action_check CHECK (user_action IN ('proceeded', 'cancelled'))");
        } else {
            Schema::table('egress_events', function (Blueprint $table) {
                $table->enum('action', ['proceeded', 'denied', 'allowed'])->default('denied')->change();
            });

            Schema::table('nudge_interactions', function (Blueprint $table) {
                $table->enum('user_action', ['proceeded', 'cancelled'])->default('cancelled')->change();
            });
        }
    }
};
