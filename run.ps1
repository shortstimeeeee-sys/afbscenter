# 프로젝트 실행 스크립트 (UTF-8 인코딩 설정 포함)

# UTF-8 인코딩 설정 (강화)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[System.Console]::InputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

# 환경 변수 로드 (시스템 및 사용자 환경 변수)
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
if (-not $env:JAVA_HOME) {
    $env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
}

$env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "Machine")
if (-not $env:MAVEN_HOME) {
    $env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "User")
}

# PATH 환경 변수 로드
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = if ($machinePath -and $userPath) { "$machinePath;$userPath" } elseif ($machinePath) { $machinePath } else { $userPath }

# 출력 인코딩 재확인 (한글 깨짐 방지)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AFBS 스포츠 운영 센터 실행" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Java 버전 확인
Write-Host "Java 버전 확인 중..." -ForegroundColor Yellow
try {
    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if (-not $javaCmd) {
        # JAVA_HOME에서 직접 찾기
        if ($env:JAVA_HOME) {
            $javaExe = Join-Path $env:JAVA_HOME "bin\java.exe"
            if (Test-Path $javaExe) {
                $javaVersion = & $javaExe -version 2>&1 | Select-Object -First 1
                Write-Host "Java: $javaVersion" -ForegroundColor Green
            } else {
                throw "Java 실행 파일을 찾을 수 없습니다."
            }
        } else {
            throw "JAVA_HOME이 설정되어 있지 않습니다."
        }
    } else {
        $javaVersion = java -version 2>&1 | Select-Object -First 1
        Write-Host "Java: $javaVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "오류: Java가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "SETUP_GUIDE.md 파일을 참고하여 Java를 설치해주세요." -ForegroundColor Red
    exit 1
}

# Maven 버전 확인
Write-Host "Maven 버전 확인 중..." -ForegroundColor Yellow
try {
    $mvnCmd = Get-Command mvn -ErrorAction SilentlyContinue
    if (-not $mvnCmd) {
        # MAVEN_HOME에서 직접 찾기
        if ($env:MAVEN_HOME) {
            $mvnExe = Join-Path $env:MAVEN_HOME "bin\mvn.cmd"
            if (Test-Path $mvnExe) {
                $mavenVersion = & $mvnExe -version 2>&1 | Select-Object -First 1
                Write-Host "Maven: $mavenVersion" -ForegroundColor Green
                $mvnCommand = $mvnExe
            } else {
                throw "Maven 실행 파일을 찾을 수 없습니다."
            }
        } else {
            throw "MAVEN_HOME이 설정되어 있지 않습니다."
        }
    } else {
        $mavenVersion = mvn -version 2>&1 | Select-Object -First 1
        Write-Host "Maven: $mavenVersion" -ForegroundColor Green
        $mvnCommand = "mvn"
    }
} catch {
    Write-Host "오류: Maven이 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "SETUP_GUIDE.md 파일을 참고하여 Maven을 설치해주세요." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "애플리케이션 실행 중..." -ForegroundColor Yellow
Write-Host ""

# 애플리케이션 실행 (UTF-8 인코딩 명시 - 한글 깨짐 방지)
$env:JAVA_TOOL_OPTIONS = "-Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8 -Duser.language=ko -Duser.country=KR"
$env:LANG = "ko_KR.UTF-8"

# JVM 인수 (한글 깨짐 방지)
$jvmArgs = "-Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8 -Duser.language=ko -Duser.country=KR"

# Maven 명령어 실행 (Spring Boot 웹 애플리케이션)
if ($mvnCommand) {
    & $mvnCommand "spring-boot:run" "-Dspring-boot.run.jvmArguments=$jvmArgs"
} else {
    & mvn "spring-boot:run" "-Dspring-boot.run.jvmArguments=$jvmArgs"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "웹 애플리케이션이 실행되었습니다!" -ForegroundColor Green
Write-Host "브라우저에서 http://localhost:8080 을 열어주세요." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
