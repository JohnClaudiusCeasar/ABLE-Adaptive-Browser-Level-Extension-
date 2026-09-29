<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds three optional context-intelligence fields to risk_patterns.
     * These are consumed by applySchemaContextModifier() in the extension's
     * risk-scoring.js to dampen or amplify a pattern's score based on the
     * textual surroundings of each match, rather than relying solely on
     * the engine's built-in heuristics.
     *
     *   negation_context_regex  — if this regex matches near a hit, the hit
     *                             is excluded (e.g. "example|format|e\.g\.")
     *   amplifier_context_regex — if this regex matches near a hit, the hit
     *                             counts double (e.g. "employee|patient|my ssn")
     *   negation_window         — characters to inspect on each side of a match
     *                             (defaults to 150 in the scoring engine)
     */
    public function up(): void
    {
        Schema::table('risk_patterns', function (Blueprint $table) {
            $table->string('negation_context_regex', 1000)
                ->nullable()
                ->after('regex')
                ->comment('Regex that, when found near a match, cancels its score contribution.');

            $table->string('amplifier_context_regex', 1000)
                ->nullable()
                ->after('negation_context_regex')
                ->comment('Regex that, when found near a match, doubles its score contribution.');

            $table->smallInteger('negation_window')
                ->nullable()
                ->after('amplifier_context_regex')
                ->comment('Character radius around each match to search for context signals (default 150).');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('risk_patterns', function (Blueprint $table) {
            $table->dropColumn([
                'negation_context_regex',
                'amplifier_context_regex',
                'negation_window',
            ]);
        });
    }
};
