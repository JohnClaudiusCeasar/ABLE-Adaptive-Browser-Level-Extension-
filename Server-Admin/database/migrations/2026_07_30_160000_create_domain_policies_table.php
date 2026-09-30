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
        Schema::create('domain_policies', function (Blueprint $table) {
            $table->id();
            $table->string('domain')->unique();
            $table->enum('domain_status', ['safe', 'unsafe', 'unlisted'])->default('unlisted');
            $table->enum('policy', ['whitelisted', 'blacklisted', 'under_review'])->default('under_review');
            $table->string('category')->nullable();
            $table->string('classification_source')->nullable();
            $table->decimal('confidence', 3, 2)->nullable();
            $table->integer('risk_score')->default(0);

            // Visit tracking columns
            $table->integer('visit_count')->default(0);
            $table->timestamp('last_visited_at')->nullable();
            $table->string('last_source')->nullable();

            $table->timestamps();

            $table->index('domain_status');
            $table->index('last_visited_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('domain_policies');
    }
};
