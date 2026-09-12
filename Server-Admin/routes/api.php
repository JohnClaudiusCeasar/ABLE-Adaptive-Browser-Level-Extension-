<?php

use App\Http\Controllers\DomainPolicyController;
use App\Http\Controllers\EgressEventController;
use App\Http\Controllers\ExtensionConfigController;
use App\Http\Controllers\ExtensionLifecycleController;
use App\Http\Controllers\RiskPatternController;
use Illuminate\Support\Facades\Route;

Route::match(['get', 'post'], '/classify-domain', [DomainPolicyController::class, 'classify'])->middleware('throttle:120,1');
Route::get('/domain-policies', [DomainPolicyController::class, 'all'])->middleware('throttle:30,1');
Route::get('/domain-policies/signed', [DomainPolicyController::class, 'signed'])->middleware('throttle:30,1');
Route::post('/log-visit', [DomainPolicyController::class, 'logVisit'])->middleware('throttle:60,1');
Route::post('/log-egress', [EgressEventController::class, 'logEgress'])->middleware('throttle:60,1');
Route::delete('/egress-events/{egressEvent}', [EgressEventController::class, 'destroy'])->middleware('throttle:60,1');
Route::delete('/egress-events', [EgressEventController::class, 'destroyAll'])->middleware('throttle:10,1');
Route::get('/domain-policies/{domainPolicy}/visits', [DomainPolicyController::class, 'getDomainVisits'])->middleware('throttle:60,1');
Route::get('/risk-patterns', [RiskPatternController::class, 'all'])->middleware('throttle:30,1');
Route::get('/risk-patterns/signed', [RiskPatternController::class, 'signed'])->middleware('throttle:30,1');

Route::post('/extension/lifecycle', [ExtensionLifecycleController::class, 'logLifecycle'])->middleware('throttle:60,1');
Route::get('/extension/uninstall', [ExtensionLifecycleController::class, 'logUninstall'])->middleware('throttle:60,1');
Route::get('/extension/config', [ExtensionConfigController::class, 'signed'])->middleware('throttle:30,1');
