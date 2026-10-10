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
        Schema::table('login_activities', function (Blueprint $table) {
            $table->index('created_at', 'login_activities_created_at_idx');
            $table->index('type', 'login_activities_type_idx');
            $table->index('email', 'login_activities_email_idx');
        });

        Schema::table('domain_policies', function (Blueprint $table) {
            $table->index('policy', 'domain_policies_policy_idx');
            $table->index('category', 'domain_policies_category_idx');
            $table->index('risk_score', 'domain_policies_risk_score_idx');
        });

        Schema::table('egress_events', function (Blueprint $table) {
            $table->index('risk_score', 'egress_events_risk_score_idx');
            $table->index('user_id', 'egress_events_user_id_idx');
        });

        Schema::table('domain_visits', function (Blueprint $table) {
            $table->index('user_id', 'domain_visits_user_id_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('login_activities', function (Blueprint $table) {
            $table->dropIndex('login_activities_created_at_idx');
            $table->dropIndex('login_activities_type_idx');
            $table->dropIndex('login_activities_email_idx');
        });

        Schema::table('domain_policies', function (Blueprint $table) {
            $table->dropIndex('domain_policies_policy_idx');
            $table->dropIndex('domain_policies_category_idx');
            $table->dropIndex('domain_policies_risk_score_idx');
        });

        Schema::table('egress_events', function (Blueprint $table) {
            $table->dropIndex('egress_events_risk_score_idx');
            $table->dropIndex('egress_events_user_id_idx');
        });

        Schema::table('domain_visits', function (Blueprint $table) {
            $table->dropIndex('domain_visits_user_id_idx');
        });
    }
};
