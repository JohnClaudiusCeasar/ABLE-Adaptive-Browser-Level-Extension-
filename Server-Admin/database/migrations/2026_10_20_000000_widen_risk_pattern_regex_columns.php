<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The regex columns were created as VARCHAR(255) while the admin form and the
 * validation rules both allow a 1000 character pattern. PostgreSQL (the
 * production database) rejects the overflow with a hard "value too long for
 * type character varying(255)" error, which surfaces to the operator as a 500
 * error page when the pattern is saved, and MySQL in strict mode fails the same
 * way. SQLite ignores column lengths entirely, which is why the test suite
 * never caught it.
 *
 * The sibling context columns (negation_context_regex, amplifier_context_regex)
 * are already VARCHAR(1000); this brings the detection regex columns in line
 * with both the validation limit and those columns.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('risk_patterns', function (Blueprint $table): void {
            $table->string('regex', 1000)->nullable()->change();
        });

        Schema::table('criteria_pattern_items', function (Blueprint $table): void {
            $table->string('regex', 1000)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('risk_patterns', function (Blueprint $table): void {
            $table->string('regex')->nullable()->change();
        });

        Schema::table('criteria_pattern_items', function (Blueprint $table): void {
            $table->string('regex')->nullable()->change();
        });
    }
};
