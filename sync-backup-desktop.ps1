# ============================================================
# [데스크탑] 현재 afbscenter 폴더 전체를 백업 (복사용 보관)
# 실행: PowerShell에서 .\sync-backup-desktop.ps1
# ============================================================
$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$parentDir = Split-Path $projectRoot -Parent
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$backupName = "afbscenter-backup-$timestamp"
$backupPath = Join-Path $parentDir $backupName

if (-not (Test-Path $projectRoot)) {
    Write-Host "Error: Project folder not found: $projectRoot"
    exit 1
}

Write-Host "Backing up current project to: $backupPath"
Copy-Item -Path $projectRoot -Destination $backupPath -Recurse -Force
Write-Host "Done. Backup saved as: $backupName"
Write-Host "You can now run sync-restore-from-pack.ps1 with the zip from the laptop."
