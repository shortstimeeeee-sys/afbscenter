# AFBS 센터 서버 실행 (터미널)
# UTF-8 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AFBS 센터 서버 실행 (터미널)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "서버를 시작합니다..." -ForegroundColor Green
Write-Host "종료하려면 Ctrl+C를 누르세요." -ForegroundColor Yellow
Write-Host ""

# 현재 디렉토리로 이동
Set-Location $PSScriptRoot

# Maven으로 Spring Boot 실행
mvn spring-boot:run
