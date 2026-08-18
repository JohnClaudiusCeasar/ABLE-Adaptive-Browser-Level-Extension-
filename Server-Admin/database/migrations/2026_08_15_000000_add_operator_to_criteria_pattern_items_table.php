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
        Schema::table('criteria_pattern_items', function (Blueprint $table) {
            $table->enum('operator', ['and', 'or'])->default('and')->after('regex');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('criteria_pattern_items', function (Blueprint $table) {
            $table->dropColumn('operator');
        });
    }
};
