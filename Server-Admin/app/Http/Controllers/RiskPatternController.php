<?php

namespace App\Http\Controllers;

use App\Models\RiskPattern;
use App\Models\CriteriaPatternItem;
use App\Rules\CompilableRegex;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
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
                'singlePatterns' => $singlePatterns,
            ]);
        }

        return Inertia::render('risk-algorithm/single', [
            'riskPatterns' => $singlePatterns,
            'criteriaPatterns' => $criteriaPatterns,
        ]);
    }

    /**
     * Store a newly created risk pattern.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|in:single,criteria',
            'regex' => ['required_if:type,single', 'nullable', 'string', 'max:1000', new CompilableRegex],
            'score' => 'required_if:type,single|nullable|integer|min:0|max:100',
            'criteria_pattern_items' => 'required_if:type,criteria|nullable|array|min:1',
            'criteria_pattern_items.*.title' => 'required|string|max:255',
            'criteria_pattern_items.*.regex' => ['required', 'string', 'max:1000', new CompilableRegex],
            'criteria_pattern_items.*.operator' => 'nullable|in:and,or',
            'criteria_pattern_items.*.score' => 'required|integer|min:0|max:100',
            'criteria_pattern_items.*.sub_items' => 'nullable|array',
            'criteria_pattern_items.*.sub_items.*.title' => 'required|string|max:255',
            'criteria_pattern_items.*.sub_items.*.regex' => ['required', 'string', 'max:1000', new CompilableRegex],
            'criteria_pattern_items.*.sub_items.*.operator' => 'nullable|in:and,or',
            'criteria_pattern_items.*.sub_items.*.score' => 'required|integer|min:0|max:100',
        ]);

        // Create the risk pattern
        $riskPattern = RiskPattern::create([
            'title' => $validated['title'],
            'type' => $validated['type'],
            'regex' => $validated['type'] === 'single' ? $validated['regex'] : null,
            'score' => $validated['type'] === 'single' ? $validated['score'] : 0,
            'status' => 'active',
        ]);

        // Create criteria pattern items if type is criteria
        if ($validated['type'] === 'criteria' && isset($validated['criteria_pattern_items'])) {
            $this->createCriteriaItems($riskPattern->id, $validated['criteria_pattern_items']);
        }

        return Redirect::back()->with('success', 'Risk pattern created successfully.');
    }

    /**
     * Create criteria items recursively.
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
            ]);

            // Create sub-items if they exist
            if (isset($item['sub_items']) && is_array($item['sub_items'])) {
                $this->createCriteriaItems($patternId, $item['sub_items'], $criteriaItem->id);
            }
        }
    }

    /**
     * Update the specified risk pattern.
     */
    public function update(Request $request, RiskPattern $riskPattern)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'required|in:single,criteria',
            'regex' => ['required_if:type,single', 'nullable', 'string', 'max:1000', new CompilableRegex],
            'score' => 'required_if:type,single|nullable|integer|min:0|max:100',
            'status' => 'required|in:active,inactive',
            'criteria_pattern_items' => 'required_if:type,criteria|nullable|array|min:1',
            'criteria_pattern_items.*.title' => 'required|string|max:255',
            'criteria_pattern_items.*.regex' => ['required', 'string', 'max:1000', new CompilableRegex],
            'criteria_pattern_items.*.operator' => 'nullable|in:and,or',
            'criteria_pattern_items.*.score' => 'required|integer|min:0|max:100',
            'criteria_pattern_items.*.sub_items' => 'nullable|array',
            'criteria_pattern_items.*.sub_items.*.title' => 'required|string|max:255',
            'criteria_pattern_items.*.sub_items.*.regex' => ['required', 'string', 'max:1000', new CompilableRegex],
            'criteria_pattern_items.*.sub_items.*.operator' => 'nullable|in:and,or',
            'criteria_pattern_items.*.sub_items.*.score' => 'required|integer|min:0|max:100',
        ]);

        // Update the risk pattern
        $riskPattern->update([
            'title' => $validated['title'],
            'type' => $validated['type'],
            'regex' => $validated['type'] === 'single' ? $validated['regex'] : null,
            'score' => $validated['type'] === 'single' ? $validated['score'] : 0,
            'status' => $validated['status'],
        ]);

        // Update criteria pattern items if type is criteria
        if ($validated['type'] === 'criteria' && isset($validated['criteria_pattern_items'])) {
            // Delete existing items (cascade will handle sub-items)
            CriteriaPatternItem::where('criteria_pattern_id', $riskPattern->id)->delete();

            // Create new items
            $this->createCriteriaItems($riskPattern->id, $validated['criteria_pattern_items']);
        }

        return Redirect::back()->with('success', 'Risk pattern updated successfully.');
    }

    /**
     * Remove the specified risk pattern.
     */
    public function destroy(RiskPattern $riskPattern)
    {
        $riskPattern->delete();

        return Redirect::back()->with('success', 'Risk pattern deleted successfully.');
    }

    /**
     * Remove all risk patterns.
     */
    public function destroyAll()
    {
        RiskPattern::query()->delete();

        return Redirect::back()->with('success', 'All risk patterns deleted successfully.');
    }

    /**
     * API endpoint: Return all risk patterns for extension.
     */
    public function all(): JsonResponse
    {
        $patterns = RiskPattern::with('criteriaPatternItems')->where('status', 'active')->get();

        return response()->json([
            'patterns' => $patterns,
            'count' => $patterns->count(),
        ]);
    }
}
