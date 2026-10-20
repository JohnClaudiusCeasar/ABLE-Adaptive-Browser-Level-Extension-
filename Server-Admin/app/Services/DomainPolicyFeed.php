<?php

namespace App\Services;

use App\Models\DomainPolicy;
use App\Support\JsCanonical;
use Illuminate\Support\Facades\Cache;

/**
 * Builds and caches the domain-policy feed the browser extension polls.
 *
 * The extension refreshes this feed every 15 minutes from every installed
 * copy, so the server used to read every policy, canonicalize the whole set
 * and sign it once per client per interval. The built bodies are cached and
 * rebuilt only when a policy changes in a way the extension can see.
 *
 * The feed is assembled incrementally: each policy is encoded on its own and
 * the JSON is concatenated. The collection therefore never has to exist as a
 * single PHP array, which matters because the array form of a large policy
 * set costs several times more memory than the JSON it encodes to.
 */
class DomainPolicyFeed
{
    public const CACHE_KEY = 'able:extension:domain-policy-feed';

    /**
     * The cached feed, with the response body and ETag for each variant.
     *
     * @return array{signed: array{body: string, etag: string}, unsigned: array{body: string, etag: string}}
     */
    public function feed(): array
    {
        return Cache::store($this->store())
            ->remember(self::CACHE_KEY, $this->ttl(), fn (): array => $this->build());
    }

    /**
     * Drop the cached feed so the next read rebuilds it from the database.
     */
    public function forget(): void
    {
        Cache::store($this->store())->forget(self::CACHE_KEY);
    }

    /**
     * The fields the extension reads from a policy.
     *
     * @return list<string>
     */
    public function fields(): array
    {
        return array_values((array) config('able.feed_fields', []));
    }

    /**
     * Whether a set of changed attributes affects what the extension sees.
     *
     * The volatile columns — the visit counter and the last-visit stamp — are
     * deliberately not part of the feed, so logging a visit does not change
     * the feed and must not invalidate it.
     *
     * @param  array<string, mixed>  $changes
     */
    public function affectsFeed(array $changes): bool
    {
        foreach (array_keys($changes) as $attribute) {
            if (in_array($attribute, $this->fields(), true)) {
                return true;
            }
        }

        return false;
    }

    private function store(): string
    {
        return (string) config('able.feed_cache_store', 'file');
    }

    private function ttl(): int
    {
        return max(60, (int) config('able.feed_cache_ttl', 3600));
    }

    /**
     * @return array{signed: array{body: string, etag: string}, unsigned: array{body: string, etag: string}}
     */
    private function build(): array
    {
        $fields = $this->fields();

        // The list is built in place rather than concatenated from a second
        // copy: the feed is the largest string the server holds, and each
        // extra copy of it is another few megabytes of peak memory.
        $list = '[';
        $count = 0;

        foreach (DomainPolicy::query()->lazy() as $policy) {
            $row = [];

            foreach ($fields as $field) {
                $row[$field] = $policy->{$field};
            }

            if ($count > 0) {
                $list .= ',';
            }

            $count++;
            $list .= JsCanonical::encode($row);
        }

        $list .= ']';

        $unsigned = JsCanonical::assemble([
            'count' => (string) $count,
            'policies' => $list,
        ]);

        $key = config('able.signing_key');

        if (! is_string($key) || strlen($key) < 32) {
            // Without a signing key the signed feed cannot be produced. The
            // unsigned feed still can, so it is built and the signed endpoint
            // reports the misconfiguration.
            return [
                'signed' => ['body' => '', 'etag' => ''],
                'unsigned' => ['body' => $unsigned, 'etag' => $this->etag($unsigned)],
            ];
        }

        $canonical = JsCanonical::assemble([
            'issued_at' => (string) now()->timestamp,
            'policies' => $list,
        ]);

        $signature = JsCanonical::signRaw($canonical, $key);

        $signed = '{"payload":'.$canonical.',"signature":"'.$signature.'","key_version":'.(int) config('able.signing_key_version', 1).'}';

        return [
            'signed' => ['body' => $signed, 'etag' => $this->etag($signed)],
            'unsigned' => ['body' => $unsigned, 'etag' => $this->etag($unsigned)],
        ];
    }

    private function etag(string $body): string
    {
        return '"'.sha1($body).'"';
    }
}
