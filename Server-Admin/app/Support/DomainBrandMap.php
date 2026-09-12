<?php

namespace App\Support;

/**
 * In-memory lookup for the curated brand seed map.
 *
 * Matches exact domains first, then falls back to subdomain suffix
 * (e.g. music.youtube.com resolves via youtube.com).
 */
class DomainBrandMap
{
    /**
     * @var array<string, string>|null
     */
    private static ?array $map = null;

    public static function lookup(string $domain): ?string
    {
        $map = self::map();
        $domain = strtolower($domain);

        if (isset($map[$domain])) {
            return $map[$domain];
        }

        foreach ($map as $brand => $category) {
            if (str_ends_with($domain, '.'.$brand)) {
                return $category;
            }
        }

        return null;
    }

    /**
     * @return array<string, string>
     */
    private static function map(): array
    {
        if (self::$map === null) {
            /** @var array<string, string> $brands */
            $brands = config('domain_brands', []);
            self::$map = $brands;
        }

        return self::$map;
    }
}
