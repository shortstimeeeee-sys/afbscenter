@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo 서버 제어판 디버그 모드
echo ========================================
echo.
echo PowerShell 스크립트 실행 중...
echo.

powershell.exe -ExecutionPolicy Bypass -NoProfile -STA -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; $ErrorActionPreference = 'Stop'; Write-Host '스크립트 경로: ' + (Get-Location).Path; Write-Host 'PowerShell 버전: ' + $PSVersionTable.PSVersion; Write-Host ''; try { & '.\server-control-panel.ps1' } catch { Write-Host \"`n오류 발생!\" -ForegroundColor Red; Write-Host \"오류 메시지: $_\" -ForegroundColor Red; Write-Host \"`n상세 정보:\" -ForegroundColor Yellow; Write-Host $_.Exception.ToString() -ForegroundColor Red; Write-Host \"`n\" -NoNewline; Read-Host \"Press Enter to exit\" }"

echo.
echo ========================================
echo 종료 코드: %ERRORLEVEL%
echo ========================================
pause
