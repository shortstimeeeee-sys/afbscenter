# Maven 디렉토리 권한 수정 스크립트
Write-Host "=== Maven 디렉토리 권한 수정 ===" -ForegroundColor Green
Write-Host ""

$m2Repo = "$env:USERPROFILE\.m2\repository"
Write-Host "Maven 로컬 저장소: $m2Repo" -ForegroundColor Cyan

if (-not (Test-Path $m2Repo)) {
    Write-Host "Maven 로컬 저장소를 찾을 수 없습니다. 생성합니다..." -ForegroundColor Yellow
    try {
        New-Item -ItemType Directory -Path $m2Repo -Force | Out-Null
        Write-Host "✓ 디렉토리 생성 완료" -ForegroundColor Green
    } catch {
        Write-Host "✗ 디렉토리 생성 실패: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# 전체 .m2 디렉토리 권한 수정
try {
    Write-Host "전체 .m2 디렉토리 권한 수정 중..." -ForegroundColor Yellow
    $m2Dir = "$env:USERPROFILE\.m2"
    $acl = Get-Acl $m2Dir
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $env:USERNAME,
        "FullControl",
        "ContainerInherit,ObjectInherit",
        "None",
        "Allow"
    )
    $acl.SetAccessRule($accessRule)
    Set-Acl $m2Dir $acl
    Write-Host "✓ .m2 디렉토리 권한 수정 완료" -ForegroundColor Green
} catch {
    Write-Host "✗ .m2 디렉토리 권한 수정 실패: $($_.Exception.Message)" -ForegroundColor Red
}

# repository 디렉토리 권한 수정
try {
    Write-Host "repository 디렉토리 권한 수정 중..." -ForegroundColor Yellow
    $acl = Get-Acl $m2Repo
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $env:USERNAME,
        "FullControl",
        "ContainerInherit,ObjectInherit",
        "None",
        "Allow"
    )
    $acl.SetAccessRule($accessRule)
    Set-Acl $m2Repo $acl
    Write-Host "✓ repository 디렉토리 권한 수정 완료" -ForegroundColor Green
} catch {
    Write-Host "✗ repository 디렉토리 권한 수정 실패: $($_.Exception.Message)" -ForegroundColor Red
}

# org/springframework/boot 디렉토리 권한 수정
try {
    $bootDir = "$m2Repo\org\springframework\boot"
    if (-not (Test-Path $bootDir)) {
        Write-Host "디렉토리 생성 중: $bootDir" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $bootDir -Force | Out-Null
    }
    Write-Host "org/springframework/boot 디렉토리 권한 수정 중..." -ForegroundColor Yellow
    $acl = Get-Acl $bootDir
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $env:USERNAME,
        "FullControl",
        "ContainerInherit,ObjectInherit",
        "None",
        "Allow"
    )
    $acl.SetAccessRule($accessRule)
    Set-Acl $bootDir $acl
    Write-Host "✓ org/springframework/boot 디렉토리 권한 수정 완료" -ForegroundColor Green
} catch {
    Write-Host "✗ 디렉토리 권한 수정 실패: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 권한 수정 완료 ===" -ForegroundColor Green
Write-Host "이제 서버를 시작할 수 있습니다." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
