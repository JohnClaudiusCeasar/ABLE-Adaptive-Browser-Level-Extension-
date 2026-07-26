<?php

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (Auth::check()) {
        return redirect()->route('dashboard');
    }
    return redirect()->route('login');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::inertia('egress-logs', 'egress-logs')->name('egress-logs');
    Route::inertia('security-analytics', 'security-analytics')->name('security-analytics');
    Route::inertia('risk-algorithm', 'risk-algorithm')->name('risk-algorithm');
    Route::inertia('policy-algorithm', 'policy-algorithm')->name('policy-algorithm');
});

require __DIR__.'/settings.php';
