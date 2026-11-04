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
        Schema::create('extension_integrity_events', function (Blueprint $table) {
            $table->id();
            $table->string('user_id');
            $table->string('domain')->nullable();
            $table->string('reason')->nullable();
            $table->string('extension_id')->nullable();
            $table->string('version', 50)->nullable();
            $table->string('event_id')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index('user_id');
            $table->index('domain');
            $table->index('occurred_at');
            $table->index('event_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('extension_integrity_events');
    }
};
