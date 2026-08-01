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
        Schema::create('risk_patterns', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->enum('type', ['single', 'criteria'])->default('single');
            $table->string('regex')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->integer('score')->default(0);
            $table->timestamps();

            $table->index('type');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('risk_patterns');
    }
};
