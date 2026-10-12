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
        Schema::create('community_messages', function (Blueprint $table) {
            $table->id();
            $table->string('author', 32)->default('Anonymous');
            $table->string('category', 32); // suggestion, comment, complaint, false-positive
            $table->string('domain', 100)->nullable();
            $table->text('message');
            $table->string('ip_address', 45)->nullable();
            $table->string('status', 20)->default('pending'); // pending, approved, rejected
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['category', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('community_messages');
    }
};
