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
            // Wrapper items imported from criteria patterns carry no regex.
            $table->string('regex')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('criteria_pattern_items', function (Blueprint $table) {
            $table->string('regex')->nullable(false)->change();
        });
    }
};
