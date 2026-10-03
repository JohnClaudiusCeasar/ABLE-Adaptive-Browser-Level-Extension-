<?php

namespace App\Http\Controllers;

use App\Models\CriteriaPatternItem;
use App\Models\EgressEvent;
use App\Models\RiskPattern;
use App\Rules\CompilableRegex;
use App\Support\JsCanonical;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class RiskPatternController extends Controller
{
    /**
     * Display a listing of the risk patterns.
     */
    public function index(Request $request): Response
    {
        $riskPatterns = RiskPattern::with('criteriaPatternItems')
            ->orderBy('created_at', 'desc')
            ->get();

        $singlePatterns = $riskPatterns->filter(fn (RiskPattern $p) => $p->type === 'single')->values();
        $criteriaPatterns = $riskPatterns->filter(fn (RiskPattern $p) => $p->type === 'criteria')->values();

        if ($request->path() === 'risk-algorithm/criteria') {
            return Inertia::render('risk-algorithm/criteria', [
                'riskPatterns' => $criteriaPatterns,
                'existingPatterns' => $riskPatterns->values(),
                'egressStats' => $this->buildEgressStats(),
            ]);
        }

        return Inertia::render('risk-algorithm/single', [
            'riskPatterns' => $singlePatterns,
            'criteriaPatterns' => $criteriaPatterns,
            'flagCounts' => $this->buildFlagCounts(),
            'egressStats' => $this->buildEgressStats(),
        ]);
    }

    /**
     * Tally how many egress events flagged each pattern.
     *
     * @return array<string, int>
     */
    private function buildFlagCounts(): array
    {
        $flagCounts = [];

        EgressEvent::query()
            ->whereNotNull('flagged_items')
            ->get(['flagged_items'])
            ->each(function (EgressEvent $event) use (&$flagCounts): void {
                /** @var array<int, mixed> $items */
                $items = is_array($event->flagged_items) ? $event->flagged_items : [];

                foreach ($items as $item) {
                    $label = is_array($item) ? ($item['label'] ?? null) : null;

                    if (is_string($label) && $label !== '') {
                        $flagCounts[$label] = ($flagCounts[$label] ?? 0) + 1;
                    }
                }
            });

        return $flagCounts;
    }

    /**
     * Build egress statistics for the risk algorithm page audit panel.
     *
     * @return array<string, mixed>
     */
    private function buildEgressStats(): array
    {
        $since = now()->subHours(24);

        $totalEvents = EgressEvent::where('occurred_at', '>=', $since)->count();

        $bucketLow = EgressEvent::where('occurred_at', '>=', $since)->where('risk_score', '<=', 30)->count();
        $bucketMedium = EgressEvent::where('occurred_at', '>=', $since)->whereBetween('risk_score', [31, 84])->count();
        $bucketHigh = EgressEvent::where('occurred_at', '>=', $since)->where('risk_score', '>=', 85)->count();

        $byAction = EgressEvent::where('occurred_at', '>=', $since)
            ->selectRaw('action, COUNT(*) as count')
            ->groupBy('action')
            ->pluck('count', 'action');

        $topFlagged = EgressEvent::whereNotNull('flagged_items')
            ->where('occurred_at', '>=', $since)
            ->get(['flagged_items'])
            ->flatMap(function ($event) {
                return (array) $event->flagged_items;
            })
            ->groupBy('label')
            ->map(function ($items) {
                return count($items);
            })
            ->sortDesc()
            ->take(10)
            ->toArray();

        return [
            'totalEvents24h' => $totalEvents,
            'bucketLow' => $bucketLow,
            'bucketMedium' => $bucketMedium,
            'bucketHigh' => $bucketHigh,
            'byAction' => [
                'proceeded' => $byAction->get('proceeded', 0),
                'denied' => $byAction->get('denied', 0),
                'allowed' => $byAction->get('allowed', 0),
            ],
            'topFlagged' => $topFlagged,
        ];
    }

    /**
     * Display the standalone page for creating a new criteria pattern.
     */
    public function createCriteria(): Response
    {
        $existingPatterns = RiskPattern::with('criteriaPatternItems')
            ->whereIn('type', ['single', 'criteria'])
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('risk-algorithm/create-criteria', [
            'existingPatterns' => $existingPatterns,
        ]);
    }

    /**
     * Display the standalone page for editing an existing criteria pattern.
     */
    public function editCriteria(RiskPattern $riskPattern): Response
    {
        $existingPatterns = RiskPattern::with('criteriaPatternItems')
            ->whereIn('type', ['single', 'criteria'])
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('risk-algorithm/edit-criteria', [
            'riskPattern'     => $riskPattern->load('criteriaPatternItems'),
            'existingPatterns' => $existingPatterns,
        ]);
    }

    /**
     * Store a newly created risk pattern.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|in:single,criteria',
            'regex' => ['required_if:type,single', 'nullable', 'string', 'max:1000', new CompilableRegex],
            'negation_context_regex' => ['nullable', 'string', 'max:1000', new CompilableRegex],
            'amplifier_context_regex' => ['nullable', 'string', 'max:1000', new CompilableRegex],
            'negation_window' => 'nullable|integer|min:50|max:1000',
            'score' => 'required_if:type,single|nullable|integer|min:0|max:100',
            'priority' => 'nullable|in:low,medium,high',
            'criteria_pattern_items' => 'required_if:type,criteria|nullable|array|min:1',
            'criteria_pattern_items.*.title' => 'required|string|max:255',
            'criteria_pattern_items.*.regex' => ['nullable', 'string', 'max:1000', new CompilableRegex],
            'criteria_pattern_items.*.operator' => 'nullable|in:and,or',
            'criteria_pattern_items.*.score' => 'required|integer|min:0|max:100',
            'criteria_pattern_items.*.risk_weight' => 'nullable|in:low,medium,high',
            'criteria_pattern_items.*.sub_items' => 'nullable|array',
            'criteria_pattern_items.*.sub_items.*.title' => 'required|string|max:255',
            'criteria_pattern_items.*.sub_items.*.regex' => ['required', 'string', 'max:1000', new CompilableRegex],
            'criteria_pattern_items.*.sub_items.*.operator' => 'nullable|in:and,or',
            'criteria_pattern_items.*.sub_items.*.score' => 'required|integer|min:0|max:100',
            'criteria_pattern_items.*.sub_items.*.risk_weight' => 'nullable|in:low,medium,high',
        ]);

        $riskPattern = RiskPattern::create([
            'title' => $validated['title'],
            'type' => $validated['type'],
            'regex' => $validated['type'] === 'single' ? $validated['regex'] : null,
            'negation_context_regex' => $validated['negation_context_regex'] ?? null,
            'amplifier_context_regex' => $validated['amplifier_context_regex'] ?? null,
            'negation_window' => isset($validated['negation_window']) ? (int) $validated['negation_window'] : null,
            'score' => $validated['score'] ?? 0,
            'priority' => $validated['priority'] ?? 'medium',
        ]);

        if ($validated['type'] === 'criteria' && isset($validated['criteria_pattern_items'])) {
            $this->createCriteriaItems($riskPattern->id, $validated['criteria_pattern_items']);
            $this->syncAutoCreatedSingles($riskPattern->id, $validated['criteria_pattern_items'], $riskPattern->priority);
        }

        return Redirect::back()->with('success', 'Risk pattern created successfully.');
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function createCriteriaItems(int $patternId, array $items, ?int $parentId = null): void
    {
        foreach ($items as $item) {
            $criteriaItem = CriteriaPatternItem::create([
                'criteria_pattern_id' => $patternId,
                'parent_id' => $parentId,
                'title' => $item['title'],
                'regex' => $item['regex'],
                'operator' => $item['operator'] ?? 'and',
                'score' => $item['score'],
                'risk_weight' => $item['risk_weight'] ?? 'medium',
            ]);

            if (isset($item['sub_items']) && is_array($item['sub_items'])) {
                $this->createCriteriaItems($patternId, $item['sub_items'], $criteriaItem->id);
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function syncAutoCreatedSingles(int $criteriaId, array $items, string $fallbackPriority = 'medium'): void
    {
        foreach ($items as $item) {
            if (($item['regex'] ?? '') !== '') {
                RiskPattern::create([
                    'title' => $item['title'],
                    'type' => 'single',
                    'regex' => $item['regex'],
                    'score' => $item['score'],
                    'priority' => $item['risk_weight'] ?? $fallbackPriority,
                    'parent_criteria_id' => $criteriaId,
                ]);
            }

            if (isset($item['sub_items']) && is_array($item['sub_items'])) {
                $this->syncAutoCreatedSingles($criteriaId, $item['sub_items'], $fallbackPriority);
            }
        }
    }

    public function update(Request $request, RiskPattern $riskPattern): RedirectResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|in:single,criteria',
            'regex' => ['required_if:type,single', 'nullable', 'string', 'max:1000', new CompilableRegex],
            'negation_context_regex' => ['nullable', 'string', 'max:1000', new CompilableRegex],
            'amplifier_context_regex' => ['nullable', 'string', 'max:1000', new CompilableRegex],
            'negation_window' => 'nullable|integer|min:50|max:1000',
            'score' => 'required_if:type,single|nullable|integer|min:0|max:100',
            'priority' => 'nullable|in:low,medium,high',
            'criteria_pattern_items' => 'required_if:type,criteria|nullable|array|min:1',
            'criteria_pattern_items.*.title' => 'required|string|max:255',
            'criteria_pattern_items.*.regex' => ['nullable', 'string', 'max:1000', new CompilableRegex],
            'criteria_pattern_items.*.operator' => 'nullable|in:and,or',
            'criteria_pattern_items.*.score' => 'required|integer|min:0|max:100',
            'criteria_pattern_items.*.risk_weight' => 'nullable|in:low,medium,high',
            'criteria_pattern_items.*.sub_items' => 'nullable|array',
            'criteria_pattern_items.*.sub_items.*.title' => 'required|string|max:255',
            'criteria_pattern_items.*.sub_items.*.regex' => ['required', 'string', 'max:1000', new CompilableRegex],
            'criteria_pattern_items.*.sub_items.*.operator' => 'nullable|in:and,or',
            'criteria_pattern_items.*.sub_items.*.score' => 'required|integer|min:0|max:100',
            'criteria_pattern_items.*.sub_items.*.risk_weight' => 'nullable|in:low,medium,high',
        ]);

        $riskPattern->update([
            'title' => $validated['title'],
            'type' => $validated['type'],
            'regex' => $validated['type'] === 'single' ? $validated['regex'] : null,
            'negation_context_regex' => $validated['negation_context_regex'] ?? null,
            'amplifier_context_regex' => $validated['amplifier_context_regex'] ?? null,
            'negation_window' => isset($validated['negation_window']) ? (int) $validated['negation_window'] : null,
            'score' => $validated['score'] ?? 0,
            'priority' => $validated['priority'] ?? $riskPattern->priority,
        ]);

        if ($validated['type'] === 'criteria' && isset($validated['criteria_pattern_items'])) {
            CriteriaPatternItem::where('criteria_pattern_id', $riskPattern->id)->delete();
            $this->createCriteriaItems($riskPattern->id, $validated['criteria_pattern_items']);
            RiskPattern::where('parent_criteria_id', $riskPattern->id)->delete();
            $this->syncAutoCreatedSingles($riskPattern->id, $validated['criteria_pattern_items'], $riskPattern->fresh()->priority);
        }

        return Redirect::back()->with('success', 'Risk pattern updated successfully.');
    }

    public function destroy(RiskPattern $riskPattern): RedirectResponse
    {
        RiskPattern::where('parent_criteria_id', $riskPattern->id)->delete();
        $riskPattern->delete();

        return Redirect::back()->with('success', 'Risk pattern deleted successfully.');
    }

    public function destroyAll(): RedirectResponse
    {
        RiskPattern::query()->delete();

        return Redirect::back()->with('success', 'All risk patterns deleted successfully.');
    }

    public function all(): JsonResponse
    {
        $patterns = RiskPattern::with('criteriaPatternItems')
            ->orderByRaw("CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END")
            ->get();

        return response()->json([
            'patterns' => $patterns,
            'count' => $patterns->count(),
        ]);
    }

    public function signed(): JsonResponse
    {
        $patterns = RiskPattern::with('criteriaPatternItems')
            ->orderByRaw("CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END")
            ->get()
            ->toArray();

        $payload = [
            'patterns' => $patterns,
            'issued_at' => now()->timestamp,
        ];

        $key = config('able.signing_key');
        if (! $key || strlen($key) < 32) {
            abort(500, 'ABLE signing key not configured');
        }

        $payloadJson = JsCanonical::encode($payload);
        $signature = JsCanonical::sign($payload, $key);

        return response()->json([
            'payload' => $payload,
            'signature' => $signature,
            'key_version' => (int) config('able.signing_key_version', 1),
        ]);
    }
}
