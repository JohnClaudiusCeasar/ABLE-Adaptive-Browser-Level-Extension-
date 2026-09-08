<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Replace the active/inactive status column with a scan priority.
     *
     * Existing data mapping: 'active' becomes 'medium', 'inactive' becomes
     * 'low'. Add/backfill/drop avoids MySQL enum-conversion pitfalls.
     */
    public function up(): void
    {
        Schema::table('risk_patterns', function ($table) {
            $table->enum('priority', ['low', 'medium', 'high'])
                ->default('medium')
                ->after('score');
            $table->index('priority');
        });

        DB::table('risk_patterns')->update([
            'priority' => DB::raw("CASE WHEN status = 'active' THEN 'medium' ELSE 'low' END"),
        ]);

        Schema::table('risk_patterns', function ($table) {
            $table->dropIndex(['status']);
            $table->dropColumn('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('risk_patterns', function ($table) {
            $table->enum('status', ['active', 'inactive'])
                ->default('active')
                ->after('score');
            $table->index('status');
        });

        DB::table('risk_patterns')->update([
            'status' => DB::raw("CASE WHEN priority = 'low' THEN 'inactive' ELSE 'active' END"),
        ]);

        Schema::table('risk_patterns', function ($table) {
            $table->dropIndex(['priority']);
            $table->dropColumn('priority');
        });
    }
};
