Add-Type -AssemblyName System.Drawing

$sourceDir = "D:\Projects\ABLE-Adaptive-Browser-Level-Extension-\Implementation\Add"
$targetDir = "D:\Projects\ABLE-Adaptive-Browser-Level-Extension-\Client-Extension\icons"

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$pngSource = Join-Path $sourceDir "ABLE-LOGO.png"
$svgSource = Join-Path $sourceDir "ABLE-LOGO.svg"

# Copy/Move the original assets to the target icons directory
Copy-Item $pngSource (Join-Path $targetDir "ABLE-LOGO.png") -Force
Copy-Item $svgSource (Join-Path $targetDir "ABLE-LOGO.svg") -Force

Write-Host "Copied original ABLE-LOGO files to icons folder"

# Load source image to create resized PNG icons
$srcImage = [System.Drawing.Image]::FromFile($pngSource)

$sizes = @(16, 32, 48, 128)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graphics.DrawImage($srcImage, 0, 0, $size, $size)
    $graphics.Dispose()

    $outPath = Join-Path $targetDir "icon-$size.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated $outPath"
}

$srcImage.Dispose()
Write-Host "Icon generation complete!"
