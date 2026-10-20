<?php

namespace App\Console\Commands;

use App\Services\AbleSettingsService;
use App\Support\AbleSettingsSchema;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Publish what the server needs to know about a built extension: the SHA-256
 * integrity pins of its web-accessible resources and the version it declares.
 *
 * The pins are written into the extension settings group, which the server
 * hands out inside the HMAC-signed runtime payload. Because the extension
 * only accepts a pin that arrives with a valid signature, an attacker cannot
 * use this channel to make a tampered asset pass the integrity check — but a
 * legitimate new build can be pinned without asking every user to reinstall.
 *
 * The version is published the same way so the admin panel can show the
 * version of the build that is actually deployed instead of a number that has
 * to be maintained by hand.
 */
class PublishExtensionIntegrity extends Command
{
    /**
     * The settings key the extension version is published under.
     */
    private const VERSION_KEY = 'release.extension_version';

    /**
     * Chrome accepts one to four dot separated integers as a version.
     */
    private const VERSION_PATTERN = '/^\d{1,5}(\.\d{1,5}){0,3}$/';

    /**
     * Usage:
     *   php artisan able:publish-integrity ../Client-Extension
     */
    protected $signature = 'able:publish-integrity
        {path=../Client-Extension : Path to the built Client-Extension directory}
        {--dry-run : Show the hashes without storing them}';

    protected $description = 'Publish the SHA-256 integrity pins and the version of a built extension into the signed runtime payload';

    public function handle(AbleSettingsService $settings): int
    {
        $base = rtrim($this->argument('path'), '/\\');

        if (! File::isDirectory($base)) {
            $this->error("Directory not found: {$base}");

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $hashes = [];

        foreach (AbleSettingsSchema::integrityPinFiles() as $key => $relative) {
            $absolute = $base.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relative);

            if (! File::exists($absolute)) {
                $this->error("Asset not found: {$absolute}");

                return self::FAILURE;
            }

            $hashes[$key] = hash_file('sha256', $absolute);
        }

        $version = $this->readVersion($base);

        if ($version === null) {
            return self::FAILURE;
        }

        $this->info("ABLE extension release ({$base})");
        $this->line(str_repeat('─', 70));

        foreach ($hashes as $key => $hash) {
            $this->line(sprintf('%-40s %s', $key, $hash));
        }

        $this->line(sprintf('%-40s %s', self::VERSION_KEY, $version));
        $this->line(str_repeat('─', 70));

        if ($dryRun) {
            $this->info('Dry run — nothing was stored.');

            return self::SUCCESS;
        }

        foreach ($hashes as $key => $hash) {
            $settings->put(AbleSettingsService::GROUP_EXTENSION, $key, $hash);
        }

        $settings->put(AbleSettingsService::GROUP_EXTENSION, self::VERSION_KEY, $version);

        $this->info('Release published. The next signed runtime payload carries it.');
        $this->line('The admin panel now shows this version in the sidebar');

        return self::SUCCESS;
    }

    /**
     * Read the version the built extension declares in its manifest.
     */
    private function readVersion(string $base): ?string
    {
        $manifestPath = $base.DIRECTORY_SEPARATOR.'manifest.json';

        if (! File::exists($manifestPath)) {
            $this->error("Manifest not found: {$manifestPath}");

            return null;
        }

        $manifest = json_decode((string) File::get($manifestPath), true);
        $version = is_array($manifest) ? ($manifest['version'] ?? null) : null;

        if (! is_string($version) || ! preg_match(self::VERSION_PATTERN, $version)) {
            $this->error("Manifest does not declare a usable version: {$manifestPath}");

            return null;
        }

        return $version;
    }
}
