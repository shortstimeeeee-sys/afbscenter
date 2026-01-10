# Direct launcher for server control panel
# This script ensures the GUI appears

$ErrorActionPreference = "Continue"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$psScript = Join-Path $scriptDir "server-control-panel.ps1"

if (-not (Test-Path $psScript)) {
    [System.Windows.Forms.MessageBox]::Show("Cannot find server-control-panel.ps1`n`nPath: $psScript", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    exit 1
}

# Launch PowerShell with GUI
Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass", "-WindowStyle Hidden", "-NoProfile", "-STA", "-File", "`"$psScript`"" -WindowStyle Hidden
