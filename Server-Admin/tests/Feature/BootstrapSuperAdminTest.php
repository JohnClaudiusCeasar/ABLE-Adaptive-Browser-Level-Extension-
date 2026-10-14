<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BootstrapSuperAdminTest extends TestCase
{
    use RefreshDatabase;

    private function expectedEmail(): string
    {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'localhost';

        return 'able-superadmin@'.$host;
    }

    public function test_it_creates_a_super_admin_using_the_app_url_domain()
    {
        config(['able.bootstrap_superadmin_password' => 'Rotated-9876!']);

        $this->artisan('app:bootstrap-superadmin')->assertExitCode(0);

        $user = User::where('email', $this->expectedEmail())->firstOrFail();

        $this->assertSame('superadmin', $user->role);
        $this->assertFalse((bool) $user->is_blocked);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Hash::check('Rotated-9876!', $user->password));
    }

    public function test_the_bootstrap_account_can_log_in()
    {
        config(['able.bootstrap_superadmin_password' => 'Rotated-9876!']);

        $this->artisan('app:bootstrap-superadmin')->assertExitCode(0);

        $response = $this->post('/login', [
            'email' => $this->expectedEmail(),
            'password' => 'Rotated-9876!',
        ]);

        $response->assertRedirect();
        $this->assertAuthenticated();
    }

    public function test_it_is_idempotent()
    {
        config(['able.bootstrap_superadmin_password' => 'Rotated-9876!']);

        $this->artisan('app:bootstrap-superadmin')->assertExitCode(0);
        $this->artisan('app:bootstrap-superadmin')->assertExitCode(0);

        $this->assertSame(1, User::where('email', $this->expectedEmail())->count());
    }

    public function test_it_repairs_a_demoted_and_blocked_account()
    {
        config(['able.bootstrap_superadmin_password' => 'Rotated-9876!']);

        $user = User::factory()->create([
            'email' => $this->expectedEmail(),
            'role' => 'admin',
            'is_blocked' => true,
        ]);

        $this->artisan('app:bootstrap-superadmin')->assertExitCode(0);

        $user->refresh();

        $this->assertSame('superadmin', $user->role);
        $this->assertFalse((bool) $user->is_blocked);
    }

    public function test_the_environment_password_is_the_source_of_truth()
    {
        config(['able.bootstrap_superadmin_password' => 'First-Password-1!']);

        $this->artisan('app:bootstrap-superadmin')->assertExitCode(0);

        $user = User::where('email', $this->expectedEmail())->firstOrFail();
        $user->update(['password' => 'Changed-2222!']);
        $this->assertTrue(Hash::check('Changed-2222!', $user->fresh()->password));

        // Re-running restores the environment value, so a rotated or lost
        // password is recovered by changing the variable alone.
        $this->artisan('app:bootstrap-superadmin')->assertExitCode(0);

        $this->assertTrue(Hash::check('First-Password-1!', $user->fresh()->password));
    }

    public function test_the_account_is_inert_until_a_password_is_configured()
    {
        config(['able.bootstrap_superadmin_password' => null]);

        $this->artisan('app:bootstrap-superadmin')->assertExitCode(0);

        $user = User::where('email', $this->expectedEmail())->firstOrFail();

        // The role exists so the module cannot deadlock, but nobody can sign
        // in as it because no credential is stored anywhere.
        $this->assertSame('superadmin', $user->role);
        $this->assertFalse(Hash::check('Able@dmin123', $user->password));

        $this->post('/login', [
            'email' => $this->expectedEmail(),
            'password' => 'Able@dmin123',
        ]);

        $this->assertGuest();
    }

    public function test_no_password_default_is_hardcoded_in_config()
    {
        $source = file_get_contents(base_path('config/able.php'));

        $this->assertMatchesRegularExpression(
            "/'bootstrap_superadmin_password'\s*=>\s*env\('BOOTSTRAP_SUPERADMIN_PASSWORD'\),/",
            $source,
            'config/able.php must not supply a default password to env()',
        );
    }

    public function test_the_email_can_be_overridden()
    {
        $this->artisan('app:bootstrap-superadmin', ['--email' => 'Rescue@example.com'])
            ->assertExitCode(0);

        $this->assertDatabaseHas('users', [
            'email' => 'rescue@example.com',
            'role' => 'superadmin',
        ]);
    }

    public function test_an_invalid_email_is_rejected()
    {
        $this->artisan('app:bootstrap-superadmin', ['--email' => 'not-an-email'])
            ->assertExitCode(1);

        $this->assertSame(0, User::count());
    }
}
