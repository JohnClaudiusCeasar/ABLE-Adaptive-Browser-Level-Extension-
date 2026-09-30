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
        Schema::create('egress_events', function (Blueprint $table) {
            $table->id();
            $table->string('domain');
            $table->string('user_id')->nullable();
            $table->string('file_name')->nullable();
            $table->integer('file_size')->default(0);
            $table->enum('action', ['proceeded', 'denied', 'allowed'])->default('denied');
            $table->integer('risk_score')->default(0);
            $table->json('flagged_items')->nullable();
            $table->string('content_hash')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index('domain');
            $table->index('occurred_at');
            $table->index('action');
            $table->index(['domain', 'file_name', 'action', 'occurred_at'], 'egress_events_dedup_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('egress_events');
    }
};
