# Change desktop shortcut icon to baseball icon
# This script will update the Server Control Panel shortcut icon

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktop\Server Control Panel.lnk"

if (-not (Test-Path $shortcutPath)) {
    Write-Host "Shortcut not found. Creating new shortcut..." -ForegroundColor Yellow
    $vbsPath = Join-Path $PSScriptRoot "server-control.vbs"
    $vbsPathFull = [System.IO.Path]::GetFullPath($vbsPath)
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($shortcutPath)
    $link.TargetPath = "wscript.exe"
    $link.Arguments = "`"$vbsPathFull`""
    $link.WorkingDirectory = $PSScriptRoot
    $link.Description = "AFBS Center Server Control Panel"
} else {
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($shortcutPath)
}

# Try to find baseball icon
# Option 1: Check if user provided icon file
$iconFile = Join-Path $PSScriptRoot "baseball.ico"
if (Test-Path $iconFile) {
    $link.IconLocation = $iconFile
    Write-Host "Using custom baseball.ico file" -ForegroundColor Green
} else {
    # Option 2: Use Windows default sports/ball icon (shell32.dll has various icons)
    # Icon index 137 is a general application icon, but we can try others
    # For a ball-like icon, we can use shell32.dll with different indices
    # Common ball icons might be in imageres.dll or other system DLLs
    
    # Try imageres.dll which has more modern icons
    $iconPath = "imageres.dll,1"  # Default, will try to find better
    $link.IconLocation = $iconPath
    
    Write-Host "Using default system icon (imageres.dll)" -ForegroundColor Yellow
    Write-Host "To use a custom baseball icon:" -ForegroundColor Cyan
    Write-Host "  1. Download a baseball.ico file" -ForegroundColor White
    Write-Host "  2. Place it in: $PSScriptRoot" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
}

$link.Save()
Write-Host "`nIcon updated successfully!" -ForegroundColor Green
Write-Host "Shortcut: $shortcutPath" -ForegroundColor Cyan
