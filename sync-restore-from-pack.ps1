# ============================================================
# [데스크탑] 노트북에서 만든 zip으로 완전히 덮어쓰기 (백업 후 복원)
# 실행: PowerShell에서 .\sync-restore-from-pack.ps1
#      또는 .\sync-restore-from-pack.ps1 -ZipPath "C:\path\to\afbscenter-sync-pack-xxxx.zip"
# ============================================================
param(
    [string]$ZipPath = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$parentDir = Split-Path $projectRoot -Parent

# Find zip: parameter, or latest afbscenter-sync-pack-*.zip in project or parent
if ($ZipPath -and (Test-Path $ZipPath)) {
    $zipFile = $ZipPath
} else {
    $pattern = Join-Path $parentDir "afbscenter-sync-pack-*.zip"
    $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($found) {
        $zipFile = $found.FullName
        Write-Host "Using zip: $($found.Name)"
    } else {
        Write-Host "No sync pack zip found in: $parentDir"
        Write-Host "Usage: .\sync-restore-from-pack.ps1 -ZipPath `"C:\path\to\afbscenter-sync-pack-xxxx.zip`""
        exit 1
    }
}

# 1) Backup current state first
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$backupName = "afbscenter-backup-before-restore-$timestamp"
$backupPath = Join-Path $parentDir $backupName
Write-Host "Backing up current project to: $backupName"
Copy-Item -Path $projectRoot -Destination $backupPath -Recurse -Force
Write-Host "Backup done."

# 2) Extract zip to temp (zip root = "afbscenter")
$tempExtract = Join-Path $env:TEMP "afbscenter-restore-$timestamp"
if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
Expand-Archive -Path $zipFile -DestinationPath $tempExtract -Force
$extracted = Join-Path $tempExtract "afbscenter"
if (-not (Test-Path $extracted)) {
    Write-Host "Error: Zip should contain root folder 'afbscenter'. Found:"
    Get-ChildItem $tempExtract | ForEach-Object { Write-Host "  $($_.Name)" }
    Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# 3) Replace project contents (avoid deleting folder we're running from)
Write-Host "Replacing project with laptop version..."
Get-ChildItem -Path $projectRoot -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $extracted "*") -Destination $projectRoot -Recurse -Force
Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Restore done. Project is now in sync with the laptop."
Write-Host "Previous state backed up to: $backupName"
