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
        Schema::create('domain_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('domain_policy_id')->constrained('domain_policies')->cascadeOnDelete();
            $table->string('domain');
            $table->string('user_id')->nullable();
            $table->string('status', 50)->nullable();
            $table->timestamp('visited_at');
            $table->timestamps();

            $table->index('domain_policy_id');
            $table->index('domain');
            $table->index('visited_at');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('domain_visits');
    }
};
