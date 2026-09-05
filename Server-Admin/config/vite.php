<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Vite Dev Server
    |--------------------------------------------------------------------------
    |
    | The port Vite uses during local development. This mirrors the
    | VITE_DEV_SERVER_PORT environment variable so middleware can resolve the
    | value through config() instead of calling env() at runtime.
    |
    */
    'dev_server_port' => env('VITE_DEV_SERVER_PORT', 5173),
];
