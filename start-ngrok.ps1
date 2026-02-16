# ngrok 터널 시작 스크립트 (고정 도메인 사용)
$scriptPath = $PSScriptRoot
$fixedDomain = "jasper-declared-josue.ngrok-free.dev"

Write-Host "=== ngrok 터널 시작 (고정 도메인) ===" -ForegroundColor Green
Write-Host "포트: 8080 (서버 포트)" -ForegroundColor Yellow
Write-Host "고정 도메인: https://$fixedDomain" -ForegroundColor Cyan
Write-Host "웹 인터페이스: http://127.0.0.1:4040" -ForegroundColor Cyan
Write-Host ""

# 기존 ngrok 프로세스 종료
$existingProcess = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($existingProcess) {
    Write-Host "기존 ngrok 프로세스 종료 중..." -ForegroundColor Yellow
    Stop-Process -Name ngrok -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 서버가 실행 중인지 확인
$serverRunning = netstat -ano | findstr ":8080 " | findstr "LISTENING"
if (-not $serverRunning) {
    Write-Host "경고: 서버가 포트 8080에서 실행되지 않습니다!" -ForegroundColor Red
    Write-Host "먼저 서버를 시작해주세요." -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "그래도 ngrok을 실행하시겠습니까? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit
    }
}

# ngrok 실행 (고정 도메인 사용)
Write-Host "ngrok 실행 중 (고정 도메인: $fixedDomain)..." -ForegroundColor Green
if (Test-Path "$scriptPath\ngrok.exe") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; Write-Host '=== ngrok 터널 (고정 도메인) ===' -ForegroundColor Green; Write-Host '도메인: https://$fixedDomain' -ForegroundColor Cyan; Write-Host '포트: 8080' -ForegroundColor Yellow; Write-Host ''; .\ngrok.exe http 8080 --domain=$fixedDomain" -WindowStyle Normal
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; Write-Host '=== ngrok 터널 (고정 도메인) ===' -ForegroundColor Green; Write-Host '도메인: https://$fixedDomain' -ForegroundColor Cyan; Write-Host '포트: 8080' -ForegroundColor Yellow; Write-Host ''; ngrok http 8080 --domain=$fixedDomain" -WindowStyle Normal
}

Write-Host ""
Write-Host "ngrok이 새 창에서 실행됩니다." -ForegroundColor Green
Write-Host ""
Write-Host "고정 도메인 URL:" -ForegroundColor Cyan
Write-Host "  https://$fixedDomain" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ""
Write-Host "터널 상태 확인:" -ForegroundColor Cyan
Write-Host "  - ngrok 창에서 'Forwarding' 줄 확인" -ForegroundColor White
Write-Host "  - 또는 브라우저에서 http://127.0.0.1:4040 접속" -ForegroundColor White
Write-Host ""
Write-Host "잠시 후 터널이 생성됩니다 (약 3-5초 소요)" -ForegroundColor Yellow
Write-Host ""
Write-Host "아무 키나 누르면 종료됩니다..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
