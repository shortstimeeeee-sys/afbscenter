# Set baseball icon for Server Control Panel shortcut
# Place a baseball.ico file in this folder, then run this script

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktop\Server Control Panel.lnk"
$iconFile = Join-Path $PSScriptRoot "baseball.ico"

Write-Host "=== Setting Baseball Icon ===" -ForegroundColor Cyan

# Check if shortcut exists, create if not
if (-not (Test-Path $shortcutPath)) {
    Write-Host "Creating shortcut..." -ForegroundColor Yellow
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

# Set icon
if (Test-Path $iconFile) {
    $link.IconLocation = $iconFile
    Write-Host "Baseball icon found and applied!" -ForegroundColor Green
    Write-Host "Icon file: $iconFile" -ForegroundColor Cyan
} else {
    Write-Host "Baseball icon file not found!" -ForegroundColor Red
    Write-Host "`nTo use a baseball icon:" -ForegroundColor Yellow
    Write-Host "  1. Download a baseball.ico file" -ForegroundColor White
    Write-Host "  2. Save it as 'baseball.ico' in this folder:" -ForegroundColor White
    Write-Host "     $PSScriptRoot" -ForegroundColor Gray
    Write-Host "  3. Run this script again" -ForegroundColor White
    Write-Host "`nRecommended sites:" -ForegroundColor Cyan
    Write-Host "  - https://www.iconfinder.com/search?q=baseball" -ForegroundColor Gray
    Write-Host "  - https://www.flaticon.com/search?word=baseball" -ForegroundColor Gray
    Write-Host "  - https://icons8.com/icons/set/baseball" -ForegroundColor Gray
    Write-Host "`nUsing default icon for now..." -ForegroundColor Yellow
    $link.IconLocation = "shell32.dll,137"
}

$link.Save()
Write-Host "`nShortcut updated: $shortcutPath" -ForegroundColor Green
