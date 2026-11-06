<?php

namespace App\Support;

/**
 * The hardcoded app-category taxonomy.
 *
 * This is the single source of truth for the category names the admin UIs
 * offer and the server validates against. Recommendation Policy is limited
 * to exactly these categories; Domain Policy still accepts custom text.
 */
final class AppCategories
{
    /**
     * @var list<string>
     */
    public const NAMES = [
        'Social Media',
        'Search Engine',
        'News & Media',
        'E-commerce',
        'Finance',
        'Education',
        'Government',
        'Health',
        'Technology',
        'AI',
        'Entertainment',
        'Gaming',
        'Sports',
        'Travel',
        'Food & Dining',
        'Real Estate',
        'Automotive',
        'Jobs & Careers',
        'Productivity',
        'Developer Tools',
        'Cloud & Hosting',
        'Email',
        'Streaming',
        'Gambling',
        'Adult',
        'Shopping',
        'Reference',
    ];

    /**
     * Categories that are never offered under ABLE Recommends.
     *
     * Recommending alternatives for these is not a workflow or
     * institutional-security improvement, so they stay out of the
     * Recommendation Policy page and the recommendation service.
     *
     * @var list<string>
     */
    public const RECOMMENDATION_EXCLUDED = [
        'Adult',
        'Gambling',
    ];

    /**
     * @var array<string, string>
     */
    public const DETAILS = [
        'Social Media' => 'Social networks, messaging, forums, and community platforms.',
        'Search Engine' => 'Web search providers and metasearch portals.',
        'News & Media' => 'News outlets, press, blogs, weather, and publishing.',
        'E-commerce' => 'Online stores with carts, checkout, and product listings.',
        'Finance' => 'Banks, payments, lending, trading, insurance, and billing.',
        'Education' => 'Schools, universities, courses, LMS, and research.',
        'Government' => 'Official government, municipal, and public-service sites.',
        'Health' => 'Hospitals, clinics, pharmacies, and medical information.',
        'Technology' => 'Software, hardware, gadgets, IT infrastructure, and tech news.',
        'AI' => 'Artificial intelligence platforms, LLMs, AI assistants, and generative tools.',
        'Entertainment' => 'Movies, music, celebrities, events, and fan content.',
        'Gaming' => 'Video games, storefronts, esports, and walkthroughs.',
        'Sports' => 'Leagues, teams, scores, and sports coverage.',
        'Travel' => 'Flights, hotels, bookings, maps, and ride-hailing.',
        'Food & Dining' => 'Restaurants, recipes, menus, and food delivery.',
        'Real Estate' => 'Property listings, rentals, and brokerage sites.',
        'Automotive' => 'Car makers, dealers, parts, and vehicle marketplaces.',
        'Jobs & Careers' => 'Job boards, hiring, resumes, and freelance gigs.',
        'Productivity' => 'Docs, calendars, notes, chat, meetings, and task tools.',
        'Developer Tools' => 'Code hosting, docs, SDKs, packages, and cloud dev platforms.',
        'Cloud & Hosting' => 'Hosting, domains, VPS, CDNs, and file hosting.',
        'Email' => 'Webmail providers and hosted inbox services.',
        'Streaming' => 'Video, music, and podcast streaming platforms.',
        'Gambling' => 'Casinos, betting, poker, lottery, and wagering.',
        'Adult' => 'Adult-only and explicit content sites.',
        'Shopping' => 'Deals, coupons, marketplaces, and price comparison.',
        'Reference' => 'Wikis, dictionaries, docs, manuals, and how-tos.',
    ];

    /**
     * @return list<string>
     */
    public static function names(): array
    {
        return self::NAMES;
    }

    /**
     * @return list<array{name: string, detail: string}>
     */
    public static function all(): array
    {
        return array_map(fn (string $name): array => [
            'name' => $name,
            'detail' => self::DETAILS[$name],
        ], self::NAMES);
    }

    /**
     * The categories an admin may configure under ABLE Recommends.
     *
     * @return list<string>
     */
    public static function recommendationNames(): array
    {
        return array_values(array_filter(
            self::NAMES,
            fn (string $name): bool => ! self::isExcludedFromRecommendations($name),
        ));
    }

    /**
     * The same list with the category descriptions.
     *
     * @return list<array{name: string, detail: string}>
     */
    public static function recommendable(): array
    {
        return array_values(array_filter(
            self::all(),
            fn (array $category): bool => ! self::isExcludedFromRecommendations($category['name']),
        ));
    }

    public static function isExcludedFromRecommendations(?string $name): bool
    {
        $key = strtolower(trim((string) $name));

        if ($key === '') {
            return false;
        }

        foreach (self::RECOMMENDATION_EXCLUDED as $excluded) {
            if (strtolower($excluded) === $key) {
                return true;
            }
        }

        return false;
    }
}
