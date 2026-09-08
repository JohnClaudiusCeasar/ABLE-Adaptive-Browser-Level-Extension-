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
            $table->json('flagged_items')->nullable()->after('risk_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('egress_events', function (Blueprint $table) {
            $table->dropColumn('flagged_items');
        });
    }
};
