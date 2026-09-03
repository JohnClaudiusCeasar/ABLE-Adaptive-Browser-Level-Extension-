<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class ComputeExtensionFingerprint extends Command
{
    /**
     * Compute SHA-256 fingerprints of all extension JavaScript and CSS files
     * so IT admins can verify the deployed extension matches the audited build.
     *
     * Usage:
     *   php artisan able:fingerprint ../Client-Extension
     */
    protected $signature = 'able:fingerprint {path=../Client-Extension : Path to Client-Extension directory}';

    protected $description = 'Compute SHA-256 fingerprints of all ABLE extension source files';

    public function handle(): int
    {
        $base = rtrim($this->argument('path'), '/\\');
        if (! File::isDirectory($base)) {
            $this->error("Directory not found: {$base}");

            return self::FAILURE;
        }

        $files = [
            'manifest.json',
            'background.js',
            'content.js',
            'inject.js',
            'api.js',
            'security.js',
            'config.js',
            'office-parser.js',
            'popup.js',
            'content.css',
            'popup.css',
            'popup.html',
        ];

        $this->info("ABLE Extension Fingerprints ({$base})");
        $this->line(str_repeat('─', 70));

        $allOk = true;
        foreach ($files as $relative) {
            $absolute = $base.DIRECTORY_SEPARATOR.$relative;
            if (! File::exists($absolute)) {
                $this->line(sprintf('%-22s MISSING', $relative));
                $allOk = false;

                continue;
            }
            $hash = hash_file('sha256', $absolute);
            $this->line(sprintf('%-22s %s', $relative, $hash));
        }

        $this->line(str_repeat('─', 70));
        $this->info('Copy these hashes into your IT asset register.');
        $this->info('Run `able:fingerprint` after every upgrade to confirm integrity.');

        // Compute a combined fingerprint over all files in deterministic order.
        $combined = '';
        foreach ($files as $relative) {
            $absolute = $base.DIRECTORY_SEPARATOR.$relative;
            if (File::exists($absolute)) {
                $combined .= $relative.':'.hash_file('sha256', $absolute)."\n";
            }
        }
        $this->line('');
        $this->info('Combined fingerprint: '.hash('sha256', $combined));

        return $allOk ? self::SUCCESS : self::FAILURE;
    }
}
