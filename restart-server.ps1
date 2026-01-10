# 서버 재시작 스크립트
$scriptPath = $PSScriptRoot

# 중지
$javaProcesses = Get-Process | Where-Object {$_.ProcessName -like "*java*"} -ErrorAction SilentlyContinue
foreach ($proc in $javaProcesses) {
    try {
        $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -eq 8080}
        if ($connections) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {
        # 무시
    }
}

Start-Sleep -Seconds 2

# 시작
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; `$env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; mvn spring-boot:run" -WindowStyle Normal
