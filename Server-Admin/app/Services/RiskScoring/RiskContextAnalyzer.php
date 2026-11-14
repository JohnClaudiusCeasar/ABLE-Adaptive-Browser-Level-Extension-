<?php

namespace App\Services\RiskScoring;

/**
 * Context intelligence layers (1)-(5) for risk scoring:
 *   (1) Contextual window analysis
 *   (2) Document section segmentation
 *   (3) Density & co-occurrence scoring
 *   (4) Page context injection
 *   (5) Schema-level negation/amplification
 */
class RiskContextAnalyzer
{
    // (1) chars to inspect before and after a match
    private const CONTEXT_WINDOW_SIZE = 120;

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

    public function __construct(
        private readonly SafeRegexMatcher $matcher = new SafeRegexMatcher,
    ) {}

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
        if (! $pattern || ! $this->matcher->isPatternSafe($pattern)) {
            return 1.0;
        }
        $delimited = $this->matcher->compile($pattern);
        if ($delimited === null) {
            return 1.0;
        }
        $hit = $this->matcher->firstHit($delimited, $text);
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
            if ($this->matcher->safeTestPattern($patternRegex, $segment['text']) > 0) {
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
        if ($regex === '' || ! $this->matcher->isPatternSafe($regex)) {
            return 1.0;
        }
        $delimited = $this->matcher->compile($regex);
        if ($delimited === null) {
            return 1.0;
        }

        $window = is_numeric($patternCtx['negation_window'] ?? null) ? (int) $patternCtx['negation_window'] : 150;

        $hits = $this->matcher->matchHits($delimited, $text);
        $totalHits = count($hits);
        if ($totalHits === 0) {
            return 1.0;
        }

        $effectiveHits = 0;
        foreach ($hits as $hit) {
            $ctx = $this->extractMatchContext($text, $hit['index'], mb_strlen($hit['value'], 'UTF-8'), $window);

            $isNegated = $negationRe && $this->matcher->safeTestPattern((string) $negationRe, $ctx) > 0;
            $isAmplified = ! $isNegated && $amplifierRe && $this->matcher->safeTestPattern((string) $amplifierRe, $ctx) > 0;

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
    public function meanSchemaContextModifier(array $pattern, array $matchedItems, string $text): float
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
}
