@echo off
cd /d "%~dp0"
wscript.exe "server-control.vbs"
timeout /t 2 /nobreak >nul
