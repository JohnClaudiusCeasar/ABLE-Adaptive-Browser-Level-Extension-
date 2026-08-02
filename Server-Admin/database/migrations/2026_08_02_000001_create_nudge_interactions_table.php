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
        Schema::create('nudge_interactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('egress_event_id')->constrained('egress_events')->cascadeOnDelete();
            $table->string('domain');
            $table->string('user_id')->nullable();
            $table->enum('user_action', ['proceeded', 'cancelled'])->default('cancelled');
            $table->timestamp('interacted_at');
            $table->timestamps();

            $table->index('egress_event_id');
            $table->index('user_action');
            $table->index('interacted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nudge_interactions');
    }
};
