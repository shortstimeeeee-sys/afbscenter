# 서버 중지 스크립트
$javaProcesses = Get-Process | Where-Object {$_.ProcessName -like "*java*"} -ErrorAction SilentlyContinue
foreach ($proc in $javaProcesses) {
    try {
        $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -eq 8080}
        if ($connections) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "서버가 중지되었습니다. (PID: $($proc.Id))"
        }
    } catch {
        # 무시
    }
}
