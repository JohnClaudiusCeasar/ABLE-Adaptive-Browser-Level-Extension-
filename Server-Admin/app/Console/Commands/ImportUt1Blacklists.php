<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\DomainPolicy;
use App\Services\AbleSettingsService;
use App\Services\DomainPolicyFeed;
use App\Support\Ut1CategoryMapper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Imports the UT1 categorized blacklists into the domain policies.
 *
 * The lists hold hundreds of thousands of domains, so the import is written
 * for a small server:
 *
 *  - The tarball is streamed to disk instead of being loaded into memory as
 *    a string, which happened twice: once for the response body and once
 *    for the file write.
 *  - Each category list is read line by line instead of being read into an
 *    array.
 *  - The domains are written in batches with a single upsert per batch
 *    instead of a SELECT and an INSERT or UPDATE per domain.
 *
 * The batch upsert bypasses the model events, so the import is recorded as
 * one audit row rather than one row per imported domain.
 */
class ImportUt1Blacklists extends Command
{
    /**
     * How many domains are written per statement.
     */
    private const BATCH_SIZE = 500;

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

        $tmpDir = sys_get_temp_dir().'/able-ut1-'.uniqid();
        $tarball = $tmpDir.'.tar.gz';

        if (! mkdir($tmpDir, 0755, true) && ! is_dir($tmpDir)) {
            $this->error('Could not create temp directory.');

            return self::FAILURE;
        }

        $this->info("Downloading UT1 blacklists from {$url} …");

        // Stream the archive straight to disk. Reading it into memory first
        // was the largest single allocation the command made.
        $response = Http::timeout(120)->sink($tarball)->get($url);

        if (! $response->successful()) {
            $this->error("Download failed with status {$response->status()}.");

            $this->removeDirectory($tmpDir);
            @unlink($tarball);

            return self::FAILURE;
        }

        $phar = new \PharData($tarball);
        $phar->extractTo($tmpDir, null, true);

        $dryRun = (bool) $this->option('dry-run');

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

            $result = $this->importCategory($domainsFile, $mapped, $dryRun);

            $created += $result['created'];
            $updated += $result['updated'];
            $skipped += $result['skipped'];
        }

        $this->removeDirectory($tmpDir);
        @unlink($tarball);

        $this->info("UT1 import done: {$created} created, {$updated} updated, {$skipped} skipped.");

        if (! $dryRun) {
            // The batch upsert bypasses the model events, so the cached
            // policy feed is dropped explicitly.
            app(DomainPolicyFeed::class)->forget();

            AuditLog::create([
                'auditable_type' => DomainPolicy::class,
                'auditable_id' => 0,
                'action' => 'imported',
                'user_id' => null,
                'user_email' => null,
                'data_changes' => json_encode([
                    'created' => $created,
                    'updated' => $updated,
                    'skipped' => $skipped,
                    'url' => $url,
                ]),
                'occurred_at' => now(),
            ]);
        }

        Cache::forever('ut1.last_import', [
            'ran_at' => now()->toIso8601String(),
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'url' => $url,
        ]);

        return self::SUCCESS;
    }

    /**
     * Import one category's domain list.
     *
     * @param  array{policy: string, category: string, risk_score: int}  $mapped
     * @return array{created: int, updated: int, skipped: int}
     */
    private function importCategory(string $domainsFile, array $mapped, bool $dryRun): array
    {
        $handle = fopen($domainsFile, 'rb');

        if ($handle === false) {
            return ['created' => 0, 'updated' => 0, 'skipped' => 0];
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $batch = [];

        // The list is read line by line: the category lists run to hundreds
        // of thousands of domains each.
        while (($line = fgets($handle)) !== false) {
            $domain = strtolower(trim($line));

            if ($domain === '' || str_starts_with($domain, '#')) {
                continue;
            }

            $batch[] = $domain;

            if (count($batch) >= self::BATCH_SIZE) {
                $result = $this->flushBatch($batch, $mapped, $dryRun);
                $created += $result['created'];
                $updated += $result['updated'];
                $skipped += $result['skipped'];
                $batch = [];
            }
        }

        fclose($handle);

        if ($batch !== []) {
            $result = $this->flushBatch($batch, $mapped, $dryRun);
            $created += $result['created'];
            $updated += $result['updated'];
            $skipped += $result['skipped'];
        }

        return ['created' => $created, 'updated' => $updated, 'skipped' => $skipped];
    }

    /**
     * Write one batch of domains.
     *
     * The existing policies are fetched with a single indexed lookup and
     * the batch is written with a single upsert, so a batch costs two
     * statements instead of two per domain.
     *
     * @param  list<string>  $domains
     * @param  array{policy: string, category: string, risk_score: int}  $mapped
     * @return array{created: int, updated: int, skipped: int}
     */
    private function flushBatch(array $domains, array $mapped, bool $dryRun): array
    {
        $existing = DomainPolicy::whereIn('domain', $domains)->get()->keyBy('domain');

        $rows = [];
        $created = 0;
        $updated = 0;
        $skipped = 0;

        foreach ($domains as $domain) {
            $policy = $existing->get($domain);

            if ($policy instanceof DomainPolicy) {
                if ($policy->classification_source === 'manual') {
                    $skipped++;

                    continue;
                }

                if ($policy->category !== null && $policy->classification_source !== null && $policy->classification_source !== 'pending') {
                    $skipped++;

                    continue;
                }

                $rows[] = [
                    'domain' => $domain,
                    'domain_status' => $policy->domain_status,
                    'policy' => $policy->policy === 'under_review' ? $mapped['policy'] : $policy->policy,
                    'category' => $mapped['category'],
                    'classification_source' => 'ut1',
                    'risk_score' => in_array($policy->risk_score, [70, 0], true) ? $mapped['risk_score'] : $policy->risk_score,
                    'visit_count' => $policy->visit_count,
                ];
                $updated++;

                continue;
            }

            $rows[] = [
                'domain' => $domain,
                'domain_status' => 'unlisted',
                'policy' => $mapped['policy'],
                'category' => $mapped['category'],
                'classification_source' => 'ut1',
                'risk_score' => $mapped['risk_score'],
                'visit_count' => 0,
            ];
            $created++;
        }

        if (! $dryRun && $rows !== []) {
            DomainPolicy::upsert($rows, ['domain'], [
                'domain_status',
                'policy',
                'category',
                'classification_source',
                'risk_score',
                'visit_count',
            ]);
        }

        return ['created' => $created, 'updated' => $updated, 'skipped' => $skipped];
    }

    /**
     * Remove the extracted archive directory.
     */
    private function removeDirectory(string $directory): void
    {
        if (! is_dir($directory)) {
            return;
        }

        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($items as $item) {
            if ($item->isDir()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }

        @rmdir($directory);
    }
}
