# 서버 시작 스크립트
$scriptPath = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; `$env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; mvn spring-boot:run" -WindowStyle Normal
