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
        Schema::table('risk_patterns', function (Blueprint $table) {
            $table->foreignId('parent_criteria_id')
                ->nullable()
                ->after('score')
                ->constrained('risk_patterns')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('risk_patterns', function (Blueprint $table) {
            $table->dropForeign(['parent_criteria_id']);
            $table->dropColumn('parent_criteria_id');
        });
    }
};
