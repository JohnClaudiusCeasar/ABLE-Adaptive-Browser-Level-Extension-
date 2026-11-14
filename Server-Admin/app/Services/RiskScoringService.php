<?php

namespace App\Services;

use App\Services\RiskScoring\RiskContextAnalyzer;
use App\Services\RiskScoring\SafeRegexMatcher;
use App\Support\SyntheticFileName;

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

    /** @var list<array{label: string, reason: string}> */
    private array $suppressed = [];

    private readonly SafeRegexMatcher $matcher;

    private readonly RiskContextAnalyzer $contextAnalyzer;

    public function __construct(
        ?SafeRegexMatcher $matcher = null,
        ?RiskContextAnalyzer $contextAnalyzer = null,
    ) {
        $this->matcher = $matcher ?? new SafeRegexMatcher;
        $this->contextAnalyzer = $contextAnalyzer ?? new RiskContextAnalyzer($this->matcher);
    }

    /**
     * Calculate a context-aware risk score for the given text.
     *
     * @param  string|null  $text  Extracted content (null for unscannable files).
     * @param  array<int, array<string, mixed>>  $patterns  Risk patterns as serialized
     *                                                      by RiskPatternController (snake_case, criteria_pattern_items with sub_items).
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
                $criteriaSchemaMod = $this->contextAnalyzer->meanSchemaContextModifier($pattern, $matchedCriteriaItems, $text);

                $criteriaDensityMult = $this->computeDensityMultiplier($totalCriteriaMatches, $textLength);

                $criteriaSectionMult = 1.0;
                if ($hasMultipleSections) {
                    foreach ($segments as $segment) {
                        $segHasMatch = false;
                        foreach ($matchedCriteriaItems as $mc) {
                            if ($this->safeTestPattern($mc['regex'], $segment['text']) > 0) {
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
                    $itemContextMod = $this->getFirstMatchContextModifier((string) $matched['regex'], $text);

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
                            (string) $matched['regex'],
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
        return $this->matcher->isPatternSafe($pattern);
    }

    /**
     * Count non-overlapping matches of a pattern in text. Returns 0 for
     * unsafe/invalid patterns (parity with safeTestPattern in the JS engine).
     */
    public function safeTestPattern(?string $pattern, string $text): int
    {
        return $this->matcher->safeTestPattern($pattern, $text, $this->suppressed);
    }

    // ─── (1) Contextual window analysis ──────────────────────────────────────

    public function extractMatchContext(string $text, int $matchIndex, int $matchLength, int $window = 120): string
    {
        return $this->contextAnalyzer->extractMatchContext($text, $matchIndex, $matchLength, $window);
    }

    /**
     * Multiplier < 1.0 dampens (descriptive context), > 1.0 amplifies (real data).
     */
    public function scoreContextualIntent(string $matchContext): float
    {
        return $this->contextAnalyzer->scoreContextualIntent($matchContext);
    }

    public function getFirstMatchContextModifier(?string $pattern, string $text): float
    {
        return $this->contextAnalyzer->getFirstMatchContextModifier($pattern, $text);
    }

    // ─── (2) Document section segmentation ───────────────────────────────────

    public function getSectionMultiplier(?string $sectionLabel): float
    {
        return $this->contextAnalyzer->getSectionMultiplier($sectionLabel);
    }

    /**
     * @return list<array{label: string, text: string}>
     */
    public function segmentTextBySections(string $text): array
    {
        return $this->contextAnalyzer->segmentTextBySections($text);
    }

    /**
     * @param  list<array{label: string, text: string}>  $segments
     */
    public function getDominantSectionMultiplier(?string $patternRegex, array $segments): float
    {
        return $this->contextAnalyzer->getDominantSectionMultiplier($patternRegex, $segments);
    }

    // ─── (3) Density & co-occurrence scoring ─────────────────────────────────

    public function computeDensityMultiplier(int $matchCount, int $textLength): float
    {
        return $this->contextAnalyzer->computeDensityMultiplier($matchCount, $textLength);
    }

    /**
     * @param  list<string>  $flaggedLabels
     */
    public function computeCoOccurrenceBonus(array $flaggedLabels): int
    {
        return $this->contextAnalyzer->computeCoOccurrenceBonus($flaggedLabels);
    }

    // ─── (4) Page context multiplier ─────────────────────────────────────────

    /**
     * @param  array<string, mixed>|null  $pageContext
     */
    public function derivePageContextMultiplier(?array $pageContext): float
    {
        return $this->contextAnalyzer->derivePageContextMultiplier($pageContext);
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
        return $this->contextAnalyzer->applySchemaContextModifier($pattern, $text);
    }

    /**
     * Schema modifier for an explicit regex (used for criteria items, whose
     * context fields live on the parent pattern — the F-01 fix).
     *
     * @param  array<string, mixed>  $patternCtx
     */
    public function applySchemaContextModifierForRegex(array $patternCtx, string $regex, string $text): float
    {
        return $this->contextAnalyzer->applySchemaContextModifierForRegex($patternCtx, $regex, $text);
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
     * True when the file name is one of the extension's synthetic placeholders
     * (e.g. "blob.csv", "upload.xlsx", "stream-upload.png"), or when no name
     * was supplied at all — a missing name carries no real file type either.
     *
     * The placeholder list itself lives in App\Support\SyntheticFileName, which
     * the egress audit uses to keep these names out of the database.
     */
    public static function isSyntheticFileName(?string $fileName): bool
    {
        if (trim((string) $fileName) === '') {
            return true;
        }

        return SyntheticFileName::isPlaceholder($fileName);
    }

    /**
     * (6) File-type heuristic multiplier resolution.
     *
     * A synthetic file name (see isSyntheticFileName) carries a MIME-derived
     * extension, not the user's real file type, so that extension never
     * receives a multiplier — the heuristic would otherwise boost a nameless
     * blob as if it were a real spreadsheet.
     *
     * The resolved container format is still honoured: it comes from
     * verifying the file's magic bytes and successfully parsing it as an
     * Office container, so it reflects the real content regardless of what
     * the file is called.
     */
    public function fileTypeMultiplier(?string $fileExt, ?string $fileFormat = null, ?string $fileName = null): float
    {
        $ext = mb_strtolower((string) $fileExt, 'UTF-8');
        $synthetic = $fileName !== null && self::isSyntheticFileName($fileName);

        $mult = $synthetic ? 1.0 : (self::FILE_TYPE_MULTIPLIERS[$ext] ?? 1.0);

        if ($mult === 1.0 && $fileFormat && $fileFormat !== 'plain') {
            $mult = self::FILE_TYPE_MULTIPLIERS[$fileFormat] ?? 1.0;
        }

        return $mult;
    }
}
