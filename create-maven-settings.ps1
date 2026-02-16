# Maven settings.xml 생성 스크립트
$m2Dir = "$env:USERPROFILE\.m2"
$settingsFile = "$m2Dir\settings.xml"

Write-Host "=== Maven settings.xml 생성 ===" -ForegroundColor Green
Write-Host ""

# .m2 디렉토리 생성
if (-not (Test-Path $m2Dir)) {
    Write-Host ".m2 디렉토리 생성 중..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $m2Dir -Force | Out-Null
    Write-Host "✓ 디렉토리 생성 완료" -ForegroundColor Green
}

# settings.xml 내용
$settingsContent = @"
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
          http://maven.apache.org/xsd/settings-1.0.0.xsd">
    <localRepository>`$`{user.home}`/.m2/repository</localRepository>
    <interactiveMode>true</interactiveMode>
    <offline>false</offline>
    <pluginGroups/>
    <servers/>
    <mirrors/>
    <proxies/>
    <profiles>
        <profile>
            <id>disable-tracking</id>
            <properties>
                <aether.disableTracking>true</aether.disableTracking>
                <aether.updateCheckManager.sessionState>false</aether.updateCheckManager.sessionState>
            </properties>
        </profile>
    </profiles>
    <activeProfiles>
        <activeProfile>disable-tracking</activeProfile>
    </activeProfiles>
</settings>
"@

# settings.xml 파일 생성
try {
    Write-Host "settings.xml 파일 생성 중..." -ForegroundColor Yellow
    $settingsContent | Out-File -FilePath $settingsFile -Encoding UTF8 -Force
    Write-Host "✓ settings.xml 파일 생성 완료" -ForegroundColor Green
    Write-Host "  경로: $settingsFile" -ForegroundColor Cyan
} catch {
    Write-Host "✗ settings.xml 파일 생성 실패: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== 완료 ===" -ForegroundColor Green
Write-Host "Maven tracking 기능이 비활성화되었습니다." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
