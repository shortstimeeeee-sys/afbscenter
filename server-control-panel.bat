@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -NoProfile -STA -WindowStyle Hidden -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; $PSDefaultParameterValues['*:Encoding'] = 'utf8'; $env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8'; $content = [System.IO.File]::ReadAllText('%~dp0server-control-panel.ps1', [System.Text.Encoding]::UTF8); Invoke-Expression $content"
