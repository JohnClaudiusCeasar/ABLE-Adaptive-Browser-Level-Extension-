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
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->string('body')->nullable()->change();
            $table->string('attachment_path')->nullable()->after('body');
            $table->string('attachment_name')->nullable()->after('attachment_path');
            $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_name');
            $table->string('attachment_type')->nullable()->after('attachment_size');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropColumn([
                'attachment_path',
                'attachment_name',
                'attachment_size',
                'attachment_type',
            ]);
            $table->text('body')->nullable(false)->change();
        });
    }
};
