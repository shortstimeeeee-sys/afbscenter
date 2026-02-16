# Create "Server Control Panel" shortcut on Desktop (run once per PC)
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Server Control Panel.lnk"
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Get-Location | Select-Object -ExpandProperty Path }
$batPath = Join-Path $scriptDir "Server-Control-Panel-Fixed.bat"

$shell = New-Object -ComObject WScript.Shell
if (Test-Path $shortcutPath) { Remove-Item $shortcutPath -Force }

$link = $shell.CreateShortcut($shortcutPath)
$link.TargetPath = $batPath
$link.WorkingDirectory = $scriptDir
$link.Description = "AFBS Center Server Control Panel"
$link.WindowStyle = 1
$link.Save()

Write-Host "Done. Shortcut created: $shortcutPath"
Write-Host "You can now double-click 'Server Control Panel' on your Desktop."
