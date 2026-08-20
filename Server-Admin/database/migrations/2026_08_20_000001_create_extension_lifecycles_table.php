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
        Schema::create('extension_lifecycles', function (Blueprint $table) {
            $table->id();
            $table->string('user_id');
            $table->string('extension_id')->nullable();
            $table->enum('event', ['installed', 'updated', 'uninstalled']);
            $table->string('version')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index('user_id');
            $table->index('event');
            $table->index('occurred_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('extension_lifecycles');
    }
};
