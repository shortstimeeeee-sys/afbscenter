# Control Panel Launcher
# Double-click this file to open the control panel

$ErrorActionPreference = "Continue"

# Current script location
$scriptPath = Join-Path $PSScriptRoot "server-control.ps1"

Write-Host "Starting control panel..." -ForegroundColor Cyan
Write-Host "Script path: $scriptPath" -ForegroundColor Gray

if (Test-Path $scriptPath) {
    try {
        & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $scriptPath
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Yellow
        Read-Host "Press any key to exit"
    }
} else {
    Write-Host "Cannot find server-control.ps1 file." -ForegroundColor Red
    Write-Host "Path: $scriptPath" -ForegroundColor Yellow
    Read-Host "Press any key to exit"
}
