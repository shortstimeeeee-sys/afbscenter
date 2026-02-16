# fix-java-path.ps1 - Remove broken Java 8 path, set Java 17
# Run as Administrator: powershell -ExecutionPolicy Bypass -File "C:\Users\seo\Desktop\afbscenter\fix-java-path.ps1"

$ErrorActionPreference = "Stop"
chcp 65001 | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Java path fix (jvm.cfg error)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Is-Java8Path($p) {
    if (-not $p) { return $false }
    $p -like "*Java\jre-1.8*" -or $p -like "*Java\jre1.8*" -or $p -like "*Java\jdk1.8*" -or $p -like "*\jre-1.8\*" -or $p -eq "C:\Program Files\Java\jre-1.8\bin"
}

$pathVarName = "Path"
$javaHomeMachine = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
$javaHomeUser = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
$currentJavaHome = if ($javaHomeUser) { $javaHomeUser } else { $javaHomeMachine }

$pathUser = [Environment]::GetEnvironmentVariable($pathVarName, "User")
if (-not $pathUser) { $pathUser = "" }
$pathMachine = [Environment]::GetEnvironmentVariable($pathVarName, "Machine")
if (-not $pathMachine) { $pathMachine = "" }

Write-Host "[Current JAVA_HOME] $currentJavaHome" -ForegroundColor Gray
Write-Host ""

$isBadJava8 = $currentJavaHome -and ($currentJavaHome -like "*jre-1.8*" -or $currentJavaHome -like "*jre1.8*" -or $currentJavaHome -like "*jdk1.8*")
if ($isBadJava8) {
    [Environment]::SetEnvironmentVariable("JAVA_HOME", $null, "User")
    try { [Environment]::SetEnvironmentVariable("JAVA_HOME", $null, "Machine") } catch {}
    Write-Host "[OK] JAVA_HOME cleared (old Java 8)" -ForegroundColor Green
}

$pathPartsUser = $pathUser -split ";" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
$newPathPartsUser = @()
foreach ($p in $pathPartsUser) { if (-not (Is-Java8Path $p)) { $newPathPartsUser += $p } }
$newPathUser = ($newPathPartsUser | Select-Object -Unique) -join ";"
if ($newPathUser -ne $pathUser) {
    [Environment]::SetEnvironmentVariable($pathVarName, $newPathUser, "User")
    Write-Host "[OK] User Path: Java 8 removed" -ForegroundColor Green
}

$pathPartsMachine = $pathMachine -split ";" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
$newPathPartsMachine = @()
foreach ($p in $pathPartsMachine) { if (-not (Is-Java8Path $p)) { $newPathPartsMachine += $p } }
$newPathMachine = ($newPathPartsMachine | Select-Object -Unique) -join ";"
if ($newPathMachine -ne $pathMachine) {
    try {
        [Environment]::SetEnvironmentVariable($pathVarName, $newPathMachine, "Machine")
        Write-Host "[OK] System Path: Java 8 removed" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] System Path not updated. Run PowerShell as Administrator." -ForegroundColor Red
    }
}

$searchPatterns = @(
    "C:\Program Files\Microsoft\jdk-17*",
    "C:\Program Files\Eclipse Adoptium\jdk-17*",
    "C:\Program Files\Java\jdk-17*",
    "C:\Program Files\Microsoft\jdk-21*",
    "C:\Program Files\Eclipse Adoptium\jdk-21*"
)
$foundJavaHome = $null
foreach ($pattern in $searchPatterns) {
    $dirs = Get-Item $pattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    foreach ($d in $dirs) {
        $javaExe = Join-Path $d.FullName "bin\java.exe"
        if (Test-Path $javaExe) { $foundJavaHome = $d.FullName; break }
    }
    if ($foundJavaHome) { break }
}

if ($foundJavaHome) {
    $javaBin = Join-Path $foundJavaHome "bin"
    [Environment]::SetEnvironmentVariable("JAVA_HOME", $foundJavaHome, "User")
    try { [Environment]::SetEnvironmentVariable("JAVA_HOME", $foundJavaHome, "Machine") } catch {}
    $pathForUser = [Environment]::GetEnvironmentVariable($pathVarName, "User")
    if (-not $pathForUser) { $pathForUser = "" }
    if ($pathForUser -notlike "*$javaBin*") {
        $newPathWithJava = $javaBin + ";" + $pathForUser
        [Environment]::SetEnvironmentVariable($pathVarName, $newPathWithJava, "User")
    }
    Write-Host "[OK] JAVA_HOME set: $foundJavaHome" -ForegroundColor Green
} else {
    Write-Host "[INFO] Java 17 not found. Install with: winget install -e --id Microsoft.OpenJDK.17" -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Close PowerShell, open a new window, then run: java -version" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
