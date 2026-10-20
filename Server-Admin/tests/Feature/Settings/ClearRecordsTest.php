<?php

namespace Tests\Feature\Settings;

use App\Models\AbleSetting;
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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ClearRecordsTest extends TestCase
{
    use RefreshDatabase;

    private const CONFIRMATION_PHRASE = 'DELETE ALL';

    private const PASSWORD = 'purge-fixture-password';

    public function test_super_admin_can_clear_all_records(): void
    {
        $user = User::factory()->superAdmin()->create(['password' => self::PASSWORD]);
        $this->seedRecords($user);

        $response = $this->actingAs($user)->delete(route('server-settings.clear-records'), [
            'password' => self::PASSWORD,
            'confirmation' => self::CONFIRMATION_PHRASE,
        ]);

        $response->assertRedirect(route('server-settings.edit'));
        $response->assertSessionHasNoErrors();

        $this->assertRecordTablesAreEmpty();
    }

    public function test_clear_records_keeps_accounts_and_settings(): void
    {
        $user = User::factory()->superAdmin()->create(['password' => self::PASSWORD]);
        $other = User::factory()->create();
        $this->seedRecords($user);

        AbleSetting::create([
            'group' => 'server',
            'key' => 'algorithm.default_risk_score',
            'value' => 55,
            'updated_by' => $user->id,
        ]);

        $this->actingAs($user)->delete(route('server-settings.clear-records'), [
            'password' => self::PASSWORD,
            'confirmation' => self::CONFIRMATION_PHRASE,
        ])->assertRedirect(route('server-settings.edit'));

        $this->assertDatabaseHas('users', ['id' => $user->id]);
        $this->assertDatabaseHas('users', ['id' => $other->id]);
        $this->assertDatabaseHas('able_settings', [
            'group' => 'server',
            'key' => 'algorithm.default_risk_score',
        ]);
    }

    public function test_clear_records_removes_soft_deleted_notifications(): void
    {
        $user = User::factory()->superAdmin()->create(['password' => self::PASSWORD]);
        $this->seedRecords($user);

        // The fixture leaves one live and one already soft deleted notification.
        $this->assertSame(1, Notification::count());
        $this->assertSame(2, Notification::withTrashed()->count());

        $this->actingAs($user)->delete(route('server-settings.clear-records'), [
            'password' => self::PASSWORD,
            'confirmation' => self::CONFIRMATION_PHRASE,
        ])->assertRedirect(route('server-settings.edit'));

        // The rows are physically gone, not just flagged.
        $this->assertSame(0, Notification::withTrashed()->count());
        $this->assertSame(0, DB::table('notifications')->count());
    }

    public function test_clear_records_leaves_no_audit_trail(): void
    {
        $user = User::factory()->superAdmin()->create(['password' => self::PASSWORD]);
        $this->seedRecords($user);

        $this->assertGreaterThan(0, AuditLog::count());

        $this->actingAs($user)->delete(route('server-settings.clear-records'), [
            'password' => self::PASSWORD,
            'confirmation' => self::CONFIRMATION_PHRASE,
        ])->assertRedirect(route('server-settings.edit'));

        $this->assertSame(0, AuditLog::count());
    }

    public function test_clear_records_requires_the_correct_password(): void
    {
        $user = User::factory()->superAdmin()->create(['password' => self::PASSWORD]);
        $this->seedRecords($user);

        $response = $this->actingAs($user)->delete(route('server-settings.clear-records'), [
            'password' => 'not-the-password',
            'confirmation' => self::CONFIRMATION_PHRASE,
        ]);

        $response->assertSessionHasErrors('password');
        $this->assertRecordTablesAreNotEmpty();
    }

    public function test_clear_records_requires_the_confirmation_phrase(): void
    {
        $user = User::factory()->superAdmin()->create(['password' => self::PASSWORD]);
        $this->seedRecords($user);

        $response = $this->actingAs($user)->delete(route('server-settings.clear-records'), [
            'password' => self::PASSWORD,
        ]);

        $response->assertSessionHasErrors('confirmation');
        $this->assertRecordTablesAreNotEmpty();
    }

    #[DataProvider('invalidConfirmationPhrases')]
    public function test_clear_records_rejects_a_mismatched_phrase(string $phrase): void
    {
        $user = User::factory()->superAdmin()->create(['password' => self::PASSWORD]);
        $this->seedRecords($user);

        $response = $this->actingAs($user)->delete(route('server-settings.clear-records'), [
            'password' => self::PASSWORD,
            'confirmation' => $phrase,
        ]);

        $response->assertSessionHasErrors('confirmation');
        $this->assertRecordTablesAreNotEmpty();
    }

    /**
     * @return array<string, array<int, string>>
     */
    public static function invalidConfirmationPhrases(): array
    {
        return [
            'wrong phrase' => ['delete all'],
            'different casing' => ['Delete All'],
            'single word' => ['DELETE'],
            'empty' => [''],
        ];
    }

    public function test_clear_records_accepts_a_phrase_padded_with_whitespace(): void
    {
        // Laravel trims incoming strings before validation, so surrounding
        // whitespace does not stop the phrase from matching.
        $user = User::factory()->superAdmin()->create(['password' => self::PASSWORD]);
        $this->seedRecords($user);

        $this->actingAs($user)->delete(route('server-settings.clear-records'), [
            'password' => self::PASSWORD,
            'confirmation' => ' DELETE ALL ',
        ])->assertRedirect(route('server-settings.edit'));

        $this->assertRecordTablesAreEmpty();
    }

    public function test_admin_without_settings_access_is_forbidden(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'password' => self::PASSWORD]);
        $this->seedRecords($admin);

        $response = $this->actingAs($admin)->delete(route('server-settings.clear-records'), [
            'password' => self::PASSWORD,
            'confirmation' => self::CONFIRMATION_PHRASE,
        ]);

        $response->assertForbidden();
        $this->assertRecordTablesAreNotEmpty();
    }

    public function test_guests_are_redirected_from_clearing_records(): void
    {
        $response = $this->delete(route('server-settings.clear-records'), [
            'password' => self::PASSWORD,
            'confirmation' => self::CONFIRMATION_PHRASE,
        ]);

        $response->assertRedirect(route('login'));
    }

    public function test_server_settings_page_exposes_the_record_counts(): void
    {
        $user = User::factory()->superAdmin()->create();
        $this->seedRecords($user);

        $response = $this->actingAs($user)->get(route('server-settings.edit'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->has('status.record_counts')
            ->where('status.record_counts.0.key', 'criteria_pattern_items')
            ->where('status.record_counts.0.count', 1)
            // The preview counts the already soft deleted notification too.
            ->where('status.record_counts.8.key', 'notifications')
            ->where('status.record_counts.8.count', 2)
        );
    }

    /**
     * Create one record in every table the purge is responsible for.
     */
    private function seedRecords(User $user): void
    {
        $other = User::factory()->create();

        $policy = DomainPolicy::create([
            'domain' => 'purge-fixture.example',
            'domain_status' => 'unsafe',
            'policy' => 'blacklisted',
            'risk_score' => 90,
        ]);

        DomainVisit::create([
            'domain_policy_id' => $policy->id,
            'domain' => $policy->domain,
            'status' => 'unsafe',
            'visited_at' => now(),
        ]);

        $riskPattern = RiskPattern::create([
            'title' => 'Purge fixture criteria',
            'type' => 'criteria',
            'score' => 50,
            'priority' => 'medium',
        ]);

        CriteriaPatternItem::create([
            'criteria_pattern_id' => $riskPattern->id,
            'title' => 'Purge fixture item',
            'regex' => '/purge-fixture/',
            'score' => 10,
        ]);

        $egress = EgressEvent::create([
            'domain' => 'purge-fixture.example',
            'user_id' => (string) $user->id,
            'file_name' => 'payroll.xlsx',
            'action' => 'denied',
            'risk_score' => 90,
            'occurred_at' => now(),
        ]);

        NudgeInteraction::create([
            'egress_event_id' => $egress->id,
            'domain' => 'purge-fixture.example',
            'user_id' => (string) $user->id,
            'user_action' => 'cancelled',
            'interacted_at' => now(),
        ]);

        $conversation = ChatConversation::forPair($user, $other);

        ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'body' => 'Purge fixture message',
        ]);

        Notification::create([
            'source' => 'egress',
            'type' => 'Egress Event Detected',
            'domain' => 'purge-fixture.example',
            'status' => 'glass-unlisted',
            'message' => 'purge-fixture-live',
            'occurred_at' => now(),
        ]);

        // A notification that was already soft deleted, so the purge has to
        // remove the trashed rows as well as the live ones.
        Notification::create([
            'source' => 'egress',
            'type' => 'Egress Event Detected',
            'domain' => 'purge-fixture.example',
            'status' => 'glass-unlisted',
            'message' => 'purge-fixture-trashed',
            'occurred_at' => now(),
        ])->delete();

        CommunityMessage::create([
            'author' => 'Purge Fixture',
            'category' => 'comment',
            'message' => 'Purge fixture feedback',
            'ip_address' => '127.0.0.1',
            'status' => 'approved',
        ]);

        ExtensionLifecycle::create([
            'user_id' => (string) $user->id,
            'extension_id' => 'purge-fixture-extension',
            'event' => 'installed',
            'version' => '1.0.0',
            'occurred_at' => now(),
        ]);

        LoginActivity::create([
            'user_id' => $user->id,
            'email' => $user->email,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Purge Fixture Agent',
            'type' => 'login',
        ]);

        AuditLog::create([
            'auditable_type' => DomainPolicy::class,
            'auditable_id' => $policy->id,
            'action' => 'created',
            'user_id' => $user->id,
            'user_email' => $user->email,
            'occurred_at' => now(),
        ]);
    }

    private function assertRecordTablesAreEmpty(): void
    {
        $this->assertSame(0, CriteriaPatternItem::count());
        $this->assertSame(0, RiskPattern::count());
        $this->assertSame(0, DomainVisit::count());
        $this->assertSame(0, DomainPolicy::count());
        $this->assertSame(0, NudgeInteraction::count());
        $this->assertSame(0, EgressEvent::count());
        $this->assertSame(0, ChatMessage::count());
        $this->assertSame(0, ChatConversation::count());
        $this->assertSame(0, Notification::withTrashed()->count());
        $this->assertSame(0, CommunityMessage::count());
        $this->assertSame(0, ExtensionLifecycle::count());
        $this->assertSame(0, LoginActivity::count());
        $this->assertSame(0, AuditLog::count());
    }

    private function assertRecordTablesAreNotEmpty(): void
    {
        $this->assertGreaterThan(0, DomainPolicy::count());
        $this->assertGreaterThan(0, RiskPattern::count());
        $this->assertGreaterThan(0, DomainVisit::count());
        $this->assertGreaterThan(0, EgressEvent::count());
        $this->assertGreaterThan(0, Notification::withTrashed()->count());
        $this->assertGreaterThan(0, AuditLog::count());
    }
}
