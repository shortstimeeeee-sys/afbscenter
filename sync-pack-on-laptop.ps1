# ============================================================
# [노트북] 최신 상태를 zip으로 묶기 (코드 + data 폴더 포함)
# 실행: PowerShell에서 .\sync-pack-on-laptop.ps1
# 생성된 zip을 USB/OneDrive 등으로 데스크탑에 복사한 뒤
# 데스크탑에서 sync-restore-from-pack.ps1 실행
# ============================================================
$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$parentDir = Split-Path $projectRoot -Parent
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$zipName = "afbscenter-sync-pack-$timestamp.zip"
$zipPath = Join-Path $parentDir $zipName

if (-not (Test-Path $projectRoot)) {
    Write-Host "Error: Project folder not found: $projectRoot"
    exit 1
}

Write-Host "Creating sync pack (code + data): $zipPath"
# Compress whole folder so zip root is "afbscenter" (restore script expects this)
Compress-Archive -Path $projectRoot -DestinationPath $zipPath -Force
Write-Host "Done. Copy this file to the desktop PC: $zipName"
Write-Host "Then on desktop: run sync-restore-from-pack.ps1 and choose this zip."
