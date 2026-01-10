# AFBS 센터 서버 관리 스크립트
# 사용법: .\server.ps1 [start|stop|restart|status]

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "start"
)

# 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8'

function Get-JavaProcess {
    return Get-Process | Where-Object {$_.ProcessName -like "*java*" -and $_.MainWindowTitle -like "*spring-boot*" -or $_.CommandLine -like "*spring-boot:run*"} -ErrorAction SilentlyContinue
}

function Start-Server {
    Write-Host "`n=== 서버 시작 ===" -ForegroundColor Green
    
    # 이미 실행 중인지 확인
    $existing = Get-JavaProcess
    if ($existing) {
        Write-Host "서버가 이미 실행 중입니다. (PID: $($existing.Id))" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Maven으로 Spring Boot 애플리케이션을 시작합니다..." -ForegroundColor White
    
    # 새 PowerShell 창에서 서버 실행
    $scriptPath = $PSScriptRoot
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; `$env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; mvn spring-boot:run" -WindowStyle Normal
    
    Write-Host "서버가 시작되었습니다!" -ForegroundColor Green
    Write-Host "브라우저에서 http://localhost:8080 으로 접속하세요." -ForegroundColor Cyan
    Write-Host "서버 로그는 새로 열린 PowerShell 창에서 확인할 수 있습니다." -ForegroundColor Gray
}

function Stop-Server {
    Write-Host "`n=== 서버 중지 ===" -ForegroundColor Yellow
    
    $processes = Get-JavaProcess
    if ($processes) {
        $count = ($processes | Measure-Object).Count
        Write-Host "$count 개의 Java 프로세스를 종료합니다..." -ForegroundColor White
        
        $processes | ForEach-Object {
            Write-Host "  - PID $($_.Id) 종료 중..." -ForegroundColor Gray
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
        
        Start-Sleep -Seconds 2
        Write-Host "서버가 종료되었습니다." -ForegroundColor Green
    } else {
        Write-Host "실행 중인 서버가 없습니다." -ForegroundColor Yellow
    }
}

function Restart-Server {
    Write-Host "`n=== 서버 재시작 ===" -ForegroundColor Cyan
    Stop-Server
    Start-Sleep -Seconds 2
    Start-Server
}

function Show-Status {
    Write-Host "`n=== 서버 상태 ===" -ForegroundColor Cyan
    
    $processes = Get-JavaProcess
    if ($processes) {
        Write-Host "서버가 실행 중입니다." -ForegroundColor Green
        $processes | ForEach-Object {
            Write-Host "  - PID: $($_.Id)" -ForegroundColor White
            Write-Host "  - 메모리: $([math]::Round($_.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
        }
        
        # 서버 응답 확인
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8080" -Method Get -TimeoutSec 3 -ErrorAction Stop
            Write-Host "`n서버가 정상적으로 응답하고 있습니다." -ForegroundColor Green
            Write-Host "접속 URL: http://localhost:8080" -ForegroundColor Cyan
        } catch {
            Write-Host "`n서버가 아직 완전히 시작되지 않았을 수 있습니다." -ForegroundColor Yellow
        }
    } else {
        Write-Host "서버가 실행 중이지 않습니다." -ForegroundColor Red
    }
}

# 메인 실행
switch ($Action.ToLower()) {
    "start" { Start-Server }
    "stop" { Stop-Server }
    "restart" { Restart-Server }
    "status" { Show-Status }
}
