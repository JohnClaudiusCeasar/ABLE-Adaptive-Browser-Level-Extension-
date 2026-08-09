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
            ->map(function ($visit) {
                $status = match ($visit->domainPolicy?->domain_status) {
                    'safe' => 'glass-safe',
                    'unsafe' => 'glass-unsafe',
                    default => 'glass-unlisted',
                };

                $actionMap = [
                    'glass-safe' => 'Allowed',
                    'glass-unsafe' => 'Blocked',
                    'glass-unlisted' => 'Warned',
                ];

                return [
                    'date' => $visit->visited_at->format('Y-m-d'),
                    'time' => $visit->visited_at->format('g:i A'),
                    'domain' => $visit->domain,
                    'status' => $status,
                    'user' => $visit->user_id,
                    'action' => $actionMap[$status],
                ];
            });

        return Inertia::render('domain-visits', [
            'domainVisits' => $domainVisits,
        ]);
    }
}
