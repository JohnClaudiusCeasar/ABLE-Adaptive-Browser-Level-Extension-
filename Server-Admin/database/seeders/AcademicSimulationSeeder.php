<?php

namespace Database\Seeders;

use App\Models\CommunityMessage;
use App\Models\DomainPolicy;
use App\Models\DomainRecommendation;
use App\Models\DomainVisit;
use App\Models\EgressEvent;
use App\Models\ExtensionIntegrityEvent;
use App\Models\ExtensionLifecycle;
use App\Models\Notification;
use App\Models\NudgeInteraction;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AcademicSimulationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            // Seed data never ships to the production cloud database.
            // Production data changes ship via migrations with the DB layout.
            return;
        }

        $this->command?->info('Beginning ABLE 20-User Academic Usage & Effectiveness Simulation...');

        // 1. Clear existing telemetry data to establish a coherent, synchronized dataset
        $this->clearTelemetry();

        // 2. Define the 20 Client Users (Faculty & Students)
        $users = $this->getUserProfiles();

        // 3. Seed Domain Policies & Recommendations
        $domains = $this->seedDomainPolicies();
        $this->seedDomainRecommendations();

        // 4. Seed Extension Lifecycles for the 20 users
        $this->seedExtensionLifecycles($users);

        // 5. Seed 36-day Timeline of Domain Visits (Oct 5, 2026 -> Nov 9, 2026)
        $this->seedDomainVisits($users, $domains);

        // 6. Seed Egress Events, Interceptions, and Nudge Interactions
        $this->seedEgressAndNudges($users, $domains);

        // 7. Seed Extension Integrity Events
        $this->seedIntegrityEvents($users);

        // 8. Seed Community Feedback Messages
        $this->seedCommunityMessages($users);

        // 9. Sync & Seed Alert Notifications
        $this->seedNotifications();

        $this->command?->info('ABLE 20-User Academic Simulation seeded successfully!');
    }

    private function clearTelemetry(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DomainVisit::truncate();
        NudgeInteraction::truncate();
        EgressEvent::truncate();
        ExtensionLifecycle::truncate();
        ExtensionIntegrityEvent::truncate();
        Notification::truncate();
        DomainRecommendation::truncate();
        CommunityMessage::truncate();
        DomainPolicy::truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // Reset cache watermarks
        Cache::forget('able:notification-sync:egress');
        Cache::forget('able:notification-sync:domain');
        Cache::forget('able:notification-sync:extension');
        Cache::forget('able:notification-sync:integrity');
        Cache::forget('able:notification-sync:community');
        Cache::forget('able-settings:server');
        Cache::forget('able-settings:extension');
    }

    /**
     * @return array<int, array{id: string, role: string, persona: string, department: string, device: string}>
     */
    private function getUserProfiles(): array
    {
        return [
            // Faculty Members (6 users)
            [
                'id' => 'ABLE-F2P8M5KC',
                'role' => 'faculty',
                'persona' => 'Prof. Chen',
                'department' => 'Computer Science Dept Chair',
                'device' => 'MacBook Pro / Chrome',
            ],
            [
                'id' => 'ABLE-R7T4W9NB',
                'role' => 'faculty',
                'persona' => 'Dr. Santos',
                'department' => 'Nursing & Health Sciences Faculty',
                'device' => 'Dell Latitude / Chrome',
            ],
            [
                'id' => 'ABLE-M3K6H2VX',
                'role' => 'faculty',
                'persona' => 'Assoc. Prof. Davies',
                'department' => 'School of Business',
                'device' => 'ThinkPad T14 / Chrome',
            ],
            [
                'id' => 'ABLE-W5C8Y3PL',
                'role' => 'faculty',
                'persona' => 'Dr. Reynolds',
                'department' => 'Mechanical Engineering Faculty',
                'device' => 'HP EliteBook / Edge',
            ],
            [
                'id' => 'ABLE-E9N2V7TZ',
                'role' => 'faculty',
                'persona' => 'Prof. Garcia',
                'department' => 'Humanities & Social Sciences',
                'device' => 'MacBook Air / Chrome',
            ],
            [
                'id' => 'ABLE-T4B7S9MQ',
                'role' => 'faculty',
                'persona' => 'Instructor Rivera',
                'department' => 'Teaching Assistant / Lecturer',
                'device' => 'Dell Inspiron / Chrome',
            ],

            // Student Body (14 users)
            [
                'id' => 'ABLE-37VITWT7',
                'role' => 'student',
                'persona' => 'Alex C. (Senior)',
                'department' => 'Computer Science',
                'device' => 'Asus ROG / Chrome',
            ],
            [
                'id' => 'ABLE-KMGPJ7AX',
                'role' => 'student',
                'persona' => 'Maya R. (Junior)',
                'department' => 'Nursing',
                'device' => 'MacBook Air / Chrome',
            ],
            [
                'id' => 'ABLE-S8K2M9QA',
                'role' => 'student',
                'persona' => 'Kevin L. (Sophomore)',
                'department' => 'Computer Science',
                'device' => 'Acer Swift / Chrome',
            ],
            [
                'id' => 'ABLE-D4P9X7W2',
                'role' => 'student',
                'persona' => 'Chloe M. (Junior)',
                'department' => 'Nursing & Pre-Med',
                'device' => 'iPad Pro / Chrome',
            ],
            [
                'id' => 'ABLE-H3N7V5RC',
                'role' => 'student',
                'persona' => 'Brandon T. (Senior)',
                'department' => 'Business Analytics',
                'device' => 'Dell XPS 13 / Chrome',
            ],
            [
                'id' => 'ABLE-L6T2K8EY',
                'role' => 'student',
                'persona' => 'Ethan V. (Junior)',
                'department' => 'Mechanical Engineering',
                'device' => 'Lenovo Legion / Chrome',
            ],
            [
                'id' => 'ABLE-B9X4M2ZT',
                'role' => 'student',
                'persona' => 'Sarah K. (Sophomore)',
                'department' => 'Biology / Pre-Med',
                'device' => 'MacBook Pro / Chrome',
            ],
            [
                'id' => 'ABLE-J2W5N8PK',
                'role' => 'student',
                'persona' => 'Lucas D. (Senior)',
                'department' => 'Psychology',
                'device' => 'HP Envy / Chrome',
            ],
            [
                'id' => 'ABLE-C7R3F6HD',
                'role' => 'student',
                'persona' => 'Emily N. (Junior)',
                'department' => 'Secondary Education',
                'device' => 'Surface Laptop / Chrome',
            ],
            [
                'id' => 'ABLE-G5Y8Q2VS',
                'role' => 'student',
                'persona' => 'Ryan W. (Sophomore)',
                'department' => 'Multimedia Arts & Design',
                'device' => 'iMac / Chrome',
            ],
            [
                'id' => 'ABLE-P4M9T3BX',
                'role' => 'student',
                'persona' => 'Jason H. (Junior)',
                'department' => 'Information Technology',
                'device' => 'MSI Modern / Chrome',
            ],
            [
                'id' => 'ABLE-V8C2L5NE',
                'role' => 'student',
                'persona' => 'Sophia B. (Senior)',
                'department' => 'Economics & Finance',
                'device' => 'Dell Latitude / Chrome',
            ],
            [
                'id' => 'ABLE-K3H7J9WA',
                'role' => 'student',
                'persona' => 'Daniel G. (Graduate)',
                'department' => 'Data Science MS',
                'device' => 'ThinkPad X1 / Chrome',
            ],
            [
                'id' => 'ABLE-Z6F4R8QY',
                'role' => 'student',
                'persona' => 'Olivia S. (Freshman)',
                'department' => 'General Studies / Undecided',
                'device' => 'Acer Aspire / Chrome',
            ],
        ];
    }

    /**
     * @return array<string, DomainPolicy>
     */
    private function seedDomainPolicies(): array
    {
        $definitions = [
            // Education & Institutional LMS (Whitelisted / Safe)
            'canvas.instructure.com' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 0, 0],
            'blackboard.com' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 0, 0],
            'moodle.org' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 0, 0],
            'portal.university.edu' => ['safe', 'whitelisted', 'Education', 'pattern', 1.0, 0, 0],
            'library.university.edu' => ['safe', 'whitelisted', 'Education', 'pattern', 1.0, 0, 0],
            'scholar.google.com' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 10, 0],
            'jstor.org' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 15, 0],
            'researchgate.net' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 15, 0],
            'coursera.org' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 15, 0],
            'edx.org' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 15, 0],
            'khanacademy.org' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 10, 0],
            'quizlet.com' => ['safe', 'whitelisted', 'Education', 'brand', 1.0, 15, 0],

            // Institutional Productivity & Cloud (Whitelisted / Safe)
            'drive.google.com' => ['safe', 'whitelisted', 'Productivity', 'brand', 1.0, 0, 0],
            'docs.google.com' => ['safe', 'whitelisted', 'Productivity', 'brand', 1.0, 0, 0],
            'sheets.google.com' => ['safe', 'whitelisted', 'Productivity', 'brand', 1.0, 0, 0],
            'mail.google.com' => ['safe', 'whitelisted', 'Email', 'brand', 1.0, 0, 0],
            'teams.microsoft.com' => ['safe', 'whitelisted', 'Productivity', 'brand', 1.0, 0, 0],
            'zoom.us' => ['safe', 'whitelisted', 'Productivity', 'brand', 1.0, 0, 0],
            'overleaf.com' => ['safe', 'whitelisted', 'Developer Tools', 'brand', 0.95, 10, 0],
            'wikipedia.org' => ['safe', 'whitelisted', 'Reference', 'brand', 1.0, 10, 0],
            'britannica.com' => ['safe', 'whitelisted', 'Reference', 'brand', 1.0, 15, 0],
            'stackoverflow.com' => ['safe', 'whitelisted', 'Developer Tools', 'brand', 1.0, 20, 0],

            // Search Engines (Safe)
            'google.com' => ['safe', 'whitelisted', 'Search Engine', 'manual', 1.0, 10, 0],
            'bing.com' => ['safe', 'whitelisted', 'Search Engine', 'brand', 1.0, 10, 0],
            'duckduckgo.com' => ['safe', 'whitelisted', 'Search Engine', 'brand', 1.0, 10, 0],

            // Sanctioned Enterprise AI Tools (Safe)
            'copilot.microsoft.com' => ['safe', 'whitelisted', 'AI', 'brand', 1.0, 20, 0],
            'gemini.google.com' => ['safe', 'whitelisted', 'AI', 'brand', 1.0, 20, 0],

            // General & Unlisted External Productivity / Reference (Under Review)
            'notion.so' => ['unlisted', 'under_review', 'Productivity', 'brand', 1.0, 40, 0],
            'trello.com' => ['unlisted', 'under_review', 'Productivity', 'brand', 1.0, 35, 0],
            'canva.com' => ['unlisted', 'under_review', 'Productivity', 'brand', 0.95, 30, 0],
            'github.com' => ['unlisted', 'under_review', 'Developer Tools', 'brand', 1.0, 30, 0],
            'gitlab.com' => ['unlisted', 'under_review', 'Developer Tools', 'brand', 1.0, 30, 0],
            'grammarly.com' => ['unlisted', 'under_review', 'Reference', 'brand', 1.0, 40, 0],
            'wolframalpha.com' => ['unlisted', 'under_review', 'Reference', 'brand', 1.0, 25, 0],

            // AI Chat & Research Platforms (Unlisted / Monitored / Under Review)
            'chatgpt.com' => ['unlisted', 'under_review', 'AI', 'brand', 1.0, 50, 0],
            'claude.ai' => ['unlisted', 'under_review', 'AI', 'brand', 1.0, 50, 0],
            'perplexity.ai' => ['unlisted', 'under_review', 'AI', 'brand', 1.0, 50, 0],
            'deepseek.com' => ['unlisted', 'under_review', 'AI', 'brand', 1.0, 60, 0],
            'poe.com' => ['unlisted', 'under_review', 'AI', 'brand', 1.0, 55, 0],
            'v0.dev' => ['unlisted', 'under_review', 'AI', 'brand', 1.0, 50, 0],
            'chat.qwen.com' => ['unlisted', 'under_review', 'AI', 'heuristic', 0.85, 60, 0],

            // Campus Life & Media (Unlisted)
            'youtube.com' => ['safe', 'whitelisted', 'Streaming', 'brand', 1.0, 20, 0],
            'spotify.com' => ['safe', 'whitelisted', 'Streaming', 'brand', 1.0, 15, 0],
            'reddit.com' => ['unlisted', 'under_review', 'Social Media', 'brand', 1.0, 45, 0],
            'linkedin.com' => ['unlisted', 'under_review', 'Jobs & Careers', 'brand', 1.0, 35, 0],
            'amazon.com' => ['unlisted', 'under_review', 'E-commerce', 'brand', 1.0, 35, 0],
            'shopee.ph' => ['unlisted', 'under_review', 'E-commerce', 'brand', 1.0, 35, 0],
            'discord.com' => ['unlisted', 'under_review', 'Social Media', 'brand', 1.0, 40, 0],

            // High-Risk / Shadow IT / Cheating Services / Blacklisted (Unsafe)
            'coursehero-bypass.net' => ['unsafe', 'blacklisted', 'Education', 'heuristic', 0.95, 85, 1],
            'freepapers-hub.cc' => ['unsafe', 'blacklisted', 'Education', 'heuristic', 0.95, 85, 1],
            'essaytyper-premium.org' => ['unsafe', 'blacklisted', 'Education', 'heuristic', 0.90, 80, 0],
            'homework-solver-ai.biz' => ['unsafe', 'blacklisted', 'AI', 'heuristic', 0.90, 85, 0],
            'crackpdf-tools.online' => ['unsafe', 'blacklisted', 'Technology', 'heuristic', 0.95, 90, 1],
            'file-drop-temp.cc' => ['unsafe', 'blacklisted', 'Cloud & Hosting', 'heuristic', 0.95, 90, 1],
            'stake.com' => ['unsafe', 'blacklisted', 'Gambling', 'brand', 1.0, 95, 1],
            'anonymous-vault-transfer.io' => ['unsafe', 'blacklisted', 'Cloud & Hosting', 'heuristic', 0.95, 95, 1],
        ];

        $policies = [];
        $createdAt = Carbon::create(2026, 10, 4, 8, 0, 0);

        foreach ($definitions as $domain => [$status, $policy, $cat, $src, $conf, $risk, $block]) {
            $policies[$domain] = DomainPolicy::create([
                'domain' => $domain,
                'domain_status' => $status,
                'policy' => $policy,
                'category' => $cat,
                'classification_source' => $src,
                'confidence' => $conf,
                'risk_score' => $risk,
                'visit_count' => 0,
                'last_visited_at' => null,
                'last_source' => null,
                'block_access' => $block,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
        }

        return $policies;
    }

    private function seedDomainRecommendations(): void
    {
        $recommendations = [
            ['AI', 'copilot.microsoft.com'],
            ['AI', 'gemini.google.com'],
            ['Education', 'canvas.instructure.com'],
            ['Education', 'scholar.google.com'],
            ['Education', 'jstor.org'],
            ['Productivity', 'drive.google.com'],
            ['Productivity', 'docs.google.com'],
            ['Productivity', 'sheets.google.com'],
            ['Reference', 'wikipedia.org'],
            ['Reference', 'britannica.com'],
            ['Developer Tools', 'github.com'],
            ['Developer Tools', 'overleaf.com'],
            ['Cloud & Hosting', 'drive.google.com'],
        ];

        foreach ($recommendations as [$category, $domain]) {
            DomainRecommendation::create([
                'category' => $category,
                'domain' => $domain,
                'created_at' => Carbon::create(2026, 10, 5, 9, 0, 0),
                'updated_at' => Carbon::create(2026, 10, 5, 9, 0, 0),
            ]);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $users
     */
    private function seedExtensionLifecycles(array $users): void
    {
        $records = [];
        $extId = 'oiclgihhopkfdgkkpmllbgioiefgiknn';

        foreach ($users as $i => $u) {
            // Stagger install time between Oct 5 and Oct 7
            $installTime = Carbon::create(2026, 10, 5, 8, 30, 0)->addHours($i * 2)->addMinutes(($i * 13) % 45);

            $records[] = [
                'user_id' => $u['id'],
                'extension_id' => $extId,
                'event' => 'installed',
                'version' => '0.1.50',
                'occurred_at' => $installTime,
                'created_at' => $installTime,
                'updated_at' => $installTime,
            ];

            // Update to v0.1.56 around Oct 26-28
            $updateTime = Carbon::create(2026, 10, 26, 9, 15, 0)->addHours($i * 3)->addMinutes(($i * 7) % 50);
            $records[] = [
                'user_id' => $u['id'],
                'extension_id' => $extId,
                'event' => 'updated',
                'version' => '0.1.56',
                'occurred_at' => $updateTime,
                'created_at' => $updateTime,
                'updated_at' => $updateTime,
            ];
        }

        ExtensionLifecycle::insert($records);
    }

    /**
     * @param array<int, array<string, mixed>> $users
     * @param array<string, DomainPolicy> $domains
     */
    private function seedDomainVisits(array $users, array $domains): void
    {
        $startDate = Carbon::create(2026, 10, 5, 0, 0, 0);
        $endDate = Carbon::create(2026, 11, 9, 16, 0, 0);
        $totalDays = (int) $startDate->diffInDays($endDate);

        $domainList = array_keys($domains);

        // Define primary domain affinities based on role
        $facultyFavs = [
            'canvas.instructure.com', 'blackboard.com', 'docs.google.com', 'sheets.google.com',
            'drive.google.com', 'mail.google.com', 'teams.microsoft.com', 'zoom.us',
            'scholar.google.com', 'jstor.org', 'researchgate.net', 'portal.university.edu',
            'chatgpt.com', 'claude.ai', 'copilot.microsoft.com', 'wikipedia.org', 'overleaf.com',
        ];

        $studentFavs = [
            'canvas.instructure.com', 'docs.google.com', 'drive.google.com', 'google.com',
            'scholar.google.com', 'quizlet.com', 'khanacademy.org', 'coursera.org',
            'chatgpt.com', 'claude.ai', 'perplexity.ai', 'deepseek.com', 'gemini.google.com',
            'youtube.com', 'spotify.com', 'reddit.com', 'discord.com', 'github.com',
            'stackoverflow.com', 'notion.so', 'grammarly.com', 'portal.university.edu',
            'coursehero-bypass.net', 'freepapers-hub.cc',
        ];

        $domainCounters = array_fill_keys($domainList, 0);
        $domainLastVisit = array_fill_keys($domainList, null);

        $chunk = [];
        $chunkSize = 500;

        for ($day = 0; $day <= $totalDays; $day++) {
            $currentDate = $startDate->copy()->addDays($day);
            $isWeekend = $currentDate->isWeekend();

            foreach ($users as $user) {
                // Students & Teachers are somewhat less active on weekends
                if ($isWeekend && rand(1, 100) > 65) {
                    continue;
                }

                $pool = $user['role'] === 'faculty' ? $facultyFavs : $studentFavs;
                $visitCount = $isWeekend ? rand(8, 18) : rand(18, 38);

                for ($v = 0; $v < $visitCount; $v++) {
                    // Pick domain according to weight
                    if (rand(1, 100) <= 75) {
                        $domain = $pool[array_rand($pool)];
                    } else {
                        $domain = $domainList[array_rand($domainList)];
                    }

                    $policy = $domains[$domain];

                    // Realistic time distribution (8am - 11pm)
                    $hour = rand(8, 22);
                    $minute = rand(0, 59);
                    $second = rand(0, 59);
                    $visitedAt = $currentDate->copy()->setHour($hour)->setMinute($minute)->setSecond($second);

                    if ($visitedAt->greaterThan($endDate)) {
                        continue;
                    }

                    $domainCounters[$domain]++;
                    if ($domainLastVisit[$domain] === null || $visitedAt->greaterThan($domainLastVisit[$domain])) {
                        $domainLastVisit[$domain] = $visitedAt;
                    }

                    $chunk[] = [
                        'event_id' => (string) Str::uuid(),
                        'domain_policy_id' => $policy->id,
                        'domain' => $domain,
                        'user_id' => $user['id'],
                        'status' => $policy->domain_status,
                        'risk_score' => $policy->risk_score,
                        'visited_at' => $visitedAt,
                        'created_at' => $visitedAt,
                        'updated_at' => $visitedAt,
                    ];

                    if (count($chunk) >= $chunkSize) {
                        DomainVisit::insert($chunk);
                        $chunk = [];
                    }
                }
            }
        }

        if (! empty($chunk)) {
            DomainVisit::insert($chunk);
        }

        // Update domain policy visit counts & last visited timestamps
        foreach ($domainCounters as $dom => $cnt) {
            if ($cnt > 0) {
                DomainPolicy::where('domain', $dom)->update([
                    'visit_count' => $cnt,
                    'last_visited_at' => $domainLastVisit[$dom],
                    'last_source' => 'navigation:typed',
                    'updated_at' => $domainLastVisit[$dom] ?? now(),
                ]);
            }
        }
    }

    /**
     * @param array<int, array<string, mixed>> $users
     * @param array<string, DomainPolicy> $domains
     */
    private function seedEgressAndNudges(array $users, array $domains): void
    {
        $startDate = Carbon::create(2026, 10, 5, 8, 0, 0);
        $endDate = Carbon::create(2026, 11, 9, 15, 30, 0);

        // Predefined realistic files for students & faculty
        $safeUploads = [
            ['CS101_Assignment2_Code.zip', 450 * 1024, 'canvas.instructure.com'],
            ['LabReport_Chemistry_Titration_Week3.docx', 820 * 1024, 'canvas.instructure.com'],
            ['Calculus_ProblemSet_4_Solutions.pdf', 1250 * 1024, 'canvas.instructure.com'],
            ['History_Term_Paper_Draft1.docx', 340 * 1024, 'docs.google.com'],
            ['Nursing_CarePlan_Pediatrics_Case.pdf', 1580 * 1024, 'canvas.instructure.com'],
            ['Syllabus_Fall2026_DataStructures.pdf', 410 * 1024, 'canvas.instructure.com'],
            ['Lecture05_VirtualMemory_OS.pptx', 4500 * 1024, 'drive.google.com'],
            ['Midterm_Review_Session_Slides.pdf', 2800 * 1024, 'portal.university.edu'],
            ['Macroeconomics_Project_Group3.xlsx', 920 * 1024, 'sheets.google.com'],
            ['CAD_Drawing_Gearbox_Assembly.pdf', 3400 * 1024, 'moodle.org'],
            ['Psychology_ResearchProposal_Final.docx', 650 * 1024, 'docs.google.com'],
            ['Resume_Summer2027_Internship.pdf', 180 * 1024, 'drive.google.com'],
            ['Biochem_ReactionKinetics_Data.xlsx', 780 * 1024, 'sheets.google.com'],
            ['Literature_Review_Thesis_Overleaf.pdf', 2100 * 1024, 'overleaf.com'],
            ['Robotics_Arduino_Firmware.zip', 560 * 1024, 'github.com'],
            ['Ethics_Essay_Philosophy101.docx', 290 * 1024, 'docs.google.com'],
            ['ClinicalSkills_Checklist_Signed.pdf', 1100 * 1024, 'canvas.instructure.com'],
            ['LinearAlgebra_HW6_Submitted.pdf', 940 * 1024, 'moodle.org'],
        ];

        // Sensitive/High-Risk Files that trigger Nudges & Containment
        $sensitiveIncidents = [
            [
                'name' => 'Master_Gradebook_Fall2026_AllSections.xlsx',
                'size' => 645 * 1024,
                'target' => 'chatgpt.com',
                'score' => 95,
                'flags' => [
                    ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50],
                    ['label' => 'COMPLETE STUDENT PII CLUSTER', 'count' => 2, 'weight' => 45],
                    ['label' => 'OFFICIAL TRANSCRIPT OF RECORDS (TOR)', 'count' => 14, 'weight' => 80],
                ],
                'uploader_role' => 'faculty',
            ],
            [
                'name' => 'Student_Information_Sheet_Scholarship_2026.xlsx',
                'size' => 1450 * 1024,
                'target' => 'claude.ai',
                'score' => 90,
                'flags' => [
                    ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50],
                    ['label' => 'SSN - Standard Format', 'count' => 15, 'weight' => 70],
                    ['label' => 'COMPLETE STUDENT PII CLUSTER', 'count' => 1, 'weight' => 45],
                ],
                'uploader_role' => 'faculty',
            ],
            [
                'name' => 'Official_Transcript_Of_Records_Batch_Export.pdf',
                'size' => 3800 * 1024,
                'target' => 'deepseek.com',
                'score' => 95,
                'flags' => [
                    ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 60],
                    ['label' => 'OFFICIAL TRANSCRIPT OF RECORDS (TOR)', 'count' => 10, 'weight' => 85],
                ],
                'uploader_role' => 'faculty',
            ],
            [
                'name' => 'Department_Payroll_Faculty_Stipends.xlsx',
                'size' => 890 * 1024,
                'target' => 'chatgpt.com',
                'score' => 85,
                'flags' => [
                    ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50],
                    ['label' => 'Payroll with SSN', 'count' => 1, 'weight' => 45],
                    ['label' => 'SSN - Standard Format', 'count' => 8, 'weight' => 40],
                ],
                'uploader_role' => 'faculty',
            ],
            [
                'name' => 'CS301_Final_Exam_Draft_Confidential.docx',
                'size' => 420 * 1024,
                'target' => 'chatgpt.com',
                'score' => 85,
                'flags' => [
                    ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50],
                    ['label' => 'Document Classification Label', 'count' => 1, 'weight' => 25],
                    ['label' => 'COMPLETE STUDENT PII CLUSTER', 'count' => 1, 'weight' => 45],
                ],
                'uploader_role' => 'faculty',
            ],
            [
                'name' => 'aws_credentials_and_db_passwords.env',
                'size' => 14 * 1024,
                'target' => 'chatgpt.com',
                'score' => 100,
                'flags' => [
                    ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50],
                    ['label' => 'AWS Access Key ID', 'count' => 2, 'weight' => 45],
                    ['label' => 'Password Assignment', 'count' => 4, 'weight' => 35],
                ],
                'uploader_role' => 'student',
            ],
            [
                'name' => 'Nursing_Clinical_Evaluations_Fall2026.pdf',
                'size' => 1950 * 1024,
                'target' => 'perplexity.ai',
                'score' => 90,
                'flags' => [
                    ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50],
                    ['label' => 'COMPLETE STUDENT PII CLUSTER', 'count' => 3, 'weight' => 55],
                ],
                'uploader_role' => 'faculty',
            ],
            [
                'name' => 'Student_Disciplinary_Records_Confidential.docx',
                'size' => 580 * 1024,
                'target' => 'claude.ai',
                'score' => 95,
                'flags' => [
                    ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50],
                    ['label' => 'COMPLETE STUDENT PII CLUSTER', 'count' => 2, 'weight' => 50],
                ],
                'uploader_role' => 'faculty',
            ],
            [
                'name' => 'stripe_live_tokens_backend.json',
                'size' => 18 * 1024,
                'target' => 'v0.dev',
                'score' => 90,
                'flags' => [
                    ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50],
                    ['label' => 'Stripe API Key', 'count' => 2, 'weight' => 45],
                ],
                'uploader_role' => 'student',
            ],
            [
                'name' => 'Student_ID_Scans_Batch_Enrollment.zip',
                'size' => 14500 * 1024,
                'target' => 'file-drop-temp.cc',
                'score' => 95,
                'flags' => [
                    ['label' => 'Domain Risk (Unsafe)', 'count' => 1, 'weight' => 70],
                    ['label' => 'COMPLETE STUDENT PII CLUSTER', 'count' => 5, 'weight' => 60],
                ],
                'uploader_role' => 'student',
            ],
            [
                'name' => 'Chegg_Midterm_Questions_Scrape.docx',
                'size' => 840 * 1024,
                'target' => 'homework-solver-ai.biz',
                'score' => 85,
                'flags' => [
                    ['label' => 'Domain Risk (Unsafe)', 'count' => 1, 'weight' => 70],
                    ['label' => 'Document Classification Label', 'count' => 1, 'weight' => 25],
                ],
                'uploader_role' => 'student',
            ],
            [
                'name' => 'TermPaper_Pirated_Source_Code.zip',
                'size' => 2400 * 1024,
                'target' => 'freepapers-hub.cc',
                'score' => 90,
                'flags' => [
                    ['label' => 'Domain Risk (Unsafe)', 'count' => 1, 'weight' => 70],
                    ['label' => 'Document Classification Label', 'count' => 1, 'weight' => 30],
                ],
                'uploader_role' => 'student',
            ],
        ];

        // Moderate-Risk Files (Advisory Nudges)
        $moderateNudges = [
            [
                'name' => 'Bio101_Lecture_Slide_Notes.pdf',
                'size' => 1200 * 1024,
                'target' => 'chatgpt.com',
                'score' => 50,
                'flags' => [['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50]],
            ],
            [
                'name' => 'Economics_Data_Public_FRED.csv',
                'size' => 850 * 1024,
                'target' => 'deepseek.com',
                'score' => 60,
                'flags' => [['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 60]],
            ],
            [
                'name' => 'Sample_Resume_Template_Blank.docx',
                'size' => 150 * 1024,
                'target' => 'perplexity.ai',
                'score' => 50,
                'flags' => [['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50]],
            ],
            [
                'name' => 'Literature_Review_Summary_Draft.docx',
                'size' => 320 * 1024,
                'target' => 'claude.ai',
                'score' => 50,
                'flags' => [['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50]],
            ],
            [
                'name' => 'Python_Algorithm_Homework_Draft.py',
                'size' => 45 * 1024,
                'target' => 'chatgpt.com',
                'score' => 50,
                'flags' => [['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50]],
            ],
            [
                'name' => 'History_Essay_Outline_FrenchRevolution.pdf',
                'size' => 280 * 1024,
                'target' => 'poe.com',
                'score' => 55,
                'flags' => [['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 55]],
            ],
        ];

        // We will generate ~210 total egress events:
        // ~105 allowed, ~72 denied (containment), ~33 proceeded
        $totalDays = (int) $startDate->diffInDays($endDate);

        $facultyUsers = array_filter($users, fn ($u) => $u['role'] === 'faculty');
        $studentUsers = array_filter($users, fn ($u) => $u['role'] === 'student');

        for ($day = 0; $day <= $totalDays; $day++) {
            $currentDate = $startDate->copy()->addDays($day);
            $weekNum = (int) floor($day / 7) + 1; // 1 to 5

            // (A) Routine Allowed Uploads to Canvas/LMS/Drive (2-4 per day)
            $dailyAllowed = rand(2, 4);
            for ($a = 0; $a < $dailyAllowed; $a++) {
                $user = $users[array_rand($users)];
                $fileDef = $safeUploads[array_rand($safeUploads)];
                $eventTime = $currentDate->copy()->setHour(rand(9, 21))->setMinute(rand(0, 59))->setSecond(rand(0, 59));

                if ($eventTime->greaterThan($endDate)) {
                    continue;
                }

                EgressEvent::create([
                    'event_id' => (string) Str::uuid(),
                    'domain' => $fileDef[2],
                    'user_id' => $user['id'],
                    'file_name' => $fileDef[0],
                    'file_size' => $fileDef[1],
                    'action' => 'allowed',
                    'risk_score' => $domains[$fileDef[2]]->risk_score ?? 0,
                    'flagged_items' => null,
                    'content_hash' => hash('sha256', $fileDef[0].$eventTime->timestamp),
                    'occurred_at' => $eventTime,
                    'created_at' => $eventTime,
                    'updated_at' => $eventTime,
                ]);
            }

            // (B) Intercepted Sensitive / Risky Uploads (1-3 per day)
            $dailyInterceptions = rand(1, 3);
            for ($s = 0; $s < $dailyInterceptions; $s++) {
                $isHighRisk = rand(1, 100) <= 65;

                if ($isHighRisk) {
                    $template = $sensitiveIncidents[array_rand($sensitiveIncidents)];
                    $userPool = $template['uploader_role'] === 'faculty' ? $facultyUsers : $studentUsers;
                    $user = $userPool[array_rand($userPool)];

                    // Theoretical Effectiveness: Containment success improves week over week!
                    // Week 1: 75% cancelled, Week 2: 85% cancelled, Week 3-5: 92-96% cancelled
                    $cancelProbability = match ($weekNum) {
                        1 => 75,
                        2 => 85,
                        3 => 92,
                        default => 96,
                    };

                    $cancelled = rand(1, 100) <= $cancelProbability;
                    $action = $cancelled ? 'denied' : 'proceeded';
                    $userAction = $cancelled ? 'cancelled' : 'proceeded';

                    $score = $template['score'];
                    $flags = $template['flags'];
                    $fileName = $template['name'];
                    $fileSize = $template['size'];
                    $targetDomain = $template['target'];
                } else {
                    $template = $moderateNudges[array_rand($moderateNudges)];
                    $user = $users[array_rand($users)];

                    // Moderate risk: lower containment as users consciously proceed with non-sensitive notes
                    $cancelProbability = match ($weekNum) {
                        1 => 35,
                        2 => 45,
                        3 => 55,
                        default => 60,
                    };

                    $cancelled = rand(1, 100) <= $cancelProbability;
                    $action = $cancelled ? 'denied' : 'proceeded';
                    $userAction = $cancelled ? 'cancelled' : 'proceeded';

                    $score = $template['score'];
                    $flags = $template['flags'];
                    $fileName = $template['name'];
                    $fileSize = $template['size'];
                    $targetDomain = $template['target'];
                }

                $eventTime = $currentDate->copy()->setHour(rand(10, 22))->setMinute(rand(0, 59))->setSecond(rand(0, 59));
                if ($eventTime->greaterThan($endDate)) {
                    continue;
                }

                $egress = EgressEvent::create([
                    'event_id' => (string) Str::uuid(),
                    'domain' => $targetDomain,
                    'user_id' => $user['id'],
                    'file_name' => $fileName,
                    'file_size' => $fileSize,
                    'action' => $action,
                    'risk_score' => $score,
                    'flagged_items' => $flags,
                    'content_hash' => hash('sha256', $fileName.$user['id'].$eventTime->timestamp),
                    'occurred_at' => $eventTime,
                    'created_at' => $eventTime,
                    'updated_at' => $eventTime,
                ]);

                // Create corresponding Nudge Interaction
                NudgeInteraction::create([
                    'egress_event_id' => $egress->id,
                    'domain' => $targetDomain,
                    'user_id' => $user['id'],
                    'user_action' => $userAction,
                    'interacted_at' => $eventTime->copy()->addSeconds(rand(3, 14)),
                    'created_at' => $eventTime,
                    'updated_at' => $eventTime,
                ]);
            }

            // (C) Occasional Text-Intercept events (every 2-3 days)
            if ($day % 2 === 0) {
                $user = $users[array_rand($users)];
                $eventTime = $currentDate->copy()->setHour(rand(11, 20))->setMinute(rand(0, 59))->setSecond(rand(0, 59));

                if (! $eventTime->greaterThan($endDate)) {
                    $cancelled = rand(1, 100) <= 85;
                    $action = $cancelled ? 'blocked' : 'proceeded';

                    $egress = EgressEvent::create([
                        'event_id' => (string) Str::uuid(),
                        'domain' => 'chatgpt.com',
                        'user_id' => $user['id'],
                        'file_name' => '[text-input]',
                        'file_size' => rand(480, 2400),
                        'action' => $action,
                        'risk_score' => 85,
                        'flagged_items' => [
                            ['label' => 'Domain Risk (Unlisted)', 'count' => 1, 'weight' => 50],
                            ['label' => 'SSN - Standard Format', 'count' => 1, 'weight' => 35],
                        ],
                        'content_hash' => hash('sha256', 'text-input-'.$eventTime->timestamp),
                        'occurred_at' => $eventTime,
                        'created_at' => $eventTime,
                        'updated_at' => $eventTime,
                    ]);

                    NudgeInteraction::create([
                        'egress_event_id' => $egress->id,
                        'domain' => 'chatgpt.com',
                        'user_id' => $user['id'],
                        'user_action' => $cancelled ? 'cancelled' : 'proceeded',
                        'interacted_at' => $eventTime->copy()->addSeconds(rand(2, 6)),
                        'created_at' => $eventTime,
                        'updated_at' => $eventTime,
                    ]);
                }
            }
        }
    }

    /**
     * @param array<int, array<string, mixed>> $users
     */
    private function seedIntegrityEvents(array $users): void
    {
        $events = [
            [
                'user_id' => 'ABLE-Z6F4R8QY',
                'domain' => 'coursehero-bypass.net',
                'reason' => 'devtools_opened,script_tamper',
                'occurred_at' => Carbon::create(2026, 10, 18, 14, 22, 10),
            ],
            [
                'user_id' => 'ABLE-P4M9T3BX',
                'domain' => 'file-drop-temp.cc',
                'reason' => 'fetch,xhr.send',
                'occurred_at' => Carbon::create(2026, 10, 29, 20, 11, 45),
            ],
            [
                'user_id' => 'ABLE-KMGPJ7AX',
                'domain' => 'chat.qwen.com',
                'reason' => 'fetch,xhr.send',
                'occurred_at' => Carbon::create(2026, 11, 6, 17, 30, 41),
            ],
        ];

        foreach ($events as $e) {
            ExtensionIntegrityEvent::create([
                'user_id' => $e['user_id'],
                'domain' => $e['domain'],
                'reason' => $e['reason'],
                'extension_id' => 'oiclgihhopkfdgkkpmllbgioiefgiknn',
                'version' => '0.1.56',
                'event_id' => (string) Str::uuid(),
                'occurred_at' => $e['occurred_at'],
                'created_at' => $e['occurred_at'],
                'updated_at' => $e['occurred_at'],
            ]);
        }
    }

    /**
     * @param array<int, array<string, mixed>> $users
     */
    private function seedCommunityMessages(array $users): void
    {
        $messages = [
            [
                'author' => 'Prof. Chen (CS Chair)',
                'category' => 'suggestion',
                'domain' => 'overleaf.com',
                'message' => 'Requesting whitelisting for overleaf.com across the Computer Science faculty. Our graduate students and research teams use it daily for LaTeX paper collaborations.',
                'ip_address' => '10.20.14.8',
                'status' => 'approved',
                'created_at' => Carbon::create(2026, 10, 12, 10, 15, 0),
            ],
            [
                'author' => 'Dr. Santos (Nursing Faculty)',
                'category' => 'comment',
                'domain' => 'claude.ai',
                'message' => 'The intercept modal stopped me from accidentally pasting our clinical patient evaluation sheet into Claude.ai. The clear breakdown made me realize real student PII was still present.',
                'ip_address' => '10.20.22.41',
                'status' => 'approved',
                'created_at' => Carbon::create(2026, 10, 19, 16, 40, 0),
            ],
            [
                'author' => 'Kevin L. (Student)',
                'category' => 'false-positive',
                'domain' => 'github.com',
                'message' => 'A 40-character git commit hash triggered high-entropy secret detection when committing our CS group project. Could git commit hashes have domain-level heuristic weights?',
                'ip_address' => '192.168.4.112',
                'status' => 'approved',
                'created_at' => Carbon::create(2026, 10, 24, 11, 20, 0),
            ],
            [
                'author' => 'Campus IT Security Officer',
                'category' => 'comment',
                'domain' => 'portal.university.edu',
                'message' => 'The pseudonymous device IDs (ABLE-XXXXXXXX) make this compliant with FERPA privacy mandates while providing complete behavioral analytics.',
                'ip_address' => '10.20.1.5',
                'status' => 'approved',
                'created_at' => Carbon::create(2026, 10, 30, 9, 0, 0),
            ],
            [
                'author' => 'Assoc. Prof. Davies',
                'category' => 'suggestion',
                'domain' => 'chatgpt.com',
                'message' => 'The ABLE Recommends banner suggested Copilot (our enterprise campus tool) when someone attempted to open an unlisted external AI chatbot. Great nudge toward sanctioned tools.',
                'ip_address' => '10.20.18.99',
                'status' => 'approved',
                'created_at' => Carbon::create(2026, 11, 2, 14, 10, 0),
            ],
            [
                'author' => 'Maya R. (Student)',
                'category' => 'comment',
                'domain' => 'canvas.instructure.com',
                'message' => 'Uploading lab reports to Canvas has zero lag. Good to know routine coursework transfers are seamlessly allowed without false alarms.',
                'ip_address' => '192.168.7.53',
                'status' => 'approved',
                'created_at' => Carbon::create(2026, 11, 5, 18, 30, 0),
            ],
            [
                'author' => 'Security Audit Team',
                'category' => 'suggestion',
                'domain' => 'chat.openai.com',
                'message' => 'Holding the request at the DOM event level completely prevents token exfiltration into AI chat contexts. Very impressed with the containment rate on critical documents.',
                'ip_address' => '10.20.1.12',
                'status' => 'approved',
                'created_at' => Carbon::create(2026, 11, 8, 11, 0, 0),
            ],
        ];

        foreach ($messages as $m) {
            CommunityMessage::create([
                'author' => $m['author'],
                'category' => $m['category'],
                'domain' => $m['domain'],
                'message' => $m['message'],
                'ip_address' => $m['ip_address'],
                'status' => $m['status'],
                'created_at' => $m['created_at'],
                'updated_at' => $m['created_at'],
            ]);
        }
    }

    private function seedNotifications(): void
    {
        $notifications = [];
        $cutoffDate = Carbon::create(2026, 11, 5, 0, 0, 0);

        // 1. Egress Notifications (All intercepted and processed events)
        $egressEvents = EgressEvent::orderBy('occurred_at')->get();
        $nudgeMap = NudgeInteraction::pluck('user_action', 'egress_event_id');

        foreach ($egressEvents as $event) {
            $nudgeAction = $nudgeMap->get($event->id);

            $type = match (true) {
                $event->action === 'allowed' => 'Egress Allowed',
                $nudgeAction === 'cancelled' => 'Nudge Success - Upload Cancelled',
                $nudgeAction === 'proceeded' => 'Egress Event Detected',
                $event->action === 'denied' || $event->action === 'blocked' => 'Egress Attempt Blocked',
                default => 'Egress Event Detected',
            };

            $sizeStr = $this->formatFileSize($event->file_size);
            $desc = match (true) {
                $event->action === 'allowed' => "{$event->file_name} ({$sizeStr}) — upload allowed on safe domain {$event->domain}",
                $nudgeAction === 'cancelled' => "{$event->file_name} ({$sizeStr}) — user cancelled upload after nudge prompt",
                $nudgeAction === 'proceeded' => "{$event->file_name} ({$sizeStr}) — user proceeded with upload after nudge prompt",
                default => "{$event->file_name} ({$sizeStr}) — upload blocked by policy",
            };

            $status = match (true) {
                $event->risk_score >= 85 => 'glass-unsafe',
                $event->risk_score >= 31 => 'glass-unlisted',
                default => 'glass-safe',
            };

            $isUnread = $event->occurred_at->greaterThanOrEqualTo($cutoffDate);
            $readAt = $isUnread ? null : $event->occurred_at->copy()->addMinutes(rand(10, 180));

            $notifications[] = [
                'source' => 'egress',
                'type' => $type,
                'description' => $desc,
                'domain' => $event->domain,
                'user_id' => $event->user_id,
                'email' => null,
                'ip_address' => null,
                'risk_score' => $event->risk_score,
                'status' => $status,
                'message' => 'egress-event-'.$event->id,
                'occurred_at' => $event->occurred_at,
                'read_at' => $readAt,
                'created_at' => $event->occurred_at,
                'updated_at' => $readAt ?? $event->occurred_at,
            ];
        }

        // 2. Extension Lifecycle Notifications
        foreach (ExtensionLifecycle::orderBy('occurred_at')->get() as $lifecycle) {
            $typeMap = [
                'installed' => 'Extension Installed',
                'updated' => 'Extension Updated',
                'uninstalled' => 'Extension Uninstalled',
            ];

            $statusMap = [
                'installed' => 'glass-safe',
                'updated' => 'glass-unlisted',
                'uninstalled' => 'glass-unsafe',
            ];

            $isUnread = $lifecycle->occurred_at->greaterThanOrEqualTo($cutoffDate);
            $readAt = $isUnread ? null : $lifecycle->occurred_at->copy()->addMinutes(rand(10, 180));

            $notifications[] = [
                'source' => 'extension',
                'type' => $typeMap[$lifecycle->event] ?? 'Extension Event',
                'description' => "Extension {$lifecycle->extension_id} {$lifecycle->event} by user {$lifecycle->user_id}",
                'domain' => null,
                'user_id' => $lifecycle->user_id,
                'email' => null,
                'ip_address' => null,
                'risk_score' => null,
                'status' => $statusMap[$lifecycle->event] ?? 'glass-unlisted',
                'message' => 'extension-lifecycle-'.$lifecycle->id,
                'occurred_at' => $lifecycle->occurred_at,
                'read_at' => $readAt,
                'created_at' => $lifecycle->occurred_at,
                'updated_at' => $readAt ?? $lifecycle->occurred_at,
            ];
        }

        // 3. Extension Integrity Notifications
        foreach (ExtensionIntegrityEvent::orderBy('occurred_at')->get() as $integrity) {
            $isUnread = $integrity->occurred_at->greaterThanOrEqualTo($cutoffDate);
            $readAt = $isUnread ? null : $integrity->occurred_at->copy()->addMinutes(rand(5, 60));

            $notifications[] = [
                'source' => 'integrity',
                'type' => 'Extension Guard Tampered',
                'description' => "ABLE guard tampering detected on {$integrity->domain} by {$integrity->user_id} (signal: {$integrity->reason})",
                'domain' => $integrity->domain,
                'user_id' => $integrity->user_id,
                'email' => null,
                'ip_address' => null,
                'risk_score' => null,
                'status' => 'glass-unsafe',
                'message' => 'extension-integrity-'.$integrity->id,
                'occurred_at' => $integrity->occurred_at,
                'read_at' => $readAt,
                'created_at' => $integrity->occurred_at,
                'updated_at' => $readAt ?? $integrity->occurred_at,
            ];
        }

        // 4. Community Feedback Notifications
        foreach (CommunityMessage::orderBy('created_at')->get() as $msg) {
            $isUnread = $msg->created_at->greaterThanOrEqualTo($cutoffDate);
            $readAt = $isUnread ? null : $msg->created_at->copy()->addMinutes(rand(15, 120));

            $notifications[] = [
                'source' => 'community',
                'type' => 'Community Feedback Approved',
                'description' => "Community message from {$msg->author} ({$msg->category})",
                'domain' => $msg->domain,
                'user_id' => null,
                'email' => null,
                'ip_address' => $msg->ip_address,
                'risk_score' => null,
                'status' => 'glass-safe',
                'message' => 'community-message-'.$msg->id,
                'occurred_at' => $msg->created_at,
                'read_at' => $readAt,
                'created_at' => $msg->created_at,
                'updated_at' => $readAt ?? $msg->created_at,
            ];
        }

        // Insert in chunks of 200
        foreach (array_chunk($notifications, 200) as $chunk) {
            Notification::insert($chunk);
        }

        // Advance watermarks in Cache to prevent redundant duplicate queries in SyncNotifications
        $maxEgress = EgressEvent::max('id') ?? 0;
        $maxDomain = DomainVisit::max('id') ?? 0;
        $maxLifecycle = ExtensionLifecycle::max('id') ?? 0;
        $maxIntegrity = ExtensionIntegrityEvent::max('id') ?? 0;
        $maxCommunity = CommunityMessage::max('id') ?? 0;

        Cache::forever('able:notification-sync:egress', $maxEgress);
        Cache::forever('able:notification-sync:domain', $maxDomain);
        Cache::forever('able:notification-sync:extension', $maxLifecycle);
        Cache::forever('able:notification-sync:integrity', $maxIntegrity);
        Cache::forever('able:notification-sync:community', $maxCommunity);
    }

    private function formatFileSize(int $bytes): string
    {
        return match (true) {
            $bytes >= 1073741824 => round($bytes / 1073741824, 1).' GB',
            $bytes >= 1048576 => round($bytes / 1048576, 1).' MB',
            $bytes >= 1024 => round($bytes / 1024, 1).' KB',
            default => $bytes.' B',
        };
    }
}
