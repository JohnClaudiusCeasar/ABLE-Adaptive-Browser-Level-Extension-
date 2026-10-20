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
        if (Schema::hasColumn('domain_policies', 'block_access')) {
            return;
        }

        Schema::table('domain_policies', function (Blueprint $table) {
            $table->boolean('block_access')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasColumn('domain_policies', 'block_access')) {
            return;
        }

        Schema::table('domain_policies', function (Blueprint $table) {
            $table->dropColumn('block_access');
        });
    }
};
