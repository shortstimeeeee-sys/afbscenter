# Create desktop shortcuts for server management

$desktop = [Environment]::GetFolderPath("Desktop")
Write-Host "Desktop path: $desktop"

$vbsFiles = @(
    @{File="서버시작.vbs"; Name="Start Server"},
    @{File="서버중지.vbs"; Name="Stop Server"},
    @{File="서버재시작.vbs"; Name="Restart Server"},
    @{File="서버상태확인.vbs"; Name="Server Status"}
)

foreach ($item in $vbsFiles) {
    if (Test-Path $item.File) {
        $shortcutPath = "$desktop\$($item.Name).lnk"
        $shell = New-Object -ComObject WScript.Shell
        $link = $shell.CreateShortcut($shortcutPath)
        $link.TargetPath = (Resolve-Path $item.File).Path
        $link.WorkingDirectory = $PWD
        $link.Description = "AFBS Center Server Management"
        $link.Save()
        Write-Host "Created: $($item.Name)" -ForegroundColor Green
    }
}

Write-Host "`nShortcuts created on desktop!" -ForegroundColor Green
