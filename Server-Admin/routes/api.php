<?php

use App\Http\Controllers\DomainPolicyController;
use Illuminate\Support\Facades\Route;

Route::get('/classify-domain', [DomainPolicyController::class, 'classify']);
Route::get('/domain-policies', [DomainPolicyController::class, 'all']);
Route::post('/log-visit', [DomainPolicyController::class, 'logVisit']);
Route::get('/domain-policies/{domainPolicy}/visits', [DomainPolicyController::class, 'getDomainVisits']);
