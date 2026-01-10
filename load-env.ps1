# 현재 PowerShell 세션에 환경 변수 로드 스크립트
# 이 스크립트를 실행하면 현재 세션에서 mvn, java 명령어를 사용할 수 있습니다.

# UTF-8 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "환경 변수 로드 중..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# JAVA_HOME 로드
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
if (-not $env:JAVA_HOME) {
    $env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
}
if ($env:JAVA_HOME) {
    Write-Host "✓ JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
} else {
    Write-Host "⚠ JAVA_HOME이 설정되어 있지 않습니다." -ForegroundColor Yellow
}

# MAVEN_HOME 로드
$env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "Machine")
if (-not $env:MAVEN_HOME) {
    $env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "User")
}
if ($env:MAVEN_HOME) {
    Write-Host "✓ MAVEN_HOME: $env:MAVEN_HOME" -ForegroundColor Green
} else {
    Write-Host "⚠ MAVEN_HOME이 설정되어 있지 않습니다." -ForegroundColor Yellow
}

# PATH 환경 변수 로드
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = if ($machinePath -and $userPath) { "$machinePath;$userPath" } elseif ($machinePath) { $machinePath } else { $userPath }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "환경 변수 로드 완료!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Java 확인
Write-Host "Java 확인 중..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "✓ $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠ Java를 찾을 수 없습니다." -ForegroundColor Yellow
}

# Maven 확인
Write-Host "Maven 확인 중..." -ForegroundColor Yellow
try {
    $mavenVersion = mvn -version 2>&1 | Select-Object -First 1
    Write-Host "✓ $mavenVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠ Maven을 찾을 수 없습니다." -ForegroundColor Yellow
    if ($env:MAVEN_HOME) {
        $mvnExe = Join-Path $env:MAVEN_HOME "bin\mvn.cmd"
        if (Test-Path $mvnExe) {
            Write-Host "Maven 실행 파일을 직접 사용할 수 있습니다: $mvnExe" -ForegroundColor Cyan
        }
    }
}

Write-Host ""
Write-Host "이제 mvn, java 명령어를 사용할 수 있습니다!" -ForegroundColor Green
Write-Host ""
