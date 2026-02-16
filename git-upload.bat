@echo off
cd /d "%~dp0"
echo Uploading to GitHub (shortstimeeeee-sys/afbscenter)...
powershell -ExecutionPolicy Bypass -File "%~dp0git-upload.ps1" -RepoUrl "https://github.com/shortstimeeeee-sys/afbscenter.git"
echo.
pause
