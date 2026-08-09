<?php

use App\Http\Controllers\Auth\GoogleAuthController;
use App\Http\Controllers\DomainPolicyController;
use App\Http\Controllers\EgressEventController;
use App\Http\Controllers\RiskPatternController;
use App\Http\Controllers\SecurityAnalyticsController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (Auth::check()) {
        return redirect()->route('dashboard');
    }
    return redirect()->route('login');
})->name('home');

Route::get('/auth/google', [GoogleAuthController::class, 'redirect'])->name('google.redirect');
Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->name('google.callback');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::get('egress-logs', [EgressEventController::class, 'index'])->name('egress-logs');
    Route::get('security-analytics', [SecurityAnalyticsController::class, 'index'])->name('security-analytics');
    Route::get('security-analytics/nudge-effectiveness', [SecurityAnalyticsController::class, 'nudgeEffectiveness'])
        ->name('security-analytics.nudge-effectiveness');
    Route::get('security-analytics/shadow-footprints', [SecurityAnalyticsController::class, 'shadowFootprints'])
        ->name('security-analytics.shadow-footprints');
    Route::get('risk-algorithm', [RiskPatternController::class, 'index'])->name('risk-algorithm');
    Route::post('risk-algorithm', [RiskPatternController::class, 'store'])->name('risk-algorithm.store');
    Route::patch('risk-algorithm/{riskPattern}', [RiskPatternController::class, 'update'])->name('risk-algorithm.update');
    Route::delete('risk-algorithm/{riskPattern}', [RiskPatternController::class, 'destroy'])->name('risk-algorithm.destroy');
    Route::delete('risk-algorithm-all', [RiskPatternController::class, 'destroyAll'])->name('risk-algorithm.destroyAll');
    Route::get('policy-algorithm', [DomainPolicyController::class, 'index'])->name('policy-algorithm');
    Route::post('policy-algorithm', [DomainPolicyController::class, 'store'])->name('policy-algorithm.store');
    Route::patch('policy-algorithm/{domainPolicy}', [DomainPolicyController::class, 'update'])->name('policy-algorithm.update');
    Route::delete('policy-algorithm/{domainPolicy}', [DomainPolicyController::class, 'destroy'])->name('policy-algorithm.destroy');
    Route::delete('policy-algorithm-all', [DomainPolicyController::class, 'destroyAll'])->name('policy-algorithm.destroyAll');
    Route::inertia('notifications', 'notifications')->name('notifications');
});

require __DIR__.'/settings.php';
