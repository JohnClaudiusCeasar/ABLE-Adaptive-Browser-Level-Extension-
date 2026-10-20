<?php

/*
|--------------------------------------------------------------------------
| DOMPDF
|--------------------------------------------------------------------------
|
| Settings for the PDF export of the security report.
|
| Two settings matter for this deployment:
|
|  - Remote resources are disabled. The report template used to pull Google
|    Fonts over the network on every render, which meant every PDF export
|    fetched and embedded several megabytes of font data, and let dompdf
|    reach any host the template referenced. The template now uses the
|    built-in PDF fonts instead.
|
|  - Font subsetting is enabled, so an embedded font only carries the
|    glyphs the document actually uses.
|
| The directories must exist and be writable by the web server process.
|
*/

return [

    'show_warnings' => false,

    'public_path' => null,

    /*
     * Dejavu Sans font is missing glyphs for converted entities, turn it off if you need to show € and £.
     */
    'convert_entities' => true,

    'options' => [

        /*
         * The location of the DOMPDF font directory, and of the cached font
         * metrics for the fonts it uses.
         */
        'font_dir' => storage_path('fonts'),

        'font_cache' => storage_path('fonts'),

        /*
         * A writable directory for the temporary artifacts dompdf produces.
         */
        'temp_dir' => storage_path('app/dompdf'),

        /*
         * Prevents dompdf from reaching system files outside the project.
         * Never set this to '/'.
         */
        'chroot' => realpath(base_path()),

        'allowed_protocols' => [
            'data://' => ['rules' => []],
            'file://' => ['rules' => []],
            'http://' => ['rules' => []],
            'https://' => ['rules' => []],
        ],

        'artifactPathValidation' => null,

        'log_output_file' => null,

        /*
         * Only the glyphs the document uses are embedded, which keeps the
         * exported PDF small.
         */
        'enable_font_subsetting' => true,

        'pdf_backend' => 'CPDF',

        'default_media_type' => 'screen',

        'default_paper_size' => 'a4',

        'default_paper_orientation' => 'portrait',

        /*
         * One of the base 14 PDF fonts, so nothing has to be embedded.
         */
        'default_font' => 'Helvetica',

        'dpi' => 96,

        /*
         * Embedded PHP would run with the web server's privileges.
         */
        'enable_php' => false,

        /*
         * The report is a static document; it needs no scripting.
         */
        'enable_javascript' => false,

        /*
         * The report template references no remote resources, and allowing
         * them would let a template fetch any host and would make the
         * export depend on the network.
         */
        'enable_remote' => false,

        /*
         * No remote host is allowed. Leaving this null would allow any host.
         */
        'allowed_remote_hosts' => [],

        'font_height_ratio' => 1.1,

        'enable_html5_parser' => true,
    ],

];
