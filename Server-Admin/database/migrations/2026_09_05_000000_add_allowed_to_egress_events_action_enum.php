<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('egress_events', function (Blueprint $table) {
            $table->enum('action', ['proceeded', 'denied', 'allowed'])->default('denied')->change();
        });
    }

    public function down(): void
    {
        Schema::table('egress_events', function (Blueprint $table) {
            $table->enum('action', ['proceeded', 'denied'])->default('denied')->change();
        });
    }
};
