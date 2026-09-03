<?php

use App\Http\Controllers\SecurityController;
use App\Http\Middleware\RequireFreshPasswordConfirmation;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('security', [SecurityController::class, 'edit'])
        ->middleware(RequireFreshPasswordConfirmation::class)
        ->name('security.edit');

    Route::put('security/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');
});

/* @chisel-passkeys */
Route::get('.well-known/passkey-endpoints', function () {
    return response()->json([
        'enroll' => route('security.edit'),
        'manage' => route('security.edit'),
    ]);
})->name('well-known.passkeys');
/* @end-chisel-passkeys */
