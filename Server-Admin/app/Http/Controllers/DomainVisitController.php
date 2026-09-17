<?php

namespace App\Http\Controllers;

use App\Models\DomainVisit;
use Inertia\Inertia;
use Inertia\Response;

class DomainVisitController extends Controller
{
    /**
     * Display the Domain Visits page with live data.
     */
    public function index(): Response
    {
        $domainVisits = DomainVisit::with('domainPolicy')
            ->orderByDesc('visited_at')
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
        ]);
    }
}
