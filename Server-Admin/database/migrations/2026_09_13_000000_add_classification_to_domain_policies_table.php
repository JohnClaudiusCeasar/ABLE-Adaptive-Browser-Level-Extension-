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
        Schema::table('domain_policies', function (Blueprint $table) {
            $table->string('classification_source')->nullable()->after('category');
            $table->decimal('confidence', 3, 2)->nullable()->after('classification_source');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domain_policies', function (Blueprint $table) {
            $table->dropColumn(['classification_source', 'confidence']);
        });
    }
};
