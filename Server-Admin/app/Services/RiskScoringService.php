<?php

namespace App\Services;

use App\Support\JsRegex;

/**
 * Server-authoritative risk scoring engine.
 *
 * PHP port of Client-Extension/content/risk-scoring.js (calculateRiskScore)
 * including the context intelligence layers:
 *   (1) Contextual window analysis  - dampens/amplifies by surrounding text intent
 *   (2) Document section segmentation - weights matches by section sensitivity
 *   (3) Density + co-occurrence scoring - rewards clustered PII signals
 *   (4) Page context injection - destination page signals as multiplier
 *   (5) Schema-level negation/amplification - per-pattern negation_context_regex,
 *       amplifier_context_regex, negation_window (F-01: also applied to criteria items)
 *   (6) File-type heuristic multiplier (applied by the caller before domain add-on)
 *
 * Porting notes (parity with the JS engine):
 *   - User patterns compile case-insensitively via App\Support\JsRegex (F-04
 *     fix): guide patterns match their own documented examples. This
 *     deliberately diverges from the retired JS engine ('g' flag only).
 *   - Match counting is chunked at 10,000 chars like safeTestPattern().
 *   - JS `\uXXXX` escapes are normalized to `\x{XXXX}` so guide
 *     transcriptions compile unchanged under PCRE UTF-8 mode.
 *   - Compile failures / ReDoS-guard rejections contribute 0 hits (like the JS
 *     engine) and are recorded in the `suppressed` diagnostics list.
 */
class RiskScoringService
{
    /**
     * (6) Prior probability that a container holds real structured data.
     * Applied to the pattern score only, before the domain risk add-on.
     *
     * @var array<string, float>
     */
    public const FILE_TYPE_MULTIPLIERS = [
        'csv' => 1.5,
        'xlsx' => 1.4,
        'xls' => 1.4,
        'pdf' => 1.1,
        'docx' => 1.0,
        'doc' => 1.0,
        'txt' => 0.9,
        'rtf' => 0.9,
        'pptx' => 0.8,
        'ppt' => 0.8,
    ];

    private const MAX_PATTERN_LENGTH = 500;
    private const MAX_TEXT_SLICE = 10000;

    // (1) chars to inspect before and after a match
    private const CONTEXT_WINDOW_SIZE = 120;

    private const RE_DANGEROUS_PATTERN = '~(\(\s*[^)]*[+*][^)]*\)\s*[+*{])|(\[\s*[^]]*\]\s*[+*]\s*[+*])~';

    /**
     * Signals that suggest a match is being *described* rather than *presented*.
     *
     * @var list<string>
     */
    private const NEGATION_SIGNALS = [
        '~\b(example[s]?|sample[s]?|dummy|redacted|placeholder|fictitious|hypothetical|sanitized|template[s]?|lorem|fake)\b~i',
        '~\b(do\s+not|don\'?t|never|avoid|prohibited|restricted|not\s+allowed|must\s+not|should\s+not)\b~i',
        '~\b(format|pattern|like|such\s+as|e\.?g\.?|for\s+instance|i\.?e\.?|illustration|demonstration)\b~i',
        '~[*#xX]{3,}~',
        '~0{3,}[-\s]0{2,}[-\s]0{4}~',
    ];

    /**
     * Signals that suggest a match is real data being actively presented.
     *
     * @var list<string>
     */
    private const AMPLIFIER_SIGNALS = [
        '~\b(my|our|his|her|their|employee|patient|customer|client|user|staff|member|applicant)\b~i',
        '~\b(ssn|social\s+security|account\s+no\.?|account\s+number|id\s+no\.?|passport|dob|date\s+of\s+birth|tin|ein)\b~i',
        '~\b(attached|enclosed|see\s+below|as\s+follows|listed\s+(here|below|above)|herewith|submitted|included)\b~i',
        '~\b(record|entry|row|field|column|cell|data\s+export|export)\b~i',
    ];

    /**
     * (2) Section heading patterns mapped to score multipliers.
     *
     * @var list<array{0: string, 1: float}>
     */
    private const SECTION_WEIGHT_MAP = [
        ['~\b(disclaimer[s]?|legal\s+notice|warning|about|faq|help|example[s]?|sample[s]?|template[s]?|how[-\s]to)\b~i', 0.15],
        ['~\b(reference[s]?|bibliography|appendix|appendices|footnote[s]?|exhibit[s]?|note[s]?)\b~i', 0.20],
        ['~\b(introduction|overview|executive\s+summary|background|purpose|scope|abstract)\b~i', 0.70],
        ['~\b(payroll|salary|compensation|benefit[s]?|medical|diagnosis|treatment|financial|banking|insurance)\b~i', 1.60],
        ['~\b(export|submit|upload|send|transmit|transfer|dispatch)\b~i', 1.40],
        ['~\b(patient|employee|staff|personnel|customer|client)\s+(data|record[s]?|info(rmation)?|list|detail[s]?|roster|profile[s]?)\b~i', 1.80],
        ['~\b(confidential|internal\s+use\s+only|restricted|classified|sensitive|proprietary|top\s+secret)\b~i', 2.00],
    ];

    /**
     * (3) If flagged items from the same group reach the minimum category
     * count, a bonus is added. Real PII records cluster; templates do not.
     *
     * @var list<array{name: string, keywords: list<string>, minMatches: int, bonus: int}>
     */
    private const CO_OCCURRENCE_GROUPS = [
        ['name' => 'PII Trifecta', 'keywords' => ['ssn', 'social security', 'full name', 'name', 'date of birth', 'dob', 'birth date'], 'minMatches' => 3, 'bonus' => 20],
        ['name' => 'Financial Trifecta', 'keywords' => ['account number', 'routing', 'cvv', 'credit card', 'card number', 'bank'], 'minMatches' => 2, 'bonus' => 25],
        ['name' => 'Medical Pair', 'keywords' => ['patient', 'diagnosis', 'medical record', 'prescription', 'health'], 'minMatches' => 2, 'bonus' => 15],
        ['name' => 'Identity Combo', 'keywords' => ['passport', 'driver', 'license', 'id number', 'national id', 'address', 'phone'], 'minMatches' => 2, 'bonus' => 10],
    ];

    /** @var list<array{label: string, reason: string}> */
    private array $suppressed = [];

    /**
     * Calculate a context-aware risk score for the given text.
     *
     * @param  string|null  $text  Extracted content (null for unscannable files).
     * @param  array<int, array<string, mixed>>  $patterns  Risk patterns as serialized
     *        by RiskPatternController (snake_case, criteria_pattern_items with sub_items).
     * @param  array<string, mixed>|null  $pageContext  Page signals from the extension.
     * @return array{pattern_score: int, flagged_items: list<array{label: string, count: int, weight: int}>, suppressed: list<array{label: string, reason: string}>}
     */
    public function score(?string $text, array $patterns, ?array $pageContext = null): array
    {
        $this->suppressed = [];
        $text = $text ?? '';

        if (count($patterns) === 0) {
            return ['pattern_score' => 0, 'flagged_items' => [], 'suppressed' => [['label' => '(none)', 'reason' => 'no_patterns_available']]];
        }

        $textLength = mb_strlen($text, 'UTF-8');

        // (2) Pre-segment the document by section headings
        $segments = $this->segmentTextBySections($text);
        $hasMultipleSections = count($segments) > 1;

        // (4) Compute page context multiplier once up front
        $pageContextMult = $this->derivePageContextMultiplier($pageContext);

        // Priority-order the patterns (stable, like the JS sort)
        $priorityOrder = ['high' => 0, 'medium' => 1, 'low' => 2];
        $indexed = [];
        foreach (array_values($patterns) as $i => $pattern) {
            $indexed[] = ['pattern' => $pattern, 'index' => $i];
        }
        usort($indexed, static function (array $a, array $b) use ($priorityOrder): int {
            $wa = $priorityOrder[$a['pattern']['priority'] ?? null] ?? 3;
            $wb = $priorityOrder[$b['pattern']['priority'] ?? null] ?? 3;

            return ($wa <=> $wb) ?: ($a['index'] <=> $b['index']);
        });

        /** @var array<string, array{count: int, score: int, label: string}> $scoredRegexes */
        $scoredRegexes = [];
        $totalScore = 0;

        $recordRegexMatch = static function (string $key, int $count, int $score, string $label) use (&$scoredRegexes): int {
            $compositeKey = $key.'|||'.$label;
            $addedScore = 0;
            if (isset($scoredRegexes[$compositeKey])) {
                $scoredRegexes[$compositeKey]['count'] += $count;
                if ($score > $scoredRegexes[$compositeKey]['score']) {
                    $addedScore = $score - $scoredRegexes[$compositeKey]['score'];
                    $scoredRegexes[$compositeKey]['score'] = $score;
                }
            } else {
                $scoredRegexes[$compositeKey] = ['count' => $count, 'score' => $score, 'label' => $label];
                $addedScore = $score;
            }

            return $addedScore;
        };

        foreach ($indexed as $entry) {
            $pattern = $entry['pattern'];
            $type = $pattern['type'] ?? null;

            // Skip auto-created single copies if their parent criteria is evaluated
            if ($type === 'single' && ! empty($pattern['parent_criteria_id'])) {
                continue;
            }

            if ($type === 'single') {
                $regex = $pattern['regex'] ?? null;
                $rawCount = $this->safeTestPattern($regex, $text);
                if ($rawCount > 0) {
                    // (1) Contextual window around the first match
                    $contextMod = $this->getFirstMatchContextModifier($regex, $text);

                    // (5) Schema-level negation/amplification
                    $schemaMod = $this->applySchemaContextModifier($pattern, $text);

                    // (2) Highest-risk section where this pattern fires
                    $sectionMult = $hasMultipleSections
                        ? $this->getDominantSectionMultiplier($regex, $segments)
                        : 1.0;

                    // (3) Match frequency relative to document length
                    $densityMult = $this->computeDensityMultiplier($rawCount, $textLength);

                    $combinedMult = $contextMod * $schemaMod * $sectionMult * $densityMult;
                    $adjustedScore = (int) round((int) ($pattern['score'] ?? 0) * $combinedMult);

                    if ($adjustedScore > 0) {
                        $totalScore += $recordRegexMatch((string) $regex, $rawCount, $adjustedScore, (string) ($pattern['title'] ?? ''));
                    } else {
                        $this->suppressed[] = ['label' => (string) ($pattern['title'] ?? ''), 'reason' => 'context_modifiers'];
                    }
                }
                if ($totalScore >= 100) {
                    break;
                }
                continue;
            }

            if ($type !== 'criteria') {
                continue;
            }

            $items = $pattern['criteria_pattern_items'] ?? [];
            if (count($items) === 0) {
                continue;
            }

            $sortedItems = $this->sortItemsByRiskWeight($items);
            $matchedCriteriaItems = [];
            $totalCriteriaMatches = 0;
            $criteriaItemsScore = 0;

            $collect = null;
            $collect = function (array $itemList) use (&$collect, &$matchedCriteriaItems, &$totalCriteriaMatches, &$criteriaItemsScore, $text): void {
                foreach ($itemList as $item) {
                    $itemRegex = $item['regex'] ?? null;
                    $itemCount = $itemRegex ? $this->safeTestPattern($itemRegex, $text) : 0;
                    if ($itemCount > 0) {
                        $totalCriteriaMatches += $itemCount;
                        $criteriaItemsScore += (int) ($item['score'] ?? 0);
                        $matchedCriteriaItems[] = [
                            'title' => (string) ($item['title'] ?? ''),
                            'regex' => $itemRegex,
                            'score' => (int) ($item['score'] ?? 0),
                            'count' => $itemCount,
                        ];
                    }
                    if (! empty($item['sub_items']) && is_array($item['sub_items'])) {
                        $collect($item['sub_items']);
                    }
                }
            };
            $collect($sortedItems);

            $criteriaMatched = $this->evaluateCriteriaItems($items, $text, $sortedItems);

            if ($criteriaMatched) {
                $patternScore = is_numeric($pattern['score'] ?? null) && (int) $pattern['score'] > 0
                    ? (int) $pattern['score']
                    : $criteriaItemsScore;

                // F-01: criteria rows have regex = null, so the context modifier is
                // derived from the first matched item's regex instead.
                $firstRegex = $matchedCriteriaItems[0]['regex'] ?? null;
                $criteriaContextMod = $firstRegex
                    ? $this->getFirstMatchContextModifier($firstRegex, $text)
                    : 1.0;

                // F-01: schema-level negation/amplification now also applies to
                // criteria items (mean of per-item effective/raw hit ratios).
                $criteriaSchemaMod = $this->meanSchemaContextModifier($pattern, $matchedCriteriaItems, $text);

                $criteriaDensityMult = $this->computeDensityMultiplier($totalCriteriaMatches, $textLength);

                $criteriaSectionMult = 1.0;
                if ($hasMultipleSections) {
                    foreach ($segments as $segment) {
                        $segHasMatch = false;
                        foreach ($matchedCriteriaItems as $mc) {
                            if ($mc['regex'] && $this->safeTestPattern($mc['regex'], $segment['text']) > 0) {
                                $segHasMatch = true;
                                break;
                            }
                        }
                        if ($segHasMatch) {
                            $csm = $this->getSectionMultiplier($segment['label']);
                            if ($csm > $criteriaSectionMult) {
                                $criteriaSectionMult = $csm;
                            }
                        }
                    }
                }

                $criteriaAdjustedScore = (int) round(
                    $patternScore * $criteriaContextMod * $criteriaSchemaMod * $criteriaDensityMult * $criteriaSectionMult
                );

                $totalScore += $recordRegexMatch(
                    (string) ($pattern['regex'] ?? ('criteria_'.($pattern['id'] ?? $pattern['title'] ?? ''))),
                    max(1, $totalCriteriaMatches),
                    $criteriaAdjustedScore,
                    (string) ($pattern['title'] ?? '')
                );
            } elseif (count($matchedCriteriaItems) > 0) {
                // Criteria not fully satisfied - score matched sub-items individually
                foreach ($matchedCriteriaItems as $matched) {
                    $itemContextMod = $matched['regex']
                        ? $this->getFirstMatchContextModifier($matched['regex'], $text)
                        : 1.0;

                    // F-01: per-item schema modifier using the parent pattern's
                    // negation/amplifier context fields.
                    $itemSchemaMod = $this->applySchemaContextModifierForRegex($pattern, (string) $matched['regex'], $text);

                    $itemDensityMult = $this->computeDensityMultiplier($matched['count'], $textLength);
                    $itemSectionMult = $hasMultipleSections
                        ? $this->getDominantSectionMultiplier($matched['regex'], $segments)
                        : 1.0;
                    $itemAdjustedScore = (int) round(
                        $matched['score'] * $itemContextMod * $itemSchemaMod * $itemDensityMult * $itemSectionMult
                    );

                    if ($itemAdjustedScore > 0) {
                        $totalScore += $recordRegexMatch(
                            (string) ($matched['regex'] ?? ('criteria_item_'.$matched['title'])),
                            $matched['count'],
                            $itemAdjustedScore,
                            $matched['title']
                        );
                    } else {
                        $this->suppressed[] = ['label' => $matched['title'], 'reason' => 'context_modifiers'];
                    }
                    if ($totalScore >= 100) {
                        break;
                    }
                }
            }

            if ($totalScore >= 100) {
                break;
            }
        }

        // Build deduplicated flagged items
        $dedupedFlagged = [];
        foreach ($scoredRegexes as $entry) {
            $dedupedFlagged[] = [
                'label' => $entry['label'],
                'count' => $entry['count'],
                'weight' => $entry['score'],
            ];
        }

        // (3) Co-occurrence bonus
        $totalScore += $this->computeCoOccurrenceBonus(array_map(
            static fn (array $f): string => (string) $f['label'],
            $dedupedFlagged
        ));

        // (4) Page context multiplier scales the content score only (the domain
        // risk score is added by the caller after this returns).
        $finalScore = min(100, (int) round(min(100, $totalScore) * $pageContextMult));

        return [
            'pattern_score' => $finalScore,
            'flagged_items' => $dedupedFlagged,
            'suppressed' => $this->suppressed,
        ];
    }

    // ─── ReDoS safety ────────────────────────────────────────────────────────

    public function isPatternSafe(?string $pattern): bool
    {
        if (! is_string($pattern) || $pattern === '') {
            return true;
        }
        if (mb_strlen($pattern, 'UTF-8') > self::MAX_PATTERN_LENGTH) {
            return false;
        }

        return ! preg_match(self::RE_DANGEROUS_PATTERN, $pattern);
    }

    /**
     * Count non-overlapping matches of a pattern in text. Returns 0 for
     * unsafe/invalid patterns (parity with safeTestPattern in the JS engine).
     */
    public function safeTestPattern(?string $pattern, string $text): int
    {
        if (! is_string($pattern) || $pattern === '') {
            return 0;
        }
        if (! $this->isPatternSafe($pattern)) {
            $this->suppressed[] = ['label' => mb_substr($pattern, 0, 60), 'reason' => 'redos_guard'];

            return 0;
        }
        $delimited = $this->compile($pattern);
        if ($delimited === null) {
            $this->suppressed[] = ['label' => mb_substr($pattern, 0, 60), 'reason' => 'compile_failed'];

            return 0;
        }

        // Chunked matching to avoid ReDoS on large texts (parity with the JS engine)
        $length = mb_strlen($text, 'UTF-8');
        if ($length > self::MAX_TEXT_SLICE) {
            $count = 0;
            for ($i = 0; $i < $length; $i += self::MAX_TEXT_SLICE) {
                $slice = mb_substr($text, $i, self::MAX_TEXT_SLICE, 'UTF-8');
                $count += $this->matchCount($delimited, $slice);
            }

            return $count;
        }

        return $this->matchCount($delimited, $text);
    }

    // ─── (1) Contextual window analysis ──────────────────────────────────────

    public function extractMatchContext(string $text, int $matchIndex, int $matchLength, int $window = self::CONTEXT_WINDOW_SIZE): string
    {
        $start = max(0, $matchIndex - $window);
        $end = min(mb_strlen($text, 'UTF-8'), $matchIndex + $matchLength + $window);

        return mb_substr($text, $start, $end - $start, 'UTF-8');
    }

    /**
     * Multiplier < 1.0 dampens (descriptive context), > 1.0 amplifies (real data).
     */
    public function scoreContextualIntent(string $matchContext): float
    {
        $modifier = 1.0;
        $ctx = mb_strtolower($matchContext, 'UTF-8');

        foreach (self::NEGATION_SIGNALS as $signal) {
            if (preg_match($signal, $ctx)) {
                $modifier *= 0.25;
                break;
            }
        }

        if ($modifier >= 1.0) {
            foreach (self::AMPLIFIER_SIGNALS as $signal) {
                if (preg_match($signal, $ctx)) {
                    $modifier = min($modifier * 1.5, 3.0);
                    break;
                }
            }
        }

        return $modifier;
    }

    public function getFirstMatchContextModifier(?string $pattern, string $text): float
    {
        if (! $pattern || ! $this->isPatternSafe($pattern)) {
            return 1.0;
        }
        $delimited = $this->compile($pattern);
        if ($delimited === null) {
            return 1.0;
        }
        $hit = $this->firstHit($delimited, $text);
        if ($hit === null) {
            return 1.0;
        }

        return $this->scoreContextualIntent(
            $this->extractMatchContext($text, $hit['index'], mb_strlen($hit['value'], 'UTF-8'))
        );
    }

    // ─── (2) Document section segmentation ───────────────────────────────────

    public function getSectionMultiplier(?string $sectionLabel): float
    {
        if (! $sectionLabel) {
            return 1.0;
        }
        foreach (self::SECTION_WEIGHT_MAP as $entry) {
            if (preg_match($entry[0], $sectionLabel)) {
                return $entry[1];
            }
        }

        return 1.0;
    }

    /**
     * @return list<array{label: string, text: string}>
     */
    public function segmentTextBySections(string $text): array
    {
        $lines = explode("\n", $text);
        $segments = [];
        $currentLabel = '';
        $buffer = [];

        foreach ($lines as $line) {
            $trimmed = trim($line);

            // Markdown heading: # ... through #### ...
            $mdMatch = preg_match('~^(#{1,4})\s+(.+)$~', $trimmed, $m) ? $m : null;
            // ALL-CAPS heading: >= 4 uppercase letters, no lowercase, no year-heavy line
            $capsMatch = ! $mdMatch
                && mb_strlen($trimmed, 'UTF-8') >= 4
                && mb_strlen($trimmed, 'UTF-8') <= 80
                && preg_match('~^[A-Z][A-Z\s\-/()]{3,}$~', $trimmed)
                && ! preg_match('~\d{4,}~', $trimmed);

            if (($mdMatch || $capsMatch) && mb_strlen($trimmed, 'UTF-8') < 100) {
                if (count($buffer) > 0) {
                    $segments[] = ['label' => $currentLabel, 'text' => implode("\n", $buffer)];
                    $buffer = [];
                }
                $currentLabel = $mdMatch
                    ? trim(mb_strtolower($mdMatch[2], 'UTF-8'))
                    : trim(mb_strtolower($trimmed, 'UTF-8'));
            } else {
                $buffer[] = $line;
            }
        }

        if (count($buffer) > 0) {
            $segments[] = ['label' => $currentLabel, 'text' => implode("\n", $buffer)];
        }

        if (count($segments) === 0) {
            $segments[] = ['label' => '', 'text' => $text];
        }

        return $segments;
    }

    /**
     * @param  list<array{label: string, text: string}>  $segments
     */
    public function getDominantSectionMultiplier(?string $patternRegex, array $segments): float
    {
        if (! $patternRegex || count($segments) <= 1) {
            return 1.0;
        }
        $best = 1.0;
        foreach ($segments as $segment) {
            if ($this->safeTestPattern($patternRegex, $segment['text']) > 0) {
                $sm = $this->getSectionMultiplier($segment['label']);
                if ($sm > $best) {
                    $best = $sm;
                }
            }
        }

        return $best;
    }

    // ─── (3) Density & co-occurrence scoring ─────────────────────────────────

    public function computeDensityMultiplier(int $matchCount, int $textLength): float
    {
        if ($matchCount === 0 || $textLength === 0) {
            return 1.0;
        }
        $density = ($matchCount / $textLength) * 1000;
        if ($density > 5) {
            return 2.0;
        }
        if ($density > 1) {
            return 1.4;
        }
        if ($density > 0.1) {
            return 1.0;
        }

        return 0.8;
    }

    /**
     * @param  list<string>  $flaggedLabels
     */
    public function computeCoOccurrenceBonus(array $flaggedLabels): int
    {
        if (count($flaggedLabels) < 2) {
            return 0;
        }
        $labelsLower = array_map(
            static fn (string $l): string => mb_strtolower((string) $l, 'UTF-8'),
            $flaggedLabels
        );
        $totalBonus = 0;

        foreach (self::CO_OCCURRENCE_GROUPS as $group) {
            $matchedKeywords = 0;
            foreach ($group['keywords'] as $kw) {
                foreach ($labelsLower as $label) {
                    if (str_contains($label, $kw)) {
                        $matchedKeywords++;
                        break;
                    }
                }
                if ($matchedKeywords >= $group['minMatches']) {
                    break;
                }
            }
            if ($matchedKeywords >= $group['minMatches']) {
                $totalBonus += $group['bonus'];
            }
        }

        return $totalBonus;
    }

    // ─── (4) Page context multiplier ─────────────────────────────────────────

    /**
     * @param  array<string, mixed>|null  $pageContext
     */
    public function derivePageContextMultiplier(?array $pageContext): float
    {
        if (! $pageContext) {
            return 1.0;
        }
        $mult = 1.0;

        $pathSegs = isset($pageContext['urlTokens']['pathSegs']) && is_array($pageContext['urlTokens']['pathSegs'])
            ? mb_strtolower(implode('/', $pageContext['urlTokens']['pathSegs']), 'UTF-8')
            : '';
        if (preg_match('~\b(upload|submit|export|send|transfer|share|dispatch|sync)\b~', $pathSegs)) {
            $mult *= 1.3;
        }

        if (! empty($pageContext['forms']['hasFileInput'])) {
            $mult *= 1.2;
        }

        if (! empty($pageContext['forms']['actionMismatch'])) {
            $mult *= 1.3;
        }

        $headingText = mb_strtolower(implode(' ', (array) ($pageContext['headings'] ?? [])), 'UTF-8');
        if (preg_match('~\b(patient|employee|payroll|financial|confidential|restricted|personnel|medical)\b~', $headingText)) {
            $mult *= 1.4;
        }

        $title = mb_strtolower((string) ($pageContext['title'] ?? ''), 'UTF-8');
        if (preg_match('~\b(upload|export|transfer|submit|send|share)\b~', $title)) {
            $mult *= 1.2;
        }

        $metaDesc = mb_strtolower((string) (($pageContext['meta']['description'] ?? '') ?: ''), 'UTF-8');
        if (preg_match('~\b(secure\s+upload|data\s+transfer|file\s+shar(e|ing)|submit\s+data)\b~', $metaDesc)) {
            $mult *= 1.2;
        }

        return min($mult, 4.0);
    }

    // ─── (5) Schema-level negation/amplification ─────────────────────────────

    /**
     * Adjust the effective hit count using the pattern's own
     * negation_context_regex / amplifier_context_regex fields. Negated hits are
     * excluded entirely; amplified hits count double.
     *
     * @param  array<string, mixed>  $pattern  Pattern or item carrying the context fields.
     * @return float Ratio of effective hits to raw hits. 0.0 = fully negated.
     */
    public function applySchemaContextModifier(array $pattern, string $text): float
    {
        return $this->applySchemaContextModifierForRegex($pattern, (string) ($pattern['regex'] ?? ''), $text);
    }

    /**
     * Schema modifier for an explicit regex (used for criteria items, whose
     * context fields live on the parent pattern — the F-01 fix).
     *
     * @param  array<string, mixed>  $patternCtx
     */
    public function applySchemaContextModifierForRegex(array $patternCtx, string $regex, string $text): float
    {
        $negationRe = $patternCtx['negation_context_regex'] ?? null;
        $amplifierRe = $patternCtx['amplifier_context_regex'] ?? null;
        if (! $negationRe && ! $amplifierRe) {
            return 1.0;
        }
        if ($regex === '' || ! $this->isPatternSafe($regex)) {
            return 1.0;
        }
        $delimited = $this->compile($regex);
        if ($delimited === null) {
            return 1.0;
        }

        $window = is_numeric($patternCtx['negation_window'] ?? null) ? (int) $patternCtx['negation_window'] : 150;

        $hits = $this->matchHits($delimited, $text);
        $totalHits = count($hits);
        if ($totalHits === 0) {
            return 1.0;
        }

        $effectiveHits = 0;
        foreach ($hits as $hit) {
            $ctx = $this->extractMatchContext($text, $hit['index'], mb_strlen($hit['value'], 'UTF-8'), $window);

            $isNegated = $negationRe && $this->safeTestPattern((string) $negationRe, $ctx) > 0;
            $isAmplified = ! $isNegated && $amplifierRe && $this->safeTestPattern((string) $amplifierRe, $ctx) > 0;

            if (! $isNegated) {
                $effectiveHits += $isAmplified ? 2 : 1;
            }
        }

        return $effectiveHits / $totalHits;
    }

    /**
     * F-01: mean of per-item schema modifier ratios across matched criteria
     * items, so negation cancels and amplification doubles on criteria patterns too.
     *
     * @param  array<string, mixed>  $pattern
     * @param  list<array{title: string, regex: ?string, score: int, count: int}>  $matchedItems
     */
    private function meanSchemaContextModifier(array $pattern, array $matchedItems, string $text): float
    {
        if (count($matchedItems) === 0) {
            return 1.0;
        }
        if (empty($pattern['negation_context_regex']) && empty($pattern['amplifier_context_regex'])) {
            return 1.0;
        }

        $sum = 0.0;
        $counted = 0;
        foreach ($matchedItems as $item) {
            if (! $item['regex']) {
                continue;
            }
            $sum += $this->applySchemaContextModifierForRegex($pattern, (string) $item['regex'], $text);
            $counted++;
        }

        return $counted > 0 ? $sum / $counted : 1.0;
    }

    // ─── Criteria helpers ────────────────────────────────────────────────────

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    public function sortItemsByRiskWeight(array $items): array
    {
        $weightOrder = ['high' => 0, 'medium' => 1, 'low' => 2];
        $items = array_values($items);
        usort($items, static function (array $a, array $b) use ($weightOrder): int {
            $wa = $weightOrder[$a['risk_weight'] ?? 'medium'] ?? 3;
            $wb = $weightOrder[$b['risk_weight'] ?? 'medium'] ?? 3;
            if ($wa !== $wb) {
                return $wa <=> $wb;
            }

            return ((int) ($b['score'] ?? 0)) <=> ((int) ($a['score'] ?? 0));
        });

        return $items;
    }

    /**
     * AND/OR evaluation over sorted items (recursing into sub_items).
     *
     * @param  array<int, array<string, mixed>>  $items
     * @param  array<int, array<string, mixed>>|null  $sortedItems
     */
    public function evaluateCriteriaItems(array $items, string $text, ?array $sortedItems = null): bool
    {
        $itemsToEvaluate = $sortedItems ?? $this->sortItemsByRiskWeight($items);
        if (count($itemsToEvaluate) === 0) {
            return false;
        }

        $results = array_map(function (array $item) use ($text): bool {
            if (! empty($item['sub_items']) && is_array($item['sub_items'])) {
                $subMatched = $this->evaluateCriteriaItems($item['sub_items'], $text);
                if (! empty($item['regex'])) {
                    return $this->safeTestPattern($item['regex'], $text) > 0 && $subMatched;
                }

                return $subMatched;
            }

            return ! empty($item['regex'])
                ? $this->safeTestPattern($item['regex'], $text) > 0
                : false;
        }, $itemsToEvaluate);

        $hasOr = false;
        foreach ($itemsToEvaluate as $item) {
            if (($item['operator'] ?? null) === 'or') {
                $hasOr = true;
                break;
            }
        }

        return $hasOr
            ? in_array(true, $results, true)
            : ! in_array(false, $results, true);
    }

    /**
     * (6) File-type heuristic multiplier resolution.
     */
    public function fileTypeMultiplier(?string $fileExt, ?string $fileFormat = null): float
    {
        $ext = mb_strtolower((string) $fileExt, 'UTF-8');
        $mult = self::FILE_TYPE_MULTIPLIERS[$ext] ?? 1.0;

        if ($mult === 1.0 && $fileFormat && $fileFormat !== 'plain') {
            $mult = self::FILE_TYPE_MULTIPLIERS[$fileFormat] ?? 1.0;
        }

        return $mult;
    }

    // ─── Internals ───────────────────────────────────────────────────────────

    /**
     * Compile a JS-flavored pattern to a delimited PCRE expression.
     * Normalization (\uXXXX -> \x{XXXX}) and the `iu` flags live in
     * App\Support\JsRegex so save-time validation and scoring always agree.
     * Returns null on compile failure (treated as 0 hits by the scoring loop).
     */
    private function compile(string $pattern): ?string
    {
        return JsRegex::compile($pattern);
    }

    /**
     * @return array{index: int, value: string}|null
     */
    private function firstHit(string $delimited, string $text): ?array
    {
        $matches = [];
        set_error_handler(static fn (): bool => true);
        try {
            $count = @preg_match($delimited, $text, $matches, PREG_OFFSET_CAPTURE);
        } finally {
            restore_error_handler();
        }
        if ($count !== 1 || ! isset($matches[0])) {
            return null;
        }

        return [
            'index' => mb_strlen(substr($text, 0, (int) $matches[0][1]), 'UTF-8'),
            'value' => (string) $matches[0][0],
        ];
    }

    /**
     * @return int Match count (0 when the regex errors, e.g. invalid UTF-8 subject)
     */
    private function matchCount(string $delimited, string $text): int
    {
        set_error_handler(static fn (): bool => true);
        try {
            $count = @preg_match_all($delimited, $text);
        } finally {
            restore_error_handler();
        }

        return $count === false ? 0 : $count;
    }

    /**
     * @return list<array{index: int, value: string}>
     */
    private function matchHits(string $delimited, string $text): array
    {
        $matches = [];
        set_error_handler(static fn (): bool => true);
        try {
            $count = @preg_match_all($delimited, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        } finally {
            restore_error_handler();
        }
        if ($count === false || $count === 0) {
            return [];
        }

        $hits = [];
        foreach ($matches as $m) {
            $value = (string) $m[0][0];
            $offsetBytes = (int) $m[0][1];
            // Convert byte offset to character offset (JS string indexes are character-based)
            $hits[] = [
                'index' => mb_strlen(substr($text, 0, $offsetBytes), 'UTF-8'),
                'value' => $value,
            ];
        }

        return $hits;
    }
}
