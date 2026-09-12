<?php

namespace App\Support;

/**
 * Maps Université Toulouse Capitole UT1 blacklist category names to the
 * ABLE taxonomy, with a suggested policy and risk score.
 *
 * UT1 ships pre-categorized domain lists (adult, gambling, phishing, …).
 * Unknown UT1 names fall back to null so the caller can skip the row.
 */
class Ut1CategoryMapper
{
    /**
     * @var array<string, array{category: string, policy: string, risk_score: int}>
     */
    private const MAP = [
        'adult' => ['category' => 'Adult', 'policy' => 'blacklisted', 'risk_score' => 95],
        'porn' => ['category' => 'Adult', 'policy' => 'blacklisted', 'risk_score' => 95],
        'sexual_education' => ['category' => 'Adult', 'policy' => 'under_review', 'risk_score' => 60],
        'gambling' => ['category' => 'Gambling', 'policy' => 'blacklisted', 'risk_score' => 90],
        'phishing' => ['category' => 'Technology', 'policy' => 'blacklisted', 'risk_score' => 95],
        'malware' => ['category' => 'Technology', 'policy' => 'blacklisted', 'risk_score' => 95],
        'cryptojacking' => ['category' => 'Technology', 'policy' => 'blacklisted', 'risk_score' => 90],
        'social_networks' => ['category' => 'Social Media', 'policy' => 'under_review', 'risk_score' => 50],
        'streaming' => ['category' => 'Streaming', 'policy' => 'under_review', 'risk_score' => 40],
        'audio-video' => ['category' => 'Streaming', 'policy' => 'under_review', 'risk_score' => 40],
        'games' => ['category' => 'Gaming', 'policy' => 'under_review', 'risk_score' => 40],
        'sports' => ['category' => 'Sports', 'policy' => 'under_review', 'risk_score' => 30],
        'news' => ['category' => 'News & Media', 'policy' => 'under_review', 'risk_score' => 30],
        'press' => ['category' => 'News & Media', 'policy' => 'under_review', 'risk_score' => 30],
        'shopping' => ['category' => 'Shopping', 'policy' => 'under_review', 'risk_score' => 50],
        'banking' => ['category' => 'Finance', 'policy' => 'under_review', 'risk_score' => 60],
        'finance' => ['category' => 'Finance', 'policy' => 'under_review', 'risk_score' => 60],
        'education' => ['category' => 'Education', 'policy' => 'under_review', 'risk_score' => 20],
        'health' => ['category' => 'Health', 'policy' => 'under_review', 'risk_score' => 40],
        'jobsearch' => ['category' => 'Jobs & Careers', 'policy' => 'under_review', 'risk_score' => 40],
        'dating' => ['category' => 'Social Media', 'policy' => 'under_review', 'risk_score' => 60],
        'travel' => ['category' => 'Travel', 'policy' => 'under_review', 'risk_score' => 30],
        'cooking' => ['category' => 'Food & Dining', 'policy' => 'under_review', 'risk_score' => 20],
        'real_estate' => ['category' => 'Real Estate', 'policy' => 'under_review', 'risk_score' => 30],
        'automobile' => ['category' => 'Automotive', 'policy' => 'under_review', 'risk_score' => 30],
        'filehosting' => ['category' => 'Cloud & Hosting', 'policy' => 'under_review', 'risk_score' => 60],
        'download' => ['category' => 'Cloud & Hosting', 'policy' => 'under_review', 'risk_score' => 60],
        'webmail' => ['category' => 'Email', 'policy' => 'under_review', 'risk_score' => 40],
        'blog' => ['category' => 'News & Media', 'policy' => 'under_review', 'risk_score' => 30],
        'forums' => ['category' => 'Social Media', 'policy' => 'under_review', 'risk_score' => 40],
        'chat' => ['category' => 'Social Media', 'policy' => 'under_review', 'risk_score' => 40],
    ];

    /**
     * @return array{category: string, policy: string, risk_score: int}|null
     */
    public static function map(string $ut1Category): ?array
    {
        $key = strtolower(trim($ut1Category));

        return self::MAP[$key] ?? null;
    }
}
