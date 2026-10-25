<?php

namespace Tests\Feature;

use App\Models\AbleSetting;
use App\Models\ExtensionLifecycle;
use App\Services\AbleSettingsService;
use App\Support\AbleSettingsSchema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class PublishExtensionReleaseTest extends TestCase
{
    use RefreshDatabase;

    private string $extensionPath;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extensionPath = sys_get_temp_dir().'/able-extension-'.uniqid();

        File::ensureDirectoryExists($this->extensionPath.'/inject');
        File::ensureDirectoryExists($this->extensionPath.'/core');

        foreach ([
            'inject/inject.js',
            'content.css',
            'core/synthetic-names.js',
            'core/file-identity.js',
            'inject/file-extractor.js',
            'inject/network-interceptor.js',
            'inject/file-tracker.js',
        ] as $asset) {
            File::put($this->extensionPath.'/'.$asset, "// {$asset}");
        }
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->extensionPath);

        parent::tearDown();
    }

    public function test_it_publishes_the_version_declared_by_the_manifest(): void
    {
        File::put($this->extensionPath.'/manifest.json', json_encode(['version' => '1.4.2']));

        $this->artisan('able:publish-integrity', ['path' => $this->extensionPath])
            ->assertSuccessful();

        $this->assertDatabaseHas('able_settings', [
            'group' => 'extension',
            'key' => 'release.extension_version',
        ]);

        $this->assertSame(
            '1.4.2',
            AbleSetting::where('key', 'release.extension_version')->first()->value,
        );
    }

    public function test_it_publishes_the_integrity_pins_alongside_the_version(): void
    {
        File::put($this->extensionPath.'/manifest.json', json_encode(['version' => '2.0.0']));

        $this->artisan('able:publish-integrity', ['path' => $this->extensionPath])
            ->assertSuccessful();

        $inject = AbleSetting::where('key', 'integrity.expected_inject_hash')->first();
        $css = AbleSetting::where('key', 'integrity.expected_content_css_hash')->first();

        $this->assertSame(hash_file('sha256', $this->extensionPath.'/inject/inject.js'), $inject->value);
        $this->assertSame(hash_file('sha256', $this->extensionPath.'/content.css'), $css->value);
    }

    public function test_it_publishes_a_pin_for_every_executable_asset(): void
    {
        File::put($this->extensionPath.'/manifest.json', json_encode(['version' => '2.0.0']));

        $this->artisan('able:publish-integrity', ['path' => $this->extensionPath])
            ->assertSuccessful();

        $expected = [
            'integrity.expected_inject_hash' => 'inject/inject.js',
            'integrity.expected_content_css_hash' => 'content.css',
            'integrity.expected_synthetic_names_hash' => 'core/synthetic-names.js',
            'integrity.expected_file_extractor_hash' => 'inject/file-extractor.js',
            'integrity.expected_network_interceptor_hash' => 'inject/network-interceptor.js',
            'integrity.expected_file_tracker_hash' => 'inject/file-tracker.js',
        ];

        foreach ($expected as $key => $asset) {
            $this->assertDatabaseHas('able_settings', [
                'group' => 'extension',
                'key' => $key,
            ]);

            $this->assertSame(
                hash_file('sha256', $this->extensionPath.'/'.$asset),
                AbleSetting::where('key', $key)->first()->value,
                "Pin for {$asset} was not published correctly.",
            );
        }
    }

    public function test_a_dry_run_publishes_nothing(): void
    {
        File::put($this->extensionPath.'/manifest.json', json_encode(['version' => '3.1.0']));

        $this->artisan('able:publish-integrity', [
            'path' => $this->extensionPath,
            '--dry-run' => true,
        ])->assertSuccessful();

        $this->assertDatabaseMissing('able_settings', [
            'key' => 'release.extension_version',
        ]);
    }

    public function test_it_fails_when_the_manifest_is_missing(): void
    {
        $this->artisan('able:publish-integrity', ['path' => $this->extensionPath])
            ->assertFailed();

        $this->assertDatabaseMissing('able_settings', [
            'key' => 'release.extension_version',
        ]);
    }

    public function test_it_fails_when_the_manifest_declares_no_usable_version(): void
    {
        File::put($this->extensionPath.'/manifest.json', json_encode(['name' => 'ABLE']));

        $this->artisan('able:publish-integrity', ['path' => $this->extensionPath])
            ->assertFailed();

        $this->assertDatabaseMissing('able_settings', [
            'key' => 'release.extension_version',
        ]);
    }

    public function test_it_fails_when_the_manifest_version_is_not_a_version(): void
    {
        File::put($this->extensionPath.'/manifest.json', json_encode(['version' => 'latest']));

        $this->artisan('able:publish-integrity', ['path' => $this->extensionPath])
            ->assertFailed();

        $this->assertDatabaseMissing('able_settings', [
            'key' => 'release.extension_version',
        ]);
    }

    public function test_the_published_version_is_shared_with_the_admin_panel(): void
    {
        app(AbleSettingsService::class)->put(
            AbleSettingsService::GROUP_EXTENSION,
            'release.extension_version',
            '1.4.2',
        );

        $response = $this->get('/');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('extension_version', '1.4.2')
        );
    }

    public function test_every_published_pin_has_a_schema_entry(): void
    {
        $schemaKeys = collect(AbleSettingsSchema::group(AbleSettingsService::GROUP_EXTENSION))
            ->keys()
            ->filter(fn (string $key) => str_starts_with($key, 'integrity.'))
            ->sort()
            ->values()
            ->all();

        $publishedKeys = collect(AbleSettingsSchema::integrityPinFiles())
            ->keys()
            ->sort()
            ->values()
            ->all();

        $this->assertSame(
            $publishedKeys,
            $schemaKeys,
            'A published integrity pin has no matching settings schema entry.',
        );
    }

    public function test_the_server_pins_the_same_assets_as_the_extension_build(): void
    {
        $extensionPath = base_path('../Client-Extension');

        if (! File::isDirectory($extensionPath)) {
            $this->markTestSkipped('The extension source is not deployed next to the server.');
        }

        $targets = File::get($extensionPath.'/scripts/hash-targets.js');
        preg_match_all('/\{ file: "([^"]+)", key: "([^"]+)" \}/', $targets, $matches);

        $extensionFiles = $matches[1];
        $serverFiles = array_values(AbleSettingsSchema::integrityPinFiles());

        sort($extensionFiles);
        sort($serverFiles);

        $this->assertSame(
            $serverFiles,
            $extensionFiles,
            'The server and the extension pin different assets, so a signed pin would never reach the extension.',
        );
    }

    public function test_the_shared_version_falls_back_to_the_configured_version(): void
    {
        // Nothing published and no client has reported in yet, so the panel
        // falls back to the configured value rather than showing no version.
        $response = $this->get('/');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('extension_version', (string) config('able.extension_version'))
        );

        $this->assertNotSame('', (string) config('able.extension_version'));
    }

    public function test_the_shared_version_falls_back_to_the_version_an_extension_reported(): void
    {
        ExtensionLifecycle::create([
            'user_id' => 'client-1',
            'extension_id' => 'extension-1',
            'event' => 'installed',
            'version' => '2.3.4',
            'occurred_at' => now(),
        ]);

        $response = $this->get('/');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('extension_version', '2.3.4')
        );
    }

    public function test_the_published_version_wins_over_a_reported_version(): void
    {
        app(AbleSettingsService::class)->put(
            AbleSettingsService::GROUP_EXTENSION,
            'release.extension_version',
            '1.4.2',
        );

        ExtensionLifecycle::create([
            'user_id' => 'client-1',
            'extension_id' => 'extension-1',
            'event' => 'installed',
            'version' => '2.3.4',
            'occurred_at' => now(),
        ]);

        $response = $this->get('/');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('extension_version', '1.4.2')
        );
    }
}
