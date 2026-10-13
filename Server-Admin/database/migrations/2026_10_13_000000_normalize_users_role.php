<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Map legacy free-text role values to the canonical enum values.
        DB::table('users')
            ->whereRaw("LOWER(REPLACE(REPLACE(TRIM(role), ' ', '_'), '-', '_')) = 'super_admin'")
            ->update(['role' => 'superadmin']);

        DB::table('users')
            ->whereRaw("LOWER(TRIM(role)) = 'superadmin'")
            ->update(['role' => 'superadmin']);

        DB::table('users')
            ->where(function ($query) {
                $query->whereNull('role')
                    ->orWhereRaw("LOWER(REPLACE(REPLACE(TRIM(role), ' ', '_'), '-', '_')) NOT IN ('superadmin')");
            })
            ->update(['role' => 'admin']);

        Schema::table('users', function ($table) {
            $table->string('role')->default('admin')->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function ($table) {
            $table->string('role')->nullable()->change();
        });
    }
};
