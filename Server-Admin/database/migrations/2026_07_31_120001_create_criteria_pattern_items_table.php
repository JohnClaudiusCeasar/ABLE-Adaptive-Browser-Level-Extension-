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
        Schema::create('criteria_pattern_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('criteria_pattern_id')->constrained('risk_patterns')->cascadeOnDelete();
            $table->foreignId('parent_id')
                ->nullable()
                ->constrained('criteria_pattern_items')
                ->nullOnDelete();
            $table->string('title');
            $table->string('regex')->nullable(); // nullable: wrapper items imported from criteria patterns carry no regex
            $table->integer('score')->default(0);
            $table->enum('operator', ['and', 'or'])->default('and');
            $table->enum('risk_weight', ['low', 'medium', 'high'])->default('medium');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('criteria_pattern_items');
    }
};
