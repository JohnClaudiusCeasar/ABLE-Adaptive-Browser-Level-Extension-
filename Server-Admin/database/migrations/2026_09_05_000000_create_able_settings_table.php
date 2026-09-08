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
        if (Schema::hasTable('able_settings')) {
            return;
        }

        Schema::create('able_settings', function (Blueprint $table) {
            $table->id();
            // Column lengths kept small so the composite unique index fits
            // MySQL's 1000-byte key limit under utf8mb4.
            $table->string('group', 50);
            $table->string('key', 150);
            $table->json('value')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['group', 'key']);
            $table->index('group');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('able_settings');
    }
};
