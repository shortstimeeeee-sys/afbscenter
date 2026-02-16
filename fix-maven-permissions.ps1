# Maven 권한 문제 해결 스크립트
Write-Host "=== Maven 권한 문제 해결 ===" -ForegroundColor Green
Write-Host ""

$m2Repo = "$env:USERPROFILE\.m2\repository"
Write-Host "Maven 로컬 저장소: $m2Repo" -ForegroundColor Cyan

if (-not (Test-Path $m2Repo)) {
    Write-Host "Maven 로컬 저장소를 찾을 수 없습니다." -ForegroundColor Yellow
    exit 0
}

# 문제가 되는 파일들 찾기 및 삭제
$problemFiles = @(
    "$m2Repo\org\springframework\boot\resolver-status.properties"
)

$fixed = $false
foreach ($filePath in $problemFiles) {
    if (Test-Path $filePath) {
        try {
            Write-Host "파일 삭제 시도: $filePath" -ForegroundColor Yellow
            Remove-Item $filePath -Force -ErrorAction Stop
            Write-Host "✓ 파일 삭제 완료" -ForegroundColor Green
            $fixed = $true
        } catch {
            Write-Host "✗ 파일 삭제 실패: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "  파일이 사용 중일 수 있습니다. 다른 프로그램을 종료하고 다시 시도하세요." -ForegroundColor Yellow
        }
    }
}

# resolver-status.properties 파일이 있는 모든 디렉토리에서 삭제
try {
    $allResolverFiles = Get-ChildItem -Path "$m2Repo" -Filter "resolver-status.properties" -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $allResolverFiles) {
        try {
            Write-Host "파일 삭제 시도: $($file.FullName)" -ForegroundColor Yellow
            # 파일 속성 제거 (읽기 전용 등)
            if (Test-Path $file.FullName) {
                $fileInfo = Get-Item $file.FullName -Force
                $fileInfo.Attributes = 'Normal'
            }
            Remove-Item $file.FullName -Force -ErrorAction Stop
            Write-Host "✓ 파일 삭제 완료" -ForegroundColor Green
            $fixed = $true
        } catch {
            Write-Host "✗ 파일 삭제 실패, 이름 변경 시도: $($file.FullName)" -ForegroundColor Yellow
            try {
                $newName = $file.FullName + ".old_" + (Get-Date -Format "yyyyMMddHHmmss")
                Rename-Item $file.FullName -NewName $newName -Force -ErrorAction Stop
                Write-Host "✓ 파일 이름 변경 완료" -ForegroundColor Green
                $fixed = $true
            } catch {
                Write-Host "✗ 파일 이름 변경도 실패: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "파일 검색 중 오류: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 디렉토리 권한 확인 및 수정
try {
    $bootDir = "$m2Repo\org\springframework\boot"
    if (Test-Path $bootDir) {
        Write-Host "디렉토리 권한 수정: $bootDir" -ForegroundColor Yellow
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
        Write-Host "✓ 디렉토리 권한 수정 완료" -ForegroundColor Green
        $fixed = $true
    }
} catch {
    Write-Host "✗ 디렉토리 권한 수정 실패: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
if ($fixed) {
    Write-Host "=== 권한 문제 해결 완료 ===" -ForegroundColor Green
    Write-Host "이제 서버를 시작할 수 있습니다." -ForegroundColor Cyan
} else {
    Write-Host "=== 해결할 문제가 없거나 해결에 실패했습니다 ===" -ForegroundColor Yellow
    Write-Host "수동으로 다음 파일을 삭제해보세요:" -ForegroundColor Yellow
    Write-Host "  $m2Repo\org\springframework\boot\resolver-status.properties" -ForegroundColor White
}

Write-Host ""
Read-Host "Press Enter to exit"
