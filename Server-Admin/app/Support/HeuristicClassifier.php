<?php

namespace App\Support;

/**
 * Heuristic auto-categorization for unlisted domains.
 *
 * Scores a fixed taxonomy against rich page signals supplied by the
 * extension: URL tokens (host parts, path segments), JSON-LD @type,
 * OpenGraph tags, anchor-text histogram, form signals, plus the legacy
 * title/meta/headings/excerpt text. Structured signals (JSON-LD, og:type,
 * URL path) are weighted highest because they survive JS-rendered and
 * login-walled pages where body text is generic. Returns null when nothing
 * matches, in which case the caller falls back to pending/default.
 */
class HeuristicClassifier
{
    public const TAXONOMY = [
        'Social Media',
        'Search Engine',
        'News & Media',
        'E-commerce',
        'Finance',
        'Education',
        'Government',
        'Health',
        'Technology',
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

    private const URL_WEIGHT = 3.0;

    private const TITLE_WEIGHT = 3.0;

    private const STRUCTURED_WEIGHT = 4.0;

    private const META_WEIGHT = 2.0;

    private const HEADING_WEIGHT = 2.0;

    private const ANCHOR_WEIGHT = 1.5;

    private const EXCERPT_WEIGHT = 1.0;

    private const FORM_WEIGHT = 2.0;

    private const MIN_CONFIDENCE = 0.30;

    /**
     * @var array<string, list<string>>
     */
    private const KEYWORDS = [
        'Social Media' => ['facebook', 'instagram', 'twitter', 'x.com', 'tiktok', 'linkedin', 'snapchat', 'pinterest', 'reddit', 'social network', 'followers', 'share post', 'timeline'],
        'Search Engine' => ['search engine', 'web search', 'search results'],
        'News & Media' => ['breaking news', 'news', 'newspaper', 'journalism', 'headlines', 'weather forecast', 'editorial'],
        'E-commerce' => ['add to cart', 'checkout', 'shop now', 'buy now', 'shopping cart', 'free shipping', 'discount code', 'store'],
        'Finance' => ['bank', 'banking', 'loan', 'mortgage', 'credit card', 'investment', 'trading', 'crypto', 'insurance', 'paypal', 'invoice', 'account balance'],
        'Education' => ['university', 'college', 'school', 'course', 'curriculum', 'syllabus', 'lms', 'enroll', 'tuition', 'scholarship', 'lecture', 'homework'],
        'Government' => ['government', 'municipal', 'embassy', 'ministry', 'public service', 'tax filing'],
        'Health' => ['hospital', 'clinic', 'doctor', 'pharmacy', 'medical', 'health', 'symptoms', 'diagnosis', 'appointment', 'patient'],
        'Technology' => ['software', 'hardware', 'ai ', 'artificial intelligence', 'gadget', 'smartphone', 'laptop'],
        'Entertainment' => ['movie', 'movies', 'music', 'celebrity', 'concert', 'tv show', 'anime', 'manga'],
        'Gaming' => ['game', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam', 'esports', 'walkthrough'],
        'Sports' => ['sports', 'football', 'basketball', 'soccer', 'tennis', 'olympics', 'score', 'match highlights', 'league'],
        'Travel' => ['flight', 'hotel', 'booking', 'travel', 'airline', 'vacation', 'itinerary', 'resort', 'airbnb'],
        'Food & Dining' => ['restaurant', 'recipe', 'menu', 'delivery', 'pizza', 'cuisine', 'cooking', 'dining'],
        'Real Estate' => ['real estate', 'property', 'apartment', 'house for sale', 'rent', 'realtor', 'listing', 'mortgage calculator'],
        'Automotive' => ['car ', 'cars', 'automotive', 'vehicle', 'dealership', 'auto parts', 'toyota', 'honda', 'tesla'],
        'Jobs & Careers' => ['jobs', 'career', 'hiring', 'resume', 'job search', 'recruit', 'indeed', 'linkedin jobs', 'vacancy'],
        'Productivity' => ['productivity', 'to-do', 'todo', 'calendar', 'notes', 'project management', 'kanban', 'spreadsheet'],
        'Developer Tools' => ['github', 'gitlab', 'api docs', 'documentation', 'sdk', 'developer', 'stack overflow', 'code', 'npm', 'docker', 'kubernetes'],
        'Cloud & Hosting' => ['cloud', 'hosting', 'vps', 'server', 'aws', 'azure', 'domain registration'],
        'Email' => ['email', 'inbox', 'gmail', 'outlook', 'mail'],
        'Streaming' => ['streaming', 'watch online', 'netflix', 'youtube', 'twitch', 'spotify', 'podcast', 'video'],
        'Gambling' => ['casino', 'betting', 'poker', 'blackjack', 'slots', 'sportsbook', 'lottery', 'wager', 'odds'],
        'Adult' => ['adult', 'porn', 'xxx', 'escort', 'webcam girls', 'nsfw', 'onlyfans'],
        'Shopping' => ['price', 'sale', 'coupon', 'deals', 'marketplace', 'ebay', 'amazon', 'aliexpress'],
        'Reference' => ['wikipedia', 'encyclopedia', 'dictionary', 'wiki', 'manual', 'tutorial', 'how to'],
    ];

    /**
     * @var array<string, list<string>>
     */
    private const STRUCTURED_HINTS = [
        'Streaming' => ['videoobject', 'tvepisode', 'movie', 'musicplaylist', 'watch', 'videos', 'channel', 'livestream'],
        'E-commerce' => ['product', 'offer', 'aggregatedoffer', 'productgroup', 'cart', 'checkout', 'products', 'shop'],
        'News & Media' => ['newsarticle', 'reportage', 'article', 'news', 'articles', 'press'],
        'Jobs & Careers' => ['jobposting', 'jobs', 'careers', 'hiring', 'vacancies'],
        'Food & Dining' => ['recipe', 'restaurant', 'menu', 'recipes'],
        'Real Estate' => ['realestatelisting', 'apartment', 'singlefamilyresidence', 'properties'],
        'Email' => ['emailmessage', 'inbox', 'mail', 'messages'],
        'Education' => ['course', 'courselist', 'learningresource', 'courses', 'learn', 'academy'],
        'Finance' => ['bankaccount', 'loanorcredit', 'invoice', 'banking', 'payments'],
        'Gaming' => ['videogame', 'game', 'games', 'play'],
        'Sports' => ['sportsevent', 'sportsteams', 'scores', 'matches'],
        'Travel' => ['hotel', 'flightreservation', 'travelaction', 'flights', 'hotels', 'booking'],
        'Health' => ['medicalclinic', 'physician', 'hospital', 'health', 'medical'],
        'Developer Tools' => ['softwareapplication', 'software', 'api', 'docs', 'developers'],
        'Reference' => ['encyclopedia', 'dictionary', 'wiki', 'docs', 'manual'],
        'Social Media' => ['profilepage', 'socialmediaposting', 'profile', 'timeline', 'feed'],
        'Productivity' => ['todo', 'calendar', 'notes', 'drive', 'docs', 'sheets'],
    ];

    private const CATEGORY_POLICY = [
        'Gambling' => 'blacklisted',
        'Adult' => 'blacklisted',
    ];

    private const CATEGORY_RISK = [
        'Gambling' => 90,
        'Adult' => 95,
        'Finance' => 60,
        'E-commerce' => 55,
        'Health' => 55,
        'Shopping' => 50,
        'Government' => 10,
        'Education' => 15,
        'Search Engine' => 10,
        'Reference' => 20,
    ];

    /**
     * @param  array{url?: string, title?: string, meta?: array<string,string>, headings?: list<string>, excerpt?: string, ldJson?: list<string>, canonical?: string, urlTokens?: array{hostParts?: list<string>, pathSegs?: list<string>}, anchors?: array{topText?: list<array{text: string}|string>}, forms?: array{hasPassword?: bool, hasFileInput?: bool}}|null  $signals
     * @return array{category: string, confidence: float, policy: string, risk_score: int}|null
     */
    public static function classify(string $domain, ?array $signals): ?array
    {
        if ($signals === null) {
            $signals = [];
        }

        $url = strtolower((string) ($signals['url'] ?? $domain));
        $title = strtolower((string) ($signals['title'] ?? ''));
        $meta = strtolower(implode(' ', array_values($signals['meta'] ?? [])));
        $headings = strtolower(implode(' ', $signals['headings'] ?? []));
        $excerpt = strtolower((string) ($signals['excerpt'] ?? ''));

        $structured = self::structuredText($signals);
        $anchors = self::anchorText($signals);
        $urlTokenText = self::urlTokenText($signals);

        $scores = [];

        foreach (self::KEYWORDS as $category => $keywords) {
            $score = 0.0;

            foreach ($keywords as $keyword) {
                $keyword = strtolower($keyword);

                if ($url !== '' && str_contains($url, $keyword)) {
                    $score += self::URL_WEIGHT;
                }
                if ($urlTokenText !== '' && str_contains($urlTokenText, $keyword)) {
                    $score += self::URL_WEIGHT;
                }
                if ($title !== '' && str_contains($title, $keyword)) {
                    $score += self::TITLE_WEIGHT;
                }
                if ($structured !== '' && str_contains($structured, $keyword)) {
                    $score += self::STRUCTURED_WEIGHT;
                }
                if ($meta !== '' && str_contains($meta, $keyword)) {
                    $score += self::META_WEIGHT;
                }
                if ($headings !== '' && str_contains($headings, $keyword)) {
                    $score += self::HEADING_WEIGHT;
                }
                if ($anchors !== '' && str_contains($anchors, $keyword)) {
                    $score += self::ANCHOR_WEIGHT;
                }
                if ($excerpt !== '' && str_contains($excerpt, $keyword)) {
                    $score += self::EXCERPT_WEIGHT;
                }
            }

            foreach (self::STRUCTURED_HINTS[$category] ?? [] as $hint) {
                if ($structured !== '' && str_contains($structured, $hint)) {
                    $score += self::STRUCTURED_WEIGHT;
                }
                if ($urlTokenText !== '' && str_contains($urlTokenText, $hint)) {
                    $score += self::URL_WEIGHT;
                }
            }

            if ($score > 0) {
                $scores[$category] = $score;
            }
        }

        $formBoost = self::formBoost($signals);
        foreach ($formBoost as $category => $boost) {
            $scores[$category] = ($scores[$category] ?? 0) + $boost;
        }

        if ($scores === []) {
            return self::tldFallback($domain);
        }

        arsort($scores);
        $top = array_key_first($scores);
        $topScore = $scores[$top];
        $total = array_sum($scores);
        $confidence = $total > 0 ? round($topScore / $total, 2) : 0.0;

        if ($confidence < self::MIN_CONFIDENCE && $topScore < self::URL_WEIGHT + self::TITLE_WEIGHT) {
            return self::tldFallback($domain) ?? [
                'category' => $top,
                'confidence' => $confidence,
                'policy' => self::CATEGORY_POLICY[$top] ?? 'under_review',
                'risk_score' => self::CATEGORY_RISK[$top] ?? 70,
            ];
        }

        return [
            'category' => $top,
            'confidence' => $confidence,
            'policy' => self::CATEGORY_POLICY[$top] ?? 'under_review',
            'risk_score' => self::CATEGORY_RISK[$top] ?? 70,
        ];
    }

    /**
     * @param  array<string, mixed>  $signals
     */
    private static function structuredText(array $signals): string
    {
        $parts = [];

        foreach ($signals['ldJson'] ?? [] as $blob) {
            $text = strtolower((string) $blob);
            if (preg_match_all('/"@type"\s*:\s*"([^"]+)"/i', $text, $m)) {
                foreach ($m[1] as $type) {
                    $parts[] = strtolower($type);
                }
            }
            $parts[] = substr($text, 0, 1000);
        }

        $meta = $signals['meta'] ?? [];
        foreach (['og:type', 'og:site_name', 'twitter:card', 'article:section'] as $key) {
            if (! empty($meta[$key])) {
                $parts[] = strtolower((string) $meta[$key]);
            }
        }

        if (! empty($signals['canonical'])) {
            $parts[] = strtolower((string) $signals['canonical']);
        }

        return implode(' ', $parts);
    }

    /**
     * @param  array<string, mixed>  $signals
     */
    private static function anchorText(array $signals): string
    {
        $anchors = $signals['anchors']['topText'] ?? [];
        $texts = [];

        foreach ($anchors as $entry) {
            if (is_array($entry)) {
                $texts[] = strtolower((string) ($entry['text'] ?? ''));
            } else {
                $texts[] = strtolower((string) $entry);
            }
        }

        return implode(' ', $texts);
    }

    /**
     * @param  array<string, mixed>  $signals
     */
    private static function urlTokenText(array $signals): string
    {
        $tokens = $signals['urlTokens'] ?? [];
        $parts = array_merge($tokens['hostParts'] ?? [], $tokens['pathSegs'] ?? []);

        return strtolower(implode(' ', $parts));
    }

    /**
     * Login/file forms are strong intent signals: a password field plus
     * mail-flavored anchors points at Email; a file field plus code anchors
     * points at Developer Tools; a password field on a checkout path points
     * at E-commerce.
     *
     * @param  array<string, mixed>  $signals
     * @return array<string, float>
     */
    private static function formBoost(array $signals): array
    {
        $forms = $signals['forms'] ?? [];
        if (empty($forms['hasPassword']) && empty($forms['hasFileInput'])) {
            return [];
        }

        $anchors = self::anchorText($signals);
        $urlTokens = self::urlTokenText($signals);
        $combined = $anchors.' '.$urlTokens;

        $boost = [];

        if (! empty($forms['hasPassword'])) {
            if (str_contains($combined, 'mail') || str_contains($combined, 'inbox') || str_contains($combined, 'email')) {
                $boost['Email'] = self::FORM_WEIGHT;
            }
            if (str_contains($combined, 'bank') || str_contains($combined, 'account') || str_contains($combined, 'login')) {
                $boost['Finance'] = self::FORM_WEIGHT;
            }
            if (str_contains($combined, 'checkout') || str_contains($combined, 'cart') || str_contains($combined, 'shop')) {
                $boost['E-commerce'] = self::FORM_WEIGHT;
            }
        }

        if (! empty($forms['hasFileInput'])) {
            if (str_contains($combined, 'code') || str_contains($combined, 'repo') || str_contains($combined, 'commit')) {
                $boost['Developer Tools'] = self::FORM_WEIGHT;
            }
        }

        return $boost;
    }

    /**
     * @return array{category: string, confidence: float, policy: string, risk_score: int}|null
     */
    private static function tldFallback(string $domain): ?array
    {
        $tldMap = [
            'edu' => ['Education', 0.6],
            'gov' => ['Government', 0.6],
            'mil' => ['Government', 0.6],
        ];

        foreach ($tldMap as $tld => [$category, $confidence]) {
            if ($domain === $tld || str_ends_with($domain, '.'.$tld)) {
                return [
                    'category' => $category,
                    'confidence' => $confidence,
                    'policy' => 'whitelisted',
                    'risk_score' => $category === 'Education' ? 15 : 10,
                ];
            }
        }

        return null;
    }
}
