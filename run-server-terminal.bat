@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo AFBS 센터 서버 실행 (터미널)
echo ========================================
echo.
echo 서버를 시작합니다...
echo 종료하려면 Ctrl+C를 누르세요.
echo.
powershell.exe -NoExit -Command "cd '$PWD'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; $env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'; mvn spring-boot:run"
