# 바로가기 생성 스크립트
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktop\Server Control Panel.lnk"
$batPath = Join-Path $PSScriptRoot "Server-Control-Panel-Fixed.bat"
$scriptDir = $PSScriptRoot

$shell = New-Object -ComObject WScript.Shell

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
}

$link = $shell.CreateShortcut($shortcutPath)
$link.TargetPath = $batPath
$link.WorkingDirectory = $scriptDir
$link.Description = "AFBS Center Server Control Panel"
$link.WindowStyle = 1
$link.Save()

Write-Host "바로가기가 BAT 파일을 실행하도록 생성되었습니다: $shortcutPath"
Write-Host "  대상: $batPath"
