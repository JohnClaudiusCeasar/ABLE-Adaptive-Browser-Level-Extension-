<?php

namespace App\Http\Controllers;

use App\Concerns\BoundsAdminRows;
use App\Models\DomainVisit;
use Inertia\Inertia;
use Inertia\Response;

class DomainVisitController extends Controller
{
    use BoundsAdminRows;

    /**
     * Display the Domain Visits page with live data.
     */
    public function index(): Response
    {
        $limit = $this->rowLimit();

        $domainVisits = DomainVisit::with('domainPolicy')
            ->orderByDesc('visited_at')
            ->limit($limit)
            ->get()
            ->map(function (DomainVisit $visit) {
                return [
                    'visited_at' => $visit->visited_at->toIso8601String(),
                    'domain' => $visit->domain,
                    'status' => $visit->glassStatus(),
                    'user' => $visit->user_id,
                    'action' => $visit->actionLabel(),
                ];
            });

        return Inertia::render('domain-visits', [
            'domainVisits' => $domainVisits,
            'truncated' => $domainVisits->count() >= $limit,
            'rowLimit' => $limit,
        ]);
    }
}
