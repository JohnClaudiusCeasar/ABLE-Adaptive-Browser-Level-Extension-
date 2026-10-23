<?php

namespace Tests\Feature\Settings;

use App\Models\AuditLog;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\CommunityMessage;
use App\Models\CriteriaPatternItem;
use App\Models\DomainPolicy;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionLifecycle;
use App\Models\LoginActivity;
use App\Models\Notification;
use App\Models\NudgeInteraction;
use App\Models\RiskPattern;
use App\Models\User;
use App\Services\RecordPurgeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ScopedClearRecordsTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'purge-fixture-password';

    public function test_scoped_delete_removes_only_the_selected_telemetry(): void
    {
        $user = $this->superAdmin();
        $policy = $this->policy();
        $this->visit($policy, '2026-10-05 10:00:00');
        $this->egress('2026-10-05 10:00:00');
        $this->notification('2026-10-05 10:00:00');

        $this->deleteScoped($user, ['notifications'], '1')
            ->assertRedirect(route('server-settings.edit'))
            ->assertSessionHasNoErrors();

        $this->assertSame(0, Notification::withTrashed()->count());
        $this->assertSame(1, DomainVisit::count());
        $this->assertSame(1, EgressEvent::count());
        $this->assertSame(1, DomainPolicy::count());
    }

    public function test_scoped_delete_respects_the_date_range_of_each_telemetry_table(): void
    {
        $user = $this->superAdmin();
        $policy = $this->policy();

        $this->visit($policy, '2026-10-05 10:00:00');
        $this->visit($policy, '2026-10-15 23:00:00');
        $this->visit($policy, '2026-10-16 00:00:01');

        $this->deleteScoped($user, ['domain_visits'], '2', '2026-10-01', '2026-10-15')
            ->assertSessionHasNoErrors();

        $this->assertSame(1, DomainVisit::count());
        $this->assertSame('2026-10-16 00:00:01', DomainVisit::first()->visited_at->toDateTimeString());

        $this->egress('2026-10-05 10:00:00');
        $this->egress('2026-09-30 23:59:59');

        $this->deleteScoped($user, ['egress_events'], '1', '2026-10-01', '2026-10-15')
            ->assertSessionHasNoErrors();

        $this->assertSame(1, EgressEvent::count());
        $this->assertSame('2026-09-30 23:59:59', EgressEvent::first()->occurred_at->toDateTimeString());

        $this->loginActivity($user, '2026-10-05 10:00:00');
        $this->loginActivity($user, '2026-09-01 10:00:00');

        $this->deleteScoped($user, ['login_activities'], '1', '2026-10-01', '2026-10-15')
            ->assertSessionHasNoErrors();

        $this->assertSame(1, LoginActivity::count());
        $this->assertSame(
            '2026-09-01 10:00:00',
            LoginActivity::first()->created_at->toDateTimeString(),
        );
    }

    public function test_scoped_delete_requires_the_previewed_count_as_the_phrase(): void
    {
        $user = $this->superAdmin();
        $policy = $this->policy();
        $this->visit($policy, '2026-10-05 10:00:00');
        $this->visit($policy, '2026-10-06 10:00:00');

        $this->deleteScoped($user, ['domain_visits'], '999')
            ->assertSessionHasErrors('confirmation');

        $this->assertSame(2, DomainVisit::count());
    }

    public function test_scoped_delete_aborts_when_the_count_changed_after_the_preview(): void
    {
        $user = $this->superAdmin();
        $policy = $this->policy();
        $this->visit($policy, '2026-10-05 10:00:00');

        // The operator previewed one record; another one arrives before the
        // confirmation is submitted.
        $this->visit($policy, '2026-10-06 10:00:00');

        $this->deleteScoped($user, ['domain_visits'], '1')
            ->assertSessionHasErrors('confirmation');

        $this->assertSame(2, DomainVisit::count());
    }

    public function test_scoped_delete_rejects_targets_outside_the_telemetry_group(): void
    {
        $user = $this->superAdmin();
        $this->policy();

        foreach (['domain_policies', 'users'] as $target) {
            $this->deleteScoped($user, [$target], '1')
                ->assertSessionHasErrors('targets.0');

            $this->assertSame(1, DomainPolicy::count());
            $this->assertDatabaseHas('users', ['id' => $user->id]);
        }
    }

    public function test_selecting_egress_events_also_removes_their_nudge_interactions(): void
    {
        $user = $this->superAdmin();

        $inRange = $this->egress('2026-10-05 10:00:00');
        $outOfRange = $this->egress('2026-08-01 10:00:00');

        $implied = NudgeInteraction::create([
            'egress_event_id' => $inRange->id,
            'domain' => 'purge-fixture.example',
            'user_id' => 'purge-fixture-user',
            'user_action' => 'cancelled',
            // The interaction happened after the range, but the parent event is
            // inside it, so the row goes with the parent.
            'interacted_at' => Carbon::parse('2026-10-20 10:00:00'),
        ]);

        $kept = NudgeInteraction::create([
            'egress_event_id' => $outOfRange->id,
            'domain' => 'purge-fixture.example',
            'user_id' => 'purge-fixture-user',
            'user_action' => 'cancelled',
            'interacted_at' => Carbon::parse('2026-08-01 10:00:00'),
        ]);

        $this->deleteScoped($user, ['egress_events'], '2', '2026-10-01', '2026-10-15')
            ->assertSessionHasNoErrors();

        $this->assertSame(1, EgressEvent::count());
        $this->assertDatabaseMissing('nudge_interactions', ['id' => $implied->id]);
        $this->assertDatabaseHas('nudge_interactions', ['id' => $kept->id]);
    }

    public function test_scoped_delete_keeps_configuration_content_and_chat(): void
    {
        $user = $this->superAdmin();
        $other = User::factory()->create();

        $policy = $this->policy();
        $this->visit($policy, '2026-10-05 10:00:00');
        $this->egress('2026-10-05 10:00:00');
        $this->notification('2026-10-05 10:00:00');
        $this->extensionLifecycle($user, '2026-10-05 10:00:00');
        $this->loginActivity($user, '2026-10-05 10:00:00');
        $this->auditLog($user, $policy, '2026-10-05 10:00:00');

        $pattern = RiskPattern::create([
            'title' => 'Keep me',
            'type' => 'criteria',
            'score' => 50,
            'priority' => 'medium',
        ]);

        CriteriaPatternItem::create([
            'criteria_pattern_id' => $pattern->id,
            'title' => 'Keep me too',
            'regex' => '/keep-me/',
            'score' => 10,
        ]);

        $conversation = ChatConversation::forPair($user, $other);

        ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'body' => 'Keep this message',
        ]);

        CommunityMessage::create([
            'author' => 'Purge Fixture',
            'category' => 'comment',
            'message' => 'Keep this feedback',
            'ip_address' => '127.0.0.1',
            'status' => 'approved',
        ]);

        $total = array_sum(array_column(
            app(RecordPurgeService::class)->preview(RecordPurgeService::telemetryKeys()),
            'count',
        ));

        $this->assertGreaterThan(0, $total);

        $this->deleteScoped($user, RecordPurgeService::telemetryKeys(), (string) $total)
            ->assertRedirect(route('server-settings.edit'))
            ->assertSessionHasNoErrors();

        $this->assertSame(0, DomainVisit::count());
        $this->assertSame(0, EgressEvent::count());
        $this->assertSame(0, Notification::withTrashed()->count());
        $this->assertSame(0, ExtensionLifecycle::count());
        $this->assertSame(0, LoginActivity::count());
        $this->assertSame(0, AuditLog::count());

        $this->assertSame(1, DomainPolicy::count());
        $this->assertSame(1, RiskPattern::count());
        $this->assertSame(1, CriteriaPatternItem::count());
        $this->assertSame(1, ChatConversation::count());
        $this->assertSame(1, ChatMessage::count());
        $this->assertSame(1, CommunityMessage::count());
    }

    public function test_preview_endpoint_returns_counts_for_the_selection_and_range(): void
    {
        $user = $this->superAdmin();
        $policy = $this->policy();
        $this->visit($policy, '2026-10-05 10:00:00');
        $this->visit($policy, '2026-10-15 10:00:00');
        $this->visit($policy, '2026-10-30 10:00:00');

        $response = $this->actingAs($user)->getJson(route('server-settings.preview-records', [
            'targets' => ['domain_visits'],
            'date_from' => '2026-10-01',
            'date_to' => '2026-10-15',
        ]));

        $response->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('counts.0.key', 'domain_visits')
            ->assertJsonPath('counts.0.count', 2)
            ->assertJsonPath('counts.0.group', 'telemetry')
            ->assertJsonPath('counts.0.date_column', 'visited_at');
    }

    public function test_preview_endpoint_adds_the_implied_nudge_interactions(): void
    {
        $user = $this->superAdmin();
        $event = $this->egress('2026-10-05 10:00:00');

        NudgeInteraction::create([
            'egress_event_id' => $event->id,
            'domain' => 'purge-fixture.example',
            'user_id' => 'purge-fixture-user',
            'user_action' => 'cancelled',
            'interacted_at' => Carbon::parse('2026-10-05 10:01:00'),
        ]);

        $response = $this->actingAs($user)->getJson(route('server-settings.preview-records', [
            'targets' => ['egress_events'],
        ]));

        $response->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('counts.0.key', 'nudge_interactions')
            ->assertJsonPath('counts.0.count', 1)
            ->assertJsonPath('counts.1.key', 'egress_events')
            ->assertJsonPath('counts.1.count', 1);
    }

    public function test_preview_endpoint_is_forbidden_for_regular_admins(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'password' => self::PASSWORD]);
        $this->policy();

        $this->actingAs($admin)->getJson(route('server-settings.preview-records', [
            'targets' => ['domain_visits'],
        ]))->assertForbidden();
    }

    public function test_scoped_delete_is_forbidden_for_regular_admins(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'password' => self::PASSWORD]);
        $policy = $this->policy();
        $this->visit($policy, '2026-10-05 10:00:00');

        $this->deleteScoped($admin, ['domain_visits'], '1')->assertForbidden();

        $this->assertSame(1, DomainVisit::count());
    }

    public function test_guests_are_redirected_from_the_preview_endpoint(): void
    {
        $this->get(route('server-settings.preview-records', [
            'targets' => ['domain_visits'],
        ]))->assertRedirect(route('login'));
    }

    public function test_record_counts_expose_the_telemetry_metadata(): void
    {
        $user = $this->superAdmin();

        $response = $this->actingAs($user)->get(route('server-settings.edit'));

        $response->assertInertia(fn ($page) => $page
            ->where('status.record_counts.2.key', 'domain_visits')
            ->where('status.record_counts.2.group', 'telemetry')
            ->where('status.record_counts.2.date_column', 'visited_at')
            ->where('status.record_counts.4.key', 'nudge_interactions')
            ->where('status.record_counts.4.implied_by', ['egress_events'])
        );
    }

    private function superAdmin(): User
    {
        return User::factory()->superAdmin()->create(['password' => self::PASSWORD]);
    }

    /**
     * @param  list<string>  $targets
     */
    private function deleteScoped(
        User $user,
        array $targets,
        string $confirmation,
        ?string $from = null,
        ?string $to = null,
    ): TestResponse {
        return $this->actingAs($user)->delete(route('server-settings.clear-records'), array_filter([
            'password' => self::PASSWORD,
            'confirmation' => $confirmation,
            'targets' => $targets,
            'date_from' => $from,
            'date_to' => $to,
        ], fn (mixed $value): bool => $value !== null));
    }

    private function policy(): DomainPolicy
    {
        return DomainPolicy::create([
            'domain' => 'purge-fixture.example',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'risk_score' => 90,
        ]);
    }

    private function visit(DomainPolicy $policy, string $visitedAt): DomainVisit
    {
        return DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => $policy->domain,
            'status' => 'unsafe',
            'visited_at' => Carbon::parse($visitedAt),
        ]);
    }

    private function egress(string $occurredAt): EgressEvent
    {
        return EgressEvent::create([
            'domain' => 'purge-fixture.example',
            'user_id' => 'purge-fixture-user',
            'file_name' => 'payroll.xlsx',
            'action' => 'denied',
            'risk_score' => 90,
            'occurred_at' => Carbon::parse($occurredAt),
        ]);
    }

    private function notification(string $occurredAt): Notification
    {
        return Notification::create([
            'source' => 'egress',
            'type' => 'Egress Event Detected',
            'domain' => 'purge-fixture.example',
            'status' => 'glass-unlisted',
            'message' => 'purge-fixture-'.$occurredAt,
            'occurred_at' => Carbon::parse($occurredAt),
        ]);
    }

    private function extensionLifecycle(User $user, string $occurredAt): ExtensionLifecycle
    {
        return ExtensionLifecycle::create([
            'user_id' => (string) $user->id,
            'extension_id' => 'purge-fixture-extension',
            'event' => 'installed',
            'version' => '1.0.0',
            'occurred_at' => Carbon::parse($occurredAt),
        ]);
    }

    private function loginActivity(User $user, string $createdAt): LoginActivity
    {
        $activity = LoginActivity::create([
            'user_id' => $user->id,
            'email' => $user->email,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Purge Fixture Agent',
            'type' => 'login',
        ]);

        $activity->created_at = Carbon::parse($createdAt);
        $activity->save();

        return $activity;
    }

    private function auditLog(User $user, DomainPolicy $policy, string $occurredAt): AuditLog
    {
        return AuditLog::create([
            'auditable_type' => DomainPolicy::class,
            'auditable_id' => $policy->id,
            'action' => 'created',
            'user_id' => $user->id,
            'user_email' => $user->email,
            'occurred_at' => Carbon::parse($occurredAt),
        ]);
    }
}
