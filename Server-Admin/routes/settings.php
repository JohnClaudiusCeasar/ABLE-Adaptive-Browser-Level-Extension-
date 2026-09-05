<?php

use App\Http\Controllers\Settings\ExtensionSettingsController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\ServerSettingsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');

    Route::get('settings/extension', [ExtensionSettingsController::class, 'edit'])->name('extension-settings.edit');
    Route::put('settings/extension', [ExtensionSettingsController::class, 'update'])->name('extension-settings.update');

    Route::get('settings/server', [ServerSettingsController::class, 'edit'])->name('server-settings.edit');
    Route::put('settings/server', [ServerSettingsController::class, 'update'])->name('server-settings.update');
});
