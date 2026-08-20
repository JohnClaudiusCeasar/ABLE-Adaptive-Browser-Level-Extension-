<?php

namespace App\Http\Controllers;

use App\Models\ExtensionLifecycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExtensionLifecycleController extends Controller
{
    /**
     * Log an install/update lifecycle event from the extension background script.
     */
    public function logLifecycle(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|string|max:255',
            'extension_id' => 'nullable|string|max:255',
            'event' => 'required|in:installed,updated,uninstalled',
            'version' => 'nullable|string|max:50',
        ]);

        ExtensionLifecycle::create([
            'user_id' => $validated['user_id'],
            'extension_id' => $validated['extension_id'],
            'event' => $validated['event'],
            'version' => $validated['version'],
            'occurred_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Log an uninstall event. Chrome opens this URL via setUninstallURL as a
     * GET request in a new tab right before the extension is removed.
     */
    public function logUninstall(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|string|max:255',
            'extension_id' => 'nullable|string|max:255',
            'version' => 'nullable|string|max:50',
        ]);

        ExtensionLifecycle::create([
            'user_id' => $validated['user_id'],
            'extension_id' => $validated['extension_id'],
            'event' => 'uninstalled',
            'version' => $validated['version'],
            'occurred_at' => now(),
        ]);

        return response()->make(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>ABLE Extension</title></head><body style="font-family:sans-serif;text-align:center;padding:60px;"><h2>ABLE Extension Removed</h2><p>Thank you for using ABLE.</p></body></html>',
            200,
            ['Content-Type' => 'text/html']
        );
    }
}
