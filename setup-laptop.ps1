# ============================================================
# 노트북 필수 설치 스크립트 (AFBS Center)
# Java 17 + Maven 자동 설치 (Windows)
# ============================================================
# 관리자 권한 없이 실행 가능 (Java는 winget, Maven은 사용자 폴더에 설치)
# 실행: PowerShell에서   powershell -ExecutionPolicy Bypass -File .\setup-laptop.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AFBS Center - 노트북 필수 요소 설치" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load PATH from registry so we see Java/Maven if just installed
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User") }
$env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "Machine")
if (-not $env:MAVEN_HOME) { $env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "User") }
$mp = [Environment]::GetEnvironmentVariable("Path", "Machine")
$up = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = if ($mp -and $up) { "$mp;$up" } elseif ($mp) { $mp } else { $up }

# ---------- 1. Java 17 check / install ----------
$needJava = $true
try {
    $ver = java -version 2>&1
    if ($ver -match '"17\.') {
        Write-Host "[OK] Java 17 already installed." -ForegroundColor Green
        $needJava = $false
    } elseif ($ver -match '"(\d+)\.') {
        Write-Host "[WARN] Java found but not 17. Trying to install Java 17." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[INFO] Java not found. Installing Java 17..." -ForegroundColor Yellow
}

if ($needJava) {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Host "[ERROR] winget not found. Install Java 17 manually. See SETUP_GUIDE.md" -ForegroundColor Red
        exit 1
    }
    Write-Host "Installing Java 17 via winget..." -ForegroundColor Yellow
    winget install -e --id Microsoft.OpenJDK.17 --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        winget install -e --id EclipseAdoptium.Temurin.17.JDK --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
    }
    $mp = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $up = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = if ($mp -and $up) { "$mp;$up" } elseif ($mp) { $mp } else { $up }
    try {
        $ver = java -version 2>&1
        if ($ver -match '"17\.') { $needJava = $false }
    } catch { }
    if ($needJava) {
        $j17Paths = @("C:\Program Files\Microsoft\jdk-17*", "C:\Program Files\Eclipse Adoptium\jdk-17*", "C:\Program Files\Java\jdk-17*")
        foreach ($pat in $j17Paths) {
            $dirs = Get-Item $pat -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
            foreach ($d in $dirs) {
                $javaExe = Join-Path $d.FullName "bin\java.exe"
                if (Test-Path $javaExe) {
                    $env:JAVA_HOME = $d.FullName
                    $env:Path = (Join-Path $d.FullName "bin") + ";" + $env:Path
                    $needJava = $false
                    Write-Host "[OK] Java 17 found: $($d.FullName). Continuing to Maven..." -ForegroundColor Green
                    break
                }
            }
            if (-not $needJava) { break }
        }
    }
    if ($needJava) {
        Write-Host "[INFO] Close this window, open a new one, then run this script again for Maven." -ForegroundColor Cyan
        exit 0
    }
}

# ---------- 2. Maven 확인 및 설치 ----------
$needMaven = $true
try {
    $mvnVer = mvn -version 2>&1
    if ($mvnVer -match "Apache Maven") {
        Write-Host "[OK] Maven이 이미 설치되어 있습니다." -ForegroundColor Green
        $needMaven = $false
    }
} catch {
    Write-Host "[설치 필요] Maven이 없습니다. Maven을 설치합니다." -ForegroundColor Yellow
}

if ($needMaven) {
    # Chocolatey 시도
    $choco = Get-Command choco -ErrorAction SilentlyContinue
    if ($choco) {
        Write-Host "Chocolatey로 Maven 설치 중..." -ForegroundColor Yellow
        choco install maven -y
        if ($LASTEXITCODE -eq 0) {
            $needMaven = $false
            Write-Host "[OK] Maven 설치 완료 (Chocolatey). 새 터미널에서 mvn -version 을 확인하세요." -ForegroundColor Green
        }
    }

    if ($needMaven) {
        # 수동 다운로드: Apache Maven (고정 버전)
        $mavenVersion = "3.9.9"
        $mavenZip = "apache-maven-$mavenVersion-bin.zip"
        $mavenUrl = "https://dlcdn.apache.org/maven/maven-3/$mavenVersion/binaries/$mavenZip"
        $installBase = Join-Path $env:USERPROFILE "afbscenter-tools"
        $mavenHome = Join-Path $installBase "apache-maven-$mavenVersion"
        $mavenZipPath = Join-Path $env:TEMP $mavenZip

        if (Test-Path (Join-Path $mavenHome "bin\mvn.cmd")) {
            Write-Host "[OK] Maven이 이미 사용자 폴더에 있습니다: $mavenHome" -ForegroundColor Green
            $needMaven = $false
        } else {
            if (-not (Test-Path $installBase)) { New-Item -ItemType Directory -Path $installBase -Force | Out-Null }
            Write-Host "Maven $mavenVersion 다운로드 중... (약 1분 소요)" -ForegroundColor Yellow
            try {
                Invoke-WebRequest -Uri $mavenUrl -OutFile $mavenZipPath -UseBasicParsing
            } catch {
                $mavenUrl = "https://archive.apache.org/dist/maven/maven-3/$mavenVersion/binaries/$mavenZip"
                Invoke-WebRequest -Uri $mavenUrl -OutFile $mavenZipPath -UseBasicParsing
            }
            Expand-Archive -Path $mavenZipPath -DestinationPath $installBase -Force
            Remove-Item $mavenZipPath -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path (Join-Path $mavenHome "bin\mvn.cmd"))) {
                Write-Host "[오류] Maven 압축 해제 후 경로를 찾을 수 없습니다." -ForegroundColor Red
                exit 1
            }
            # 사용자 환경 변수에 MAVEN_HOME 및 Path 추가
            [Environment]::SetEnvironmentVariable("MAVEN_HOME", $mavenHome, "User")
            $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
            $mavenBin = Join-Path $mavenHome "bin"
            if ($userPath -notlike "*$mavenBin*") {
                [Environment]::SetEnvironmentVariable("Path", "$userPath;$mavenBin", "User")
            }
            $env:MAVEN_HOME = $mavenHome
            $env:Path = "$env:Path;$mavenBin"
            Write-Host "[OK] Maven 설치 완료: $mavenHome" -ForegroundColor Green
            $needMaven = $false
        }
    }
}

# ---------- 3. 환경 변수 로드 (현재 세션) ----------
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User") }
$env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "Machine")
if (-not $env:MAVEN_HOME) { $env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "User") }
$mp = [Environment]::GetEnvironmentVariable("Path", "Machine")
$up = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = if ($mp -and $up) { "$mp;$up" } elseif ($mp) { $mp } else { $up }

# ---------- 4. 설치 확인 ----------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  설치 확인" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$ok = $true
try {
    $j = java -version 2>&1
    Write-Host "Java: $($j -join ' ')" -ForegroundColor Gray
    if ($j -notmatch '"17\.') { Write-Host "  [경고] Java 17을 권장합니다." -ForegroundColor Yellow }
} catch {
    Write-Host "Java: 설치되지 않음. 새 터미널을 열거나 재부팅 후 다시 확인하세요." -ForegroundColor Red
    $ok = $false
}
try {
    $m = mvn -version 2>&1 | Select-Object -First 1
    Write-Host "Maven: $m" -ForegroundColor Gray
} catch {
    Write-Host "Maven: 설치되지 않음. 새 터미널을 열어 Path를 새로고침한 뒤 mvn -version 을 확인하세요." -ForegroundColor Red
    $ok = $false
}
Write-Host ""
if ($ok) {
    Write-Host "모든 필수 요소가 준비되었습니다. 서버 실행: .\run.ps1" -ForegroundColor Green
} else {
    Write-Host "일부 항목이 인식되지 않습니다. 터미널을 닫고 새로 연 뒤 다시 확인해 주세요." -ForegroundColor Yellow
}
Write-Host ""
