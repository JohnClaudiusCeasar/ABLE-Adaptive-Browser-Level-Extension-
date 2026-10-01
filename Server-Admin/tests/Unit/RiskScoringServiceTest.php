<?php

namespace Tests\Unit;

use App\Services\RiskScoringService;
use Tests\TestCase;

class RiskScoringServiceTest extends TestCase
{
    private RiskScoringService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new RiskScoringService;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function ssnPattern(int $score = 35): array
    {
        return [
            [
                'title' => 'SSN - Standard Format',
                'type' => 'single',
                'regex' => '\b\d{3}-\d{2}-\d{4}\b',
                'score' => $score,
                'priority' => 'high',
            ],
        ];
    }

    public function test_single_pattern_scores_with_density_and_context_layers(): void
    {
        // 1 hit in 11 chars => density 2.0x; neutral context => 1.0x.
        // 35 * 2.0 = 70 (mirrors the JS engine exactly).
        $result = $this->service->score('123-45-6789', $this->ssnPattern());

        $this->assertSame(70, $result['pattern_score']);
        $this->assertCount(1, $result['flagged_items']);
        $this->assertSame('SSN - Standard Format', $result['flagged_items'][0]['label']);
        $this->assertSame(70, $result['flagged_items'][0]['weight']);
    }

    public function test_negation_signal_dampens_single_pattern(): void
    {
        // "example"/"sample" in the context window => layer 1 applies 0.25x.
        // 35 * 0.25 * 2.0 (density) = 17.5 => 18.
        $result = $this->service->score(
            'Example SSN format: 123-45-6789 (sample only)',
            $this->ssnPattern()
        );

        $this->assertSame(18, $result['pattern_score']);
    }

    public function test_redos_guard_drops_unsafe_patterns(): void
    {
        $this->assertFalse($this->service->isPatternSafe('(a+)+'));

        $result = $this->service->score('aaaaaaaaaaaaaaaaaaaa', [
            [
                'title' => 'Catastrophic Pattern',
                'type' => 'single',
                'regex' => '(a+)+',
                'score' => 50,
                'priority' => 'high',
            ],
        ]);

        $this->assertSame(0, $result['pattern_score']);
        $this->assertContains(
            ['label' => '(a+)+', 'reason' => 'redos_guard'],
            $result['suppressed']
        );
    }

    public function test_schema_negation_suppresses_single_pattern_hits(): void
    {
        $result = $this->service->score('sample data 123-45-6789 placeholder', [
            [
                'title' => 'SSN - Standard Format',
                'type' => 'single',
                'regex' => '\b\d{3}-\d{2}-\d{4}\b',
                'score' => 35,
                'priority' => 'high',
                'negation_context_regex' => 'sample|placeholder',
                'negation_window' => 100,
            ],
        ]);

        $this->assertSame(0, $result['pattern_score']);
        $this->assertContains(
            ['label' => 'SSN - Standard Format', 'reason' => 'context_modifiers'],
            $result['suppressed']
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function criteriaPattern(): array
    {
        return [
            [
                'id' => 9,
                'title' => 'PII Bundle',
                'type' => 'criteria',
                'regex' => null,
                'score' => 30,
                'priority' => 'high',
                'negation_context_regex' => 'sample|template',
                'amplifier_context_regex' => 'official',
                'negation_window' => 100,
                'criteria_pattern_items' => [
                    ['title' => 'ID Field', 'regex' => '\b\d{3}-\d{2}-\d{4}\b', 'score' => 15, 'operator' => 'and', 'risk_weight' => 'high'],
                    ['title' => 'Name Field', 'regex' => '\bName:\s*[A-Z][a-z]+\b', 'score' => 15, 'operator' => 'and', 'risk_weight' => 'high'],
                ],
            ],
        ];
    }

    private function filler(): string
    {
        // ~2,000 chars of neutral prose keeps the density multiplier at 1.0x.
        return str_repeat('alpha beta gamma delta epsilon ', 66);
    }

    public function test_f01_negated_criteria_items_contribute_zero(): void
    {
        $text = $this->filler().' Sample template form. ID 123-45-6789. Name: Juan.';
        $result = $this->service->score($text, $this->criteriaPattern());

        $this->assertSame(0, $result['pattern_score']);
    }

    public function test_f01_amplified_criteria_items_contribute_double(): void
    {
        // The schema amplifier also matches capitalized "Official" now that
        // user patterns compile case-insensitively (F-04 fix).
        $text = $this->filler().' official record. ID 123-45-6789. Name: Juan.';
        $result = $this->service->score($text, $this->criteriaPattern());

        // neutral density 1.0; schema mean 2.0 (all hits amplified);
        // layer 1 amplifies the first-match context 1.5x ("record" signal):
        // 30 * 1.5 * 2.0 = 90.
        $this->assertSame(90, $result['pattern_score']);
    }

    public function test_criteria_without_modifiers_scores_composite(): void
    {
        $patterns = $this->criteriaPattern();
        $patterns[0]['negation_context_regex'] = null;
        $patterns[0]['amplifier_context_regex'] = null;

        $text = $this->filler().' ID 123-45-6789. Name: Juan.';
        $result = $this->service->score($text, $patterns);

        $this->assertSame(30, $result['pattern_score']);
        $this->assertSame('PII Bundle', $result['flagged_items'][0]['label']);
    }

    public function test_partial_criteria_match_scores_items_individually(): void
    {
        // Only one of two AND items matches => per-item scoring (15 x modifiers).
        $text = $this->filler().' ID 123-45-6789.';
        $result = $this->service->score($text, $this->criteriaPattern());

        $this->assertGreaterThan(0, $result['pattern_score']);
        $this->assertSame('ID Field', $result['flagged_items'][0]['label']);
    }

    public function test_evaluate_criteria_items_and_or_semantics(): void
    {
        $andItems = [
            ['title' => 'A', 'regex' => 'alpha', 'score' => 10, 'operator' => 'and', 'risk_weight' => 'high'],
            ['title' => 'B', 'regex' => 'beta', 'score' => 10, 'operator' => 'and', 'risk_weight' => 'high'],
        ];
        $this->assertTrue($this->service->evaluateCriteriaItems($andItems, 'alpha beta'));
        $this->assertFalse($this->service->evaluateCriteriaItems($andItems, 'alpha only'));

        $orItems = [
            ['title' => 'A', 'regex' => 'alpha', 'score' => 10, 'operator' => 'or', 'risk_weight' => 'high'],
            ['title' => 'B', 'regex' => 'beta', 'score' => 10, 'operator' => 'or', 'risk_weight' => 'high'],
        ];
        $this->assertTrue($this->service->evaluateCriteriaItems($orItems, 'alpha only'));
        $this->assertFalse($this->service->evaluateCriteriaItems($orItems, 'neither'));
    }

    public function test_co_occurrence_bonus_and_density_multipliers(): void
    {
        $this->assertSame(25, $this->service->computeCoOccurrenceBonus(['Account Number', 'CVV']));
        $this->assertSame(0, $this->service->computeCoOccurrenceBonus(['Account Number']));
        $this->assertSame(2.0, $this->service->computeDensityMultiplier(5, 100));
        $this->assertSame(1.0, $this->service->computeDensityMultiplier(1, 1000));
        $this->assertSame(0.8, $this->service->computeDensityMultiplier(1, 50000));
    }

    public function test_js_unicode_escapes_compile_under_pcre(): void
    {
        // Guide patterns transcribe JS \uXXXX escapes; they must still match.
        $count = $this->service->safeTestPattern('dean[\'\u2019]?s\s*list', "dean\u{2019}s list");
        $this->assertSame(1, $count);
    }

    public function test_user_patterns_compile_case_insensitively(): void
    {
        // F-04 fix: guide patterns must match their own documented examples,
        // e.g. CP-02's "General Weighted Average: 2.25".
        $count = $this->service->safeTestPattern(
            '\b(?:GWA|general\s*weighted\s*average|weighted\s*average|cumulative\s*GPA)[:\s]*[1-4]\.\d{2,4}\b',
            'General Weighted Average: 2.25'
        );
        $this->assertSame(1, $count);
    }

    public function test_unrolled_name_quantifiers_pass_the_redos_guard(): void
    {
        // The guide's name-token quantifiers are unrolled (T?T?T) so the
        // ReDoS guard no longer silently drops them (F-03 family).
        $adviser = '\b(?:thesis|capstone|research)\s*(?:adviser|advisor|panel|committee|member)[:\s]*(?:[A-Z][a-z]+\.?\s+)?(?:[A-Z][a-z]+\.?\s+)?(?:[A-Z][a-z]+\.?\s+)[A-Z][a-z]+\b';
        $this->assertTrue($this->service->isPatternSafe($adviser));
        $this->assertSame(1, $this->service->safeTestPattern($adviser, 'Thesis Adviser: Maria Santos'));
    }

    public function test_student_id_regex_excludes_academic_year_ranges(): void
    {
        // F-05 fix: YYYY-YYYY academic year ranges are no longer student IDs.
        $studentId = '\b(19|20)\d{2}-(?!20\d{2}\b)\d{4,6}\b';
        $this->assertSame(0, $this->service->safeTestPattern($studentId, 'The AY 2024-2025 semester opened.'));
        $this->assertSame(1, $this->service->safeTestPattern($studentId, 'Student No. 2024-10345'));
    }

    public function test_compilable_regex_accepts_js_unicode_escapes(): void
    {
        // Save-time validation must agree with the scoring engine's compile
        // path (\uXXXX normalization + iu flags).
        $rule = new \App\Rules\CompilableRegex;

        $failed = false;
        $rule->validate('regex', 'dean[\'\u2019]?s\s*list', function () use (&$failed): void {
            $failed = true;
        });
        $this->assertFalse($failed);

        $failedBroken = false;
        $rule->validate('regex', '([a-z', function () use (&$failedBroken): void {
            $failedBroken = true;
        });
        $this->assertTrue($failedBroken);
    }

    public function test_page_context_multiplier_scales_content_score(): void
    {
        $pageContext = [
            'title' => 'Upload Employee Payroll Data',
            'headings' => ['Payroll'],
            'urlTokens' => ['pathSegs' => ['upload', 'form']],
            'forms' => ['hasFileInput' => true, 'actionMismatch' => true],
            'meta' => ['description' => 'Secure upload portal'],
        ];

        // 1.3 (path) * 1.2 (file input) * 1.3 (action mismatch) * 1.4 (headings)
        // * 1.2 (title) * 1.2 (meta) = 4.088... => capped at 4.0.
        $mult = $this->service->derivePageContextMultiplier($pageContext);
        $this->assertSame(4.0, $mult);

        $plain = $this->service->score('123-45-6789', $this->ssnPattern());
        $boosted = $this->service->score('123-45-6789', $this->ssnPattern(), $pageContext);
        $this->assertSame(min(100, (int) round($plain['pattern_score'] * $mult)), $boosted['pattern_score']);
    }

    public function test_file_type_multipliers(): void
    {
        $this->assertSame(1.5, $this->service->fileTypeMultiplier('csv'));
        $this->assertSame(0.9, $this->service->fileTypeMultiplier('txt'));
        $this->assertSame(1.0, $this->service->fileTypeMultiplier('unknown'));
        // Falls back to the resolved binary format when the extension is generic.
        $this->assertSame(1.4, $this->service->fileTypeMultiplier('bin', 'xlsx'));
    }

    public function test_real_corpus_fixtures_are_scorable(): void
    {
        $corpus = dirname(base_path()).DIRECTORY_SEPARATOR.'Implementation'.DIRECTORY_SEPARATOR.'Mock Test Corpus';
        if (! is_dir($corpus)) {
            $this->markTestSkipped('Mock Test Corpus not present.');
        }

        $patterns = [
            [
                'id' => 1,
                'title' => 'Complete Student PII Cluster',
                'type' => 'criteria',
                'regex' => null,
                'score' => 65,
                'priority' => 'high',
                'negation_context_regex' => '\b(sample|example|template|dummy|placeholder)\b',
                'amplifier_context_regex' => '\b(registrar|enrollment|official\s*record)\b',
                'negation_window' => 200,
                'criteria_pattern_items' => [
                    ['title' => 'Student ID', 'regex' => '\b(19|20)\d{2}-\d{4,6}\b', 'score' => 20, 'operator' => 'and', 'risk_weight' => 'high'],
                    ['title' => 'Student Name Field Label', 'regex' => '(?:student[\'s]*\s*name|surname|last\s*name)[^\n]{0,60}', 'score' => 15, 'operator' => 'and', 'risk_weight' => 'high'],
                ],
            ],
        ];

        $files = glob($corpus.DIRECTORY_SEPARATOR.'*.txt') ?: [];
        $this->assertNotEmpty($files);

        foreach ($files as $file) {
            $result = $this->service->score((string) file_get_contents($file), $patterns);
            $this->assertGreaterThanOrEqual(0, $result['pattern_score']);
            $this->assertLessThanOrEqual(100, $result['pattern_score']);
        }
    }
}
