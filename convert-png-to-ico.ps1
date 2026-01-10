# Convert PNG to ICO and apply as shortcut icon
# This script converts the PNG file to ICO format and sets it as the shortcut icon

$pngPath = "C:\Users\dlfgi\OneDrive\Documents\af.png"
$icoPath = Join-Path $PSScriptRoot "af.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktop\Server Control Panel.lnk"

Write-Host "=== PNG to ICO Converter ===" -ForegroundColor Cyan

# Check if PNG exists
if (-not (Test-Path $pngPath)) {
    Write-Host "PNG file not found: $pngPath" -ForegroundColor Red
    exit
}

Write-Host "PNG file found: $pngPath" -ForegroundColor Green

# Method 1: Try using .NET to convert (requires System.Drawing)
try {
    Add-Type -AssemblyName System.Drawing
    
    # Load PNG image
    $pngImage = [System.Drawing.Image]::FromFile($pngPath)
    
    # Create ICO file
    # Note: Creating a proper ICO file requires more complex code
    # For now, we'll try a simpler approach using ImageMagick or online conversion
    
    Write-Host "`nConverting PNG to ICO..." -ForegroundColor Yellow
    
    # Simple conversion: Save as bitmap first, then we'll need to create ICO structure
    # Actually, Windows can sometimes use PNG directly, but ICO is more reliable
    
    # For a proper ICO conversion, we'd need ImageMagick or an online tool
    # Let's try using the PNG directly first, and if that doesn't work, suggest conversion
    
    Write-Host "`nOption 1: Try PNG directly (may work)" -ForegroundColor Cyan
    if (Test-Path $shortcutPath) {
        $shell = New-Object -ComObject WScript.Shell
        $link = $shell.CreateShortcut($shortcutPath)
        $link.IconLocation = $pngPath
        $link.Save()
        Write-Host "Icon set to PNG file. Check if it appears." -ForegroundColor Green
    }
    
    Write-Host "`nOption 2: Convert to ICO (more reliable)" -ForegroundColor Cyan
    Write-Host "To convert PNG to ICO, you can:" -ForegroundColor Yellow
    Write-Host "  1. Use online converter:" -ForegroundColor White
    Write-Host "     https://convertio.co/png-ico/" -ForegroundColor Gray
    Write-Host "     https://www.icoconverter.com/" -ForegroundColor Gray
    Write-Host "  2. Download ImageMagick and use:" -ForegroundColor White
    Write-Host "     magick convert af.png -define icon:auto-resize=256,128,64,48,32,16 af.ico" -ForegroundColor Gray
    Write-Host "  3. Save the ICO file as 'af.ico' in this folder" -ForegroundColor White
    Write-Host "  4. Run: .\set-baseball-icon.ps1" -ForegroundColor White
    
    $pngImage.Dispose()
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "`nTrying alternative method..." -ForegroundColor Yellow
    
    # Alternative: Just set PNG directly (Windows 10/11 sometimes supports this)
    if (Test-Path $shortcutPath) {
        $shell = New-Object -ComObject WScript.Shell
        $link = $shell.CreateShortcut($shortcutPath)
        $link.IconLocation = $pngPath
        $link.Save()
        Write-Host "Icon path set. If it doesn't work, convert PNG to ICO first." -ForegroundColor Yellow
    }
}
