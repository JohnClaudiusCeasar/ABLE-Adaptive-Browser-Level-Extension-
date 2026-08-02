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
            $table->enum('action', ['proceeded', 'denied'])->default('denied');
            $table->integer('risk_score')->default(0);
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index('domain');
            $table->index('occurred_at');
            $table->index('action');
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
