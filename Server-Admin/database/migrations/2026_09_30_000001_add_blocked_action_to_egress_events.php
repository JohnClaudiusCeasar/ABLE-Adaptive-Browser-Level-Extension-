<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Text-check events log action "blocked" and user_action "typing", which the
 * original enum columns rejected (the events 500'd and never persisted).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('egress_events', function (Blueprint $table) {
            $table->enum('action', ['proceeded', 'denied', 'allowed', 'blocked'])->default('denied')->change();
        });

        Schema::table('nudge_interactions', function (Blueprint $table) {
            $table->enum('user_action', ['proceeded', 'cancelled', 'allowed', 'typing'])->default('cancelled')->change();
        });
    }

    public function down(): void
    {
        Schema::table('egress_events', function (Blueprint $table) {
            $table->enum('action', ['proceeded', 'denied', 'allowed'])->default('denied')->change();
        });

        Schema::table('nudge_interactions', function (Blueprint $table) {
            $table->enum('user_action', ['proceeded', 'cancelled'])->default('cancelled')->change();
        });
    }
};
