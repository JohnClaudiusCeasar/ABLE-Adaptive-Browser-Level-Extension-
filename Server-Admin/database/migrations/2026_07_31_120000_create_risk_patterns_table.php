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
            $table->integer('score')->default(0);
            $table->enum('priority', ['low', 'medium', 'high'])->default('medium');
            $table->foreignId('parent_criteria_id')
                ->nullable()
                ->constrained('risk_patterns')
                ->nullOnDelete();
            $table->string('negation_context_regex', 1000)
                ->nullable()
                ->comment('Regex that, when found near a match, cancels its score contribution.');
            $table->string('amplifier_context_regex', 1000)
                ->nullable()
                ->comment('Regex that, when found near a match, doubles its score contribution.');
            $table->smallInteger('negation_window')
                ->nullable()
                ->comment('Character radius around each match to search for context signals (default 150).');
            $table->timestamps();

            $table->index('type');
            $table->index('priority');
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
