<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('domain_visits', function (Blueprint $table) {
            $table->string('status', 50)->nullable()->after('domain');
            $table->index('status');
        });

        // Backfill existing domain_visits rows with their parent domain_policy domain_status
        DB::table('domain_visits')->whereNull('status')->orderBy('id')->chunkById(200, function ($visits) {
            foreach ($visits as $visit) {
                $status = DB::table('domain_policies')
                    ->where('id', $visit->domain_policy_id)
                    ->value('domain_status') ?? 'unlisted';

                DB::table('domain_visits')
                    ->where('id', $visit->id)
                    ->update(['status' => $status]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('domain_visits', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn('status');
        });
    }
};
