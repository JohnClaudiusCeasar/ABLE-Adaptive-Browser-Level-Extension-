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
        Schema::create('domain_recommendations', function (Blueprint $table) {
            $table->id();
            $table->string('category');
            $table->string('domain');
            $table->timestamps();

            // One row per domain per category. The composite index also
            // serves category-prefix lookups (the recommendation query).
            $table->unique(['category', 'domain']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('domain_recommendations');
    }
};
