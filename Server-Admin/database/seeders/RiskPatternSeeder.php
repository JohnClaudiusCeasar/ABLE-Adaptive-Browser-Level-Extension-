<?php

namespace Database\Seeders;

use App\Models\CriteriaPatternItem;
use App\Models\RiskPattern;
use Illuminate\Database\Seeder;

class RiskPatternSeeder extends Seeder
{
    public function run(): void
    {
        // ─── Single Patterns ───────────────────────────────────────

        $singles = [
            [
                'title' => 'EIN - Standard Format',
                'regex' => '\b\d{2}-\d{7}\b',
                'score' => 25,
                'priority' => 'medium',
            ],
            [
                'title' => 'SSN - Standard Format',
                'regex' => '\b\d{3}-\d{2}-\d{4}\b',
                'score' => 35,
                'priority' => 'high',
            ],
            [
                'title' => 'AWS Access Key ID',
                'regex' => '\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b',
                'score' => 45,
                'priority' => 'high',
            ],
            [
                'title' => 'Stripe API Key',
                'regex' => '\b(?:pk|sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b',
                'score' => 40,
                'priority' => 'high',
            ],
            [
                'title' => 'SWIFT/BIC Code',
                'regex' => '\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b',
                'score' => 20,
                'priority' => 'medium',
            ],
            [
                'title' => 'SEC Filing Reference',
                'regex' => '\b(?:Form\s)?(?:10-[KQ]|8-K|S-1|S-3)\b',
                'score' => 10,
                'priority' => 'low',
            ],
            [
                'title' => 'Password Assignment',
                'regex' => '(?:password|passwd|pwd|pass)[\s]*[=:][\s]*[^\s\n]{6,}',
                'score' => 35,
                'priority' => 'high',
            ],
            [
                'title' => 'RSA Private Key',
                'regex' => '-----BEGIN\s(?:RSA\s)?PRIVATE\sKEY-----',
                'score' => 50,
                'priority' => 'high',
            ],
            [
                'title' => 'JWT Token',
                'regex' => '\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b',
                'score' => 35,
                'priority' => 'high',
            ],
            [
                'title' => 'Generic API Key Assignment',
                'regex' => '(?:api[_-]?key|apikey|api[_-]?secret|access[_-]?key)[\s]*[=:][\s]*["\']?[A-Za-z0-9_\-]{20,}["\']?',
                'score' => 30,
                'priority' => 'medium',
            ],
            [
                'title' => 'PostgreSQL Connection String',
                'regex' => 'postgres(?:ql)?://[^\s]+:[^\s]+@[^\s]+:\d+/\w+',
                'score' => 40,
                'priority' => 'high',
            ],
            [
                'title' => 'Email Address',
                'regex' => '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                'score' => 15,
                'priority' => 'low',
            ],
            [
                'title' => 'Document Classification Label',
                'regex' => '\b(?:CONFIDENTIAL|RESTRICTED|TOP\s?SECRET|INTERNAL\s?USE\s?ONLY|PROPRIETARY|TRADE\s?SECRET|CLASSIFIED)\b',
                'score' => 20,
                'priority' => 'medium',
            ],
        ];

        foreach ($singles as $pattern) {
            RiskPattern::create([
                'title' => $pattern['title'],
                'type' => 'single',
                'regex' => $pattern['regex'],
                'score' => $pattern['score'],
                'priority' => $pattern['priority'],
            ]);
        }

        // ─── Criteria Patterns ─────────────────────────────────────

        // Credential Assignment
        $credPattern = RiskPattern::create([
            'title' => 'Credential Assignment',
            'type' => 'criteria',
            'regex' => null,
            'score' => 45,
            'priority' => 'high',
        ]);
        CriteriaPatternItem::create([
            'criteria_pattern_id' => $credPattern->id,
            'title' => 'Credential Keyword',
            'regex' => '(?:password|passwd|pwd|secret|api[_-]?key|token|credential|auth[_-]?(?:key|token|secret))',
            'score' => 0,
        ]);
        CriteriaPatternItem::create([
            'criteria_pattern_id' => $credPattern->id,
            'title' => 'Credential Value Pattern',
            'regex' => '[=:]\s*["\']?[A-Za-z0-9_\-!@#$%^&*]{8,}["\']?',
            'score' => 0,
        ]);

        // Financial Statement with Account Data
        $financialPattern = RiskPattern::create([
            'title' => 'Financial Statement with Account Data',
            'type' => 'criteria',
            'regex' => null,
            'score' => 35,
            'priority' => 'medium',
        ]);
        CriteriaPatternItem::create([
            'criteria_pattern_id' => $financialPattern->id,
            'title' => 'Financial Document Indicator',
            'regex' => '(?:financial\s?statement|balance\s?sheet|income\s?statement|cash\s?flow|10-[KQ]|quarterly\s?report|annual\s?report)',
            'score' => 0,
        ]);
        CriteriaPatternItem::create([
            'criteria_pattern_id' => $financialPattern->id,
            'title' => 'Sensitive Financial Data',
            'regex' => '(?:account\s?(?:number|no|#)|routing\s?(?:number|no|#)|EIN|tax\s?id|revenue|profit|net\s?income)',
            'score' => 0,
        ]);

        // Cloud Provider Credentials
        $cloudPattern = RiskPattern::create([
            'title' => 'Cloud Provider Credentials',
            'type' => 'criteria',
            'regex' => null,
            'score' => 45,
            'priority' => 'high',
        ]);
        CriteriaPatternItem::create([
            'criteria_pattern_id' => $cloudPattern->id,
            'title' => 'Cloud Provider Context',
            'regex' => '(?:aws|amazon|azure|gcp|google\s?cloud|digital\s?ocean|heroku|vercel|netlify)',
            'score' => 0,
        ]);
        CriteriaPatternItem::create([
            'criteria_pattern_id' => $cloudPattern->id,
            'title' => 'Credential Type',
            'regex' => '(?:access[_-]?key|secret[_-]?key|api[_-]?key|token|credential|iam)',
            'score' => 0,
        ]);

        // Payroll with SSN
        $payrollPattern = RiskPattern::create([
            'title' => 'Payroll with SSN',
            'type' => 'criteria',
            'regex' => null,
            'score' => 35,
            'priority' => 'medium',
        ]);
        CriteriaPatternItem::create([
            'criteria_pattern_id' => $payrollPattern->id,
            'title' => 'HR/Payroll Context',
            'regex' => '(?:payroll|w-4|w-2|adp|benefits|onboarding|termination|separation)',
            'score' => 0,
        ]);
        CriteriaPatternItem::create([
            'criteria_pattern_id' => $payrollPattern->id,
            'title' => 'Personal Identifier',
            'regex' => '(?:\d{3}-\d{2}-\d{4}|\d{9}|(?:SSN|social\s?security))',
            'score' => 0,
        ]);
    }
}
