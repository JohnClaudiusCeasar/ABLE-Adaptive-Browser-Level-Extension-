<?php

namespace App\Console\Commands;

use App\Models\DomainPolicy;
use App\Services\AbleSettingsService;
use App\Support\Ut1CategoryMapper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class ImportUt1Blacklists extends Command
{
    protected $signature = 'able:import-ut1
        {--url= : Override the UT1 tarball URL}
        {--dry-run : List what would change without writing}';

    protected $description = 'Import UT1 categorized blacklists into domain policies (bulk, offline lists)';

    public function handle(): int
    {
        if (! (bool) app(AbleSettingsService::class)->value('server', 'ut1.sync_enabled', false)) {
            $this->error('UT1 sync is disabled. Enable ut1.sync_enabled in Server settings first.');

            return self::FAILURE;
        }

        $url = $this->option('url')
            ?? app(AbleSettingsService::class)->value('server', 'ut1.sync_url')
            ?? config('able.ut1_sync_url', 'http://dsi.ut-capitole.fr/blacklists/download/blacklists.tar.gz');

        $this->info("Downloading UT1 blacklists from {$url} …");

        $response = Http::timeout(120)->get($url);

        if (! $response->successful()) {
            $this->error("Download failed with status {$response->status()}.");

            return self::FAILURE;
        }

        $tmpDir = sys_get_temp_dir().'/able-ut1-'.uniqid();
        $tarball = $tmpDir.'.tar.gz';

        if (! mkdir($tmpDir, 0755, true) && ! is_dir($tmpDir)) {
            $this->error('Could not create temp directory.');

            return self::FAILURE;
        }

        file_put_contents($tarball, $response->body());

        $phar = new \PharData($tarball);
        $phar->extractTo($tmpDir, null, true);

        $created = 0;
        $updated = 0;
        $skipped = 0;

        foreach (glob($tmpDir.'/blacklists/*') ?: [] as $categoryDir) {
            if (! is_dir($categoryDir)) {
                continue;
            }

            $ut1Category = basename($categoryDir);
            $mapped = Ut1CategoryMapper::map($ut1Category);

            if ($mapped === null) {
                continue;
            }

            $domainsFile = $categoryDir.'/domains';

            if (! is_file($domainsFile)) {
                continue;
            }

            $domains = file($domainsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];

            foreach ($domains as $domain) {
                $domain = strtolower(trim($domain));

                if ($domain === '' || str_starts_with($domain, '#')) {
                    continue;
                }

                $existing = DomainPolicy::where('domain', $domain)->first();

                if ($existing) {
                    if ($existing->classification_source === 'manual') {
                        $skipped++;
                        continue;
                    }
                    if ($existing->category !== null && $existing->classification_source !== null && $existing->classification_source !== 'pending') {
                        $skipped++;
                        continue;
                    }

                    if ($this->option('dry-run')) {
                        $updated++;
                        continue;
                    }

                    $existing->update([
                        'policy' => $existing->policy === 'under_review' ? $mapped['policy'] : $existing->policy,
                        'category' => $mapped['category'],
                        'classification_source' => 'ut1',
                        'risk_score' => $existing->risk_score === 70 || $existing->risk_score === 0 ? $mapped['risk_score'] : $existing->risk_score,
                    ]);
                    $updated++;
                    continue;
                }

                if ($this->option('dry-run')) {
                    $created++;
                    continue;
                }

                DomainPolicy::create([
                    'domain' => $domain,
                    'domain_status' => 'unlisted',
                    'policy' => $mapped['policy'],
                    'category' => $mapped['category'],
                    'classification_source' => 'ut1',
                    'risk_score' => $mapped['risk_score'],
                    'visit_count' => 0,
                ]);
                $created++;
            }
        }

        $this->info("UT1 import done: {$created} created, {$updated} updated, {$skipped} skipped.");

        return self::SUCCESS;
    }
}
