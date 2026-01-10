@echo off
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -STA -File "%~dp0server-control.ps1"
if errorlevel 1 (
    pause
)
