# AFBS Center Server Control Panel
# Small modal window to control the server

# Encoding settings (execute first - for Korean text)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8'
[System.Console]::InputEncoding = [System.Text.Encoding]::UTF8

# Load latest PATH/MAVEN_HOME/JAVA_HOME from registry (so desktop shortcut sees Maven after setup-laptop.ps1)
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User") }
$env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "Machine")
if (-not $env:MAVEN_HOME) { $env:MAVEN_HOME = [Environment]::GetEnvironmentVariable("MAVEN_HOME", "User") }
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = if ($machinePath -and $userPath) { "$machinePath;$userPath" } elseif ($machinePath) { $machinePath } else { $userPath }
if ($env:MAVEN_HOME) { $env:Path = "$env:MAVEN_HOME\bin;$env:Path" }

# Immediate startup log recording
$scriptRoot = $null
if ($MyInvocation.MyCommand.Path) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $scriptRoot -and $PSScriptRoot) {
    $scriptRoot = $PSScriptRoot
}
if (-not $scriptRoot) {
    $scriptRoot = Get-Location
}
if (-not $scriptRoot) {
    $scriptRoot = $PWD
}

$startupLogPath = Join-Path $scriptRoot "server-panel-startup.log"
$errorLogPath = Join-Path $scriptRoot "server-panel-error.log"

try {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$timestamp] PowerShell script started" | Out-File -FilePath $startupLogPath -Encoding UTF8 -Append
    "[$timestamp] Script path: $($MyInvocation.MyCommand.Path)" | Out-File -FilePath $startupLogPath -Encoding UTF8 -Append
    "[$timestamp] Working directory: $(Get-Location)" | Out-File -FilePath $startupLogPath -Encoding UTF8 -Append
} catch {
    # 로그 파일 쓰기 실패 시 무시
}

# Error handling settings
$ErrorActionPreference = "Continue"

# Global error handler setup
$Error.Clear()
trap {
    $errorMsg = "Fatal error occurred while running server control panel:`n`nError Type: $($_.Exception.GetType().FullName)`nError Message: $($_.Exception.Message)`n`nStack Trace:`n$($_.Exception.StackTrace)"
    try {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "[$timestamp] $errorMsg" | Out-File -FilePath $errorLogPath -Encoding UTF8 -Append
    } catch {
        # 로그 파일 쓰기 실패 시 무시
    }
    try {
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Server Control Panel Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    } catch {
        # MessageBox 실패 시 콘솔에 출력 (Hidden 창이므로 보이지 않을 수 있음)
        Write-Host $errorMsg -ForegroundColor Red
    }
    exit 1
}

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
} catch {
    $errorMsg = "Cannot load required .NET assemblies.`n`nError: $($_.Exception.Message)`n`nStack Trace:`n$($_.Exception.StackTrace)"
    $logPath = Join-Path $PSScriptRoot "server-panel-error.log"
    try {
        $errorMsg | Out-File -FilePath $logPath -Encoding UTF8
    } catch {
        # 로그 파일 쓰기 실패 시 무시
    }
    try {
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    } catch {
        Write-Host $errorMsg -ForegroundColor Red
    }
    exit 1
}

# Additional startup log recording
try {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$timestamp] .NET assemblies loaded" | Out-File -FilePath $startupLogPath -Encoding UTF8 -Append
} catch {
    # 로그 파일 쓰기 실패 시 무시
}

# Mutex for single instance (simplified)
$mutex = $null
try {
    $mutex = [System.Threading.Mutex]::new($false, "Global\AFBS_Server_Control_Panel")
    if (-not $mutex.WaitOne(0, $false)) {
        exit 0
    }
} catch {
    $mutex = $null
}

# Main form creation
$form = New-Object System.Windows.Forms.Form
$form.Text = "AFBS Center Server Control Panel"
$form.Size = New-Object System.Drawing.Size(350, 365)
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

# Title label
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "⚾ AFBS Center Server Control"
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$titleLabel.AutoSize = $true
$titleLabel.Location = New-Object System.Drawing.Point(80, 15)
$form.Controls.Add($titleLabel)

# Status label
$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = "Checking status..."
$statusLabel.AutoSize = $true
$statusLabel.Location = New-Object System.Drawing.Point(20, 50)
$statusLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$form.Controls.Add($statusLabel)

# Status display label (large text)
$statusDisplay = New-Object System.Windows.Forms.Label
$statusDisplay.Text = "●"
$statusDisplay.Font = New-Object System.Drawing.Font("Segoe UI", 20)
$statusDisplay.AutoSize = $true
$statusDisplay.Location = New-Object System.Drawing.Point(20, 75)
$form.Controls.Add($statusDisplay)

# Start server button
$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "▶ Start Server"
$btnStart.Size = New-Object System.Drawing.Size(140, 40)
$btnStart.Location = New-Object System.Drawing.Point(20, 120)
$btnStart.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$btnStart.BackColor = [System.Drawing.Color]::FromArgb(46, 204, 113)
$btnStart.ForeColor = [System.Drawing.Color]::White
$btnStart.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnStart.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnStart)

# Stop server button
$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text = "■ Stop Server"
$btnStop.Size = New-Object System.Drawing.Size(140, 40)
$btnStop.Location = New-Object System.Drawing.Point(180, 120)
$btnStop.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$btnStop.BackColor = [System.Drawing.Color]::FromArgb(231, 76, 60)
$btnStop.ForeColor = [System.Drawing.Color]::White
$btnStop.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnStop.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnStop)

# Restart server button
$btnRestart = New-Object System.Windows.Forms.Button
$btnRestart.Text = "↻ Restart Server"
$btnRestart.Size = New-Object System.Drawing.Size(140, 40)
$btnRestart.Location = New-Object System.Drawing.Point(20, 170)
$btnRestart.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$btnRestart.BackColor = [System.Drawing.Color]::FromArgb(52, 152, 219)
$btnRestart.ForeColor = [System.Drawing.Color]::White
$btnRestart.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnRestart.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnRestart)

# Open browser button
$btnBrowser = New-Object System.Windows.Forms.Button
$btnBrowser.Text = "Open localhost"
$btnBrowser.Size = New-Object System.Drawing.Size(140, 40)
$btnBrowser.Location = New-Object System.Drawing.Point(180, 170)
$btnBrowser.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$btnBrowser.BackColor = [System.Drawing.Color]::FromArgb(155, 89, 182)
$btnBrowser.ForeColor = [System.Drawing.Color]::White
$btnBrowser.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnBrowser.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnBrowser)

# Start ngrok tunnel button
$ngrokUrl = "https://jasper-declared-josue.ngrok-free.dev"
$btnStartNgrok = New-Object System.Windows.Forms.Button
$btnStartNgrok.Text = "Start ngrok tunnel"
$btnStartNgrok.Size = New-Object System.Drawing.Size(140, 36)
$btnStartNgrok.Location = New-Object System.Drawing.Point(20, 220)
$btnStartNgrok.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnStartNgrok.BackColor = [System.Drawing.Color]::FromArgb(39, 174, 96)
$btnStartNgrok.ForeColor = [System.Drawing.Color]::White
$btnStartNgrok.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnStartNgrok.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnStartNgrok)

# Open ngrok URL in browser button
$btnNgrok = New-Object System.Windows.Forms.Button
$btnNgrok.Text = "Open ngrok URL"
$btnNgrok.Size = New-Object System.Drawing.Size(140, 36)
$btnNgrok.Location = New-Object System.Drawing.Point(180, 220)
$btnNgrok.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$btnNgrok.BackColor = [System.Drawing.Color]::FromArgb(149, 165, 166)
$btnNgrok.ForeColor = [System.Drawing.Color]::White
$btnNgrok.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnNgrok.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnNgrok)

# Java process check function
function Get-JavaProcess {
    try {
        $javaProcesses = Get-Process | Where-Object {$_.ProcessName -like "*java*"} -ErrorAction SilentlyContinue
        # Spring Boot 관련 프로세스 찾기 (포트 8080 사용 여부로 판단)
        foreach ($proc in $javaProcesses) {
            try {
                $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -eq 8080}
                if ($connections) {
                    return $proc
                }
            } catch {
                # 포트 확인 실패 시 프로세스 이름으로만 판단
            }
        }
    } catch {
        # 오류 무시
    }
    return $null
}

# Maven permission fix function
function Fix-MavenPermissions {
    try {
        $m2Repo = "$env:USERPROFILE\.m2\repository"
        if (-not (Test-Path $m2Repo)) {
            return $true
        }
        
        $fixed = $false
        
        # Java/Maven 프로세스가 파일을 잠그고 있을 수 있으므로 잠시 대기
        Start-Sleep -Milliseconds 500
        
        # 모든 resolver-status.properties 파일 찾기 및 삭제
        try {
            $allResolverFiles = Get-ChildItem -Path "$m2Repo" -Filter "resolver-status.properties" -Recurse -ErrorAction SilentlyContinue
            foreach ($file in $allResolverFiles) {
                try {
                    # 파일 속성 제거 (읽기 전용 등)
                    if (Test-Path $file.FullName) {
                        $fileInfo = Get-Item $file.FullName -Force
                        $fileInfo.Attributes = 'Normal'
                    }
                    # 파일 삭제
                    Remove-Item $file.FullName -Force -ErrorAction Stop
                    $fixed = $true
                } catch {
                    # 삭제 실패 시 파일 이름 변경 시도
                    try {
                        $timestamp = Get-Date -Format "yyyyMMddHHmmss"
                        $newName = $file.FullName + ".old_" + $timestamp
                        if (Test-Path $file.FullName) {
                            $fileInfo = Get-Item $file.FullName -Force
                            $fileInfo.Attributes = 'Normal'
                        }
                        Rename-Item $file.FullName -NewName $newName -Force -ErrorAction Stop
                        $fixed = $true
                    } catch {
                        # 이름 변경도 실패하면 무시
                    }
                }
            }
        } catch {
            # 파일 검색 실패 시 무시
        }
        
        # 특정 파일 직접 삭제 시도
        $specificFile = "$m2Repo\org\springframework\boot\resolver-status.properties"
        if (Test-Path $specificFile) {
            try {
                # 파일 속성 제거
                $fileInfo = Get-Item $specificFile -Force
                $fileInfo.Attributes = 'Normal'
                # 파일 삭제
                Remove-Item $specificFile -Force -ErrorAction Stop
                $fixed = $true
            } catch {
                # 삭제 실패 시 이름 변경
                try {
                    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
                    $newName = $specificFile + ".old_" + $timestamp
                    $fileInfo = Get-Item $specificFile -Force
                    $fileInfo.Attributes = 'Normal'
                    Rename-Item $specificFile -NewName $newName -Force -ErrorAction Stop
                    $fixed = $true
                } catch {
                    # 이름 변경도 실패하면 무시
                }
            }
        }
        
        # 전체 .m2 디렉토리 권한 수정
        try {
            $m2Dir = "$env:USERPROFILE\.m2"
            if (Test-Path $m2Dir) {
                $acl = Get-Acl $m2Dir
                $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                    $env:USERNAME,
                    "FullControl",
                    "ContainerInherit,ObjectInherit",
                    "None",
                    "Allow"
                )
                $acl.SetAccessRule($accessRule)
                Set-Acl $m2Dir $acl -ErrorAction SilentlyContinue
                $fixed = $true
            }
        } catch {
            # 권한 수정 실패 시 무시
        }
        
        # repository 디렉토리 권한 수정
        try {
            if (Test-Path $m2Repo) {
                $acl = Get-Acl $m2Repo
                $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                    $env:USERNAME,
                    "FullControl",
                    "ContainerInherit,ObjectInherit",
                    "None",
                    "Allow"
                )
                $acl.SetAccessRule($accessRule)
                Set-Acl $m2Repo $acl -ErrorAction SilentlyContinue
                $fixed = $true
            }
        } catch {
            # 권한 수정 실패 시 무시
        }
        
        # org/springframework/boot 디렉토리 권한 확인 및 수정
        try {
            $bootDir = "$m2Repo\org\springframework\boot"
            if (-not (Test-Path $bootDir)) {
                # 디렉토리가 없으면 생성
                New-Item -ItemType Directory -Path $bootDir -Force -ErrorAction SilentlyContinue | Out-Null
            }
            if (Test-Path $bootDir) {
                # 디렉토리 속성 확인
                $dirInfo = Get-Item $bootDir -Force
                $dirInfo.Attributes = 'Directory'
                
                # 권한 설정
                $acl = Get-Acl $bootDir
                $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                    $env:USERNAME,
                    "FullControl",
                    "ContainerInherit,ObjectInherit",
                    "None",
                    "Allow"
                )
                $acl.SetAccessRule($accessRule)
                Set-Acl $bootDir $acl -ErrorAction SilentlyContinue
                $fixed = $true
            }
        } catch {
            # 권한 수정 실패 시 무시
        }
        
        # org/springframework 디렉토리도 확인
        try {
            $springDir = "$m2Repo\org\springframework"
            if (-not (Test-Path $springDir)) {
                New-Item -ItemType Directory -Path $springDir -Force -ErrorAction SilentlyContinue | Out-Null
            }
            if (Test-Path $springDir) {
                $acl = Get-Acl $springDir
                $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                    $env:USERNAME,
                    "FullControl",
                    "ContainerInherit,ObjectInherit",
                    "None",
                    "Allow"
                )
                $acl.SetAccessRule($accessRule)
                Set-Acl $springDir $acl -ErrorAction SilentlyContinue
                $fixed = $true
            }
        } catch {
            # 권한 수정 실패 시 무시
        }
        
        # org 디렉토리도 확인
        try {
            $orgDir = "$m2Repo\org"
            if (-not (Test-Path $orgDir)) {
                New-Item -ItemType Directory -Path $orgDir -Force -ErrorAction SilentlyContinue | Out-Null
            }
            if (Test-Path $orgDir) {
                $acl = Get-Acl $orgDir
                $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                    $env:USERNAME,
                    "FullControl",
                    "ContainerInherit,ObjectInherit",
                    "None",
                    "Allow"
                )
                $acl.SetAccessRule($accessRule)
                Set-Acl $orgDir $acl -ErrorAction SilentlyContinue
                $fixed = $true
            }
        } catch {
            # 권한 수정 실패 시 무시
        }
        
        return $fixed
    } catch {
        return $false
    }
}

# Status update function
function Update-Status {
    try {
        $processes = Get-JavaProcess
        if ($processes) {
            $statusLabel.Text = "Server Running (PID: $($processes.Id))"
            $statusDisplay.Text = "●"
            $statusDisplay.ForeColor = [System.Drawing.Color]::Green
            $btnStart.Enabled = $false
            $btnStop.Enabled = $true
            $btnRestart.Enabled = $true
        } else {
            $statusLabel.Text = "Server Stopped"
            $statusDisplay.Text = "○"
            $statusDisplay.ForeColor = [System.Drawing.Color]::Red
            $btnStart.Enabled = $true
            $btnStop.Enabled = $false
            $btnRestart.Enabled = $false
        }
    } catch {
        $statusLabel.Text = "Status Check Error"
        $statusDisplay.Text = "?"
        $statusDisplay.ForeColor = [System.Drawing.Color]::Orange
    }
}

# 서버 시작
$btnStart.Add_Click({
    try {
        # 인코딩 재설정 (이벤트 핸들러 내에서)
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $OutputEncoding = [System.Text.Encoding]::UTF8
        
        $btnStart.Enabled = $false
        $statusLabel.Text = "서버 시작 중..."
        
        $scriptPath = $PSScriptRoot
        if (-not $scriptPath) {
            $scriptPath = Get-Location
        }
        
        # 경로에 공백이 있을 수 있으므로 따옴표로 감싸기
        $scriptPathQuoted = "`"$scriptPath`""
        
        # Maven이 설치되어 있는지 확인
        $mvnCheck = Get-Command mvn -ErrorAction SilentlyContinue
        if (-not $mvnCheck) {
            $errorMsg = "Maven is not installed or not registered in PATH.`n`nPlease install Maven or add it to PATH."
            [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            $btnStart.Enabled = $true
            Update-Status
            return
        }
        
        # pom.xml 파일 존재 확인
        $pomPath = Join-Path $scriptPath "pom.xml"
        if (-not (Test-Path $pomPath)) {
            $errorMsg = "pom.xml file not found.`n`nPath: $pomPath"
            [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            $btnStart.Enabled = $true
            Update-Status
            return
        }
        
        # Maven 권한 문제 자동 해결
        $statusLabel.Text = "Checking Maven permissions..."
        [System.Windows.Forms.Application]::DoEvents()
        $fixed = Fix-MavenPermissions
        
        # resolver-status.properties 파일을 미리 생성하여 권한 문제 방지
        try {
            $m2Repo = "$env:USERPROFILE\.m2\repository"
            $resolverFile = "$m2Repo\org\springframework\boot\resolver-status.properties"
            $resolverDir = Split-Path $resolverFile -Parent
            
            # 디렉토리 생성
            if (-not (Test-Path $resolverDir)) {
                New-Item -ItemType Directory -Path $resolverDir -Force -ErrorAction SilentlyContinue | Out-Null
            }
            
            # 파일이 없으면 미리 생성
            if (-not (Test-Path $resolverFile)) {
                $null | Out-File -FilePath $resolverFile -Encoding UTF8 -Force -ErrorAction SilentlyContinue
            }
            
            # 파일 권한 설정
            if (Test-Path $resolverFile) {
                $fileInfo = Get-Item $resolverFile -Force
                $fileInfo.Attributes = 'Normal'
                $acl = Get-Acl $resolverFile
                $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                    $env:USERNAME,
                    "FullControl",
                    "Allow"
                )
                $acl.SetAccessRule($accessRule)
                Set-Acl $resolverFile $acl -ErrorAction SilentlyContinue
            }
        } catch {
            # 파일 생성 실패 시 무시
        }
        
        if ($fixed) {
            $statusLabel.Text = "Maven permissions fixed. Starting server..."
            Start-Sleep -Milliseconds 500
        } else {
            $statusLabel.Text = "서버 시작 중..."
        }
        [System.Windows.Forms.Application]::DoEvents()
        
        # 서버 시작 명령 실행 - start-server.ps1 파일 직접 실행
        try {
            # start-server.ps1 파일을 직접 실행 (가장 안정적)
            $startScript = Join-Path $scriptPath "start-server.ps1"
            if (Test-Path $startScript) {
                # Start-Process로 새 창에서 실행
                Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $startScript -WindowStyle Normal
            } else {
                # 파일이 없으면 직접 명령 실행
                $psCommand = "cd '$scriptPath'; `$env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; mvn spring-boot:run -Daether.disableTracking=true -Daether.updateCheckManager.sessionState=false"
                Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $psCommand -WindowStyle Normal
            }
        } catch {
            $errorMsg = "Failed to start server: $($_.Exception.Message)`n`nStack Trace:`n$($_.Exception.StackTrace)"
            [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            $btnStart.Enabled = $true
            Update-Status
            return
        }
        
        Start-Sleep -Seconds 5
        Update-Status
    } catch {
        $errorMsg = "Error occurred while starting server.`n`nError: $($_.Exception.Message)`n`nStack Trace:`n$($_.Exception.StackTrace)"
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        $btnStart.Enabled = $true
        Update-Status
    }
})

# Stop server
$btnStop.Add_Click({
    try {
        # 인코딩 재설정 (이벤트 핸들러 내에서)
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $OutputEncoding = [System.Text.Encoding]::UTF8
        
        $btnStop.Enabled = $false
        $statusLabel.Text = "Stopping server..."
        
        $processes = Get-JavaProcess
        if ($processes) {
            Stop-Process -Id $processes.Id -Force -ErrorAction SilentlyContinue
        }
        
        Start-Sleep -Seconds 2
        Update-Status
    } catch {
        $errorMsg = "Error occurred while stopping server.`n`n$($_.Exception.Message)"
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        Update-Status
    }
})

# Restart server
$btnRestart.Add_Click({
    try {
        # 인코딩 재설정 (이벤트 핸들러 내에서)
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $OutputEncoding = [System.Text.Encoding]::UTF8
        
        $btnRestart.Enabled = $false
        $statusLabel.Text = "Restarting server..."
        
        # 중지
        $processes = Get-JavaProcess
        if ($processes) {
            Stop-Process -Id $processes.Id -Force -ErrorAction SilentlyContinue
        }
        
        Start-Sleep -Seconds 2
        
        # 시작 - restart-server.ps1 파일 직접 실행
        $scriptPath = $PSScriptRoot
        if (-not $scriptPath) {
            $scriptPath = Get-Location
        }
        try {
            # restart-server.ps1 파일을 직접 실행 (가장 안정적)
            $restartScript = Join-Path $scriptPath "restart-server.ps1"
            if (Test-Path $restartScript) {
                # Start-Process로 새 창에서 실행
                Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $restartScript -WindowStyle Normal
            } else {
                # 파일이 없으면 직접 명령 실행
                $psCommand = "cd '$scriptPath'; `$env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; mvn spring-boot:run -Daether.disableTracking=true -Daether.updateCheckManager.sessionState=false"
                Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $psCommand -WindowStyle Normal
            }
        } catch {
            $errorMsg = "Failed to restart server: $($_.Exception.Message)`n`nStack Trace:`n$($_.Exception.StackTrace)"
            [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            Update-Status
            return
        }
        
        Start-Sleep -Seconds 3
        Update-Status
    } catch {
        $errorMsg = "Error occurred while restarting server.`n`n$($_.Exception.Message)"
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        Update-Status
    }
})

# Open browser (localhost)
$btnBrowser.Add_Click({
    try {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $OutputEncoding = [System.Text.Encoding]::UTF8
        Start-Process "http://localhost:8080"
    } catch {
        $errorMsg = "Cannot open browser.`n`n$($_.Exception.Message)"
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
})

# Start ngrok tunnel (same as: powershell -ExecutionPolicy Bypass -File ".\start-ngrok.ps1")
$btnStartNgrok.Add_Click({
    try {
        $root = $scriptRoot
        if (-not $root) { $root = (Get-Location).Path }
        $ngrokScript = Join-Path $root "start-ngrok.ps1"
        if (-not (Test-Path $ngrokScript)) {
            [System.Windows.Forms.MessageBox]::Show("start-ngrok.ps1 not found.`nPath: $ngrokScript", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
            return
        }
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "powershell.exe"
        $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$ngrokScript`""
        $psi.WorkingDirectory = $root
        $psi.UseShellExecute = $true
        $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal
        [System.Diagnostics.Process]::Start($psi) | Out-Null
    } catch {
        $errorMsg = "Cannot start ngrok.`n`n$($_.Exception.Message)"
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
})

# Open ngrok URL in browser
$btnNgrok.Add_Click({
    try {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $OutputEncoding = [System.Text.Encoding]::UTF8
        Start-Process $ngrokUrl
    } catch {
        $errorMsg = "Cannot open browser.`n`n$($_.Exception.Message)"
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
})

# Auto-update status with timer
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000  # 3초마다
$timer.Add_Tick({ Update-Status })
$timer.Start()

# Cleanup timer when form closes
$form.Add_FormClosing({
    $timer.Stop()
    $timer.Dispose()
    try {
        if ($mutex) {
            $mutex.ReleaseMutex()
            $mutex.Dispose()
        }
    } catch { }
})

# Initial status check
Update-Status

# Show form
try {
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $form.Add_Shown({
        try {
            $form.Activate()
            $form.BringToFront()
            $form.Focus()
            $form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
            $form.TopMost = $true
            $form.Show()
        } catch {
            $errorMsg = "Form display error: $($_.Exception.Message)"
            $logPath = Join-Path $PSScriptRoot "server-panel-error.log"
            try {
                $errorMsg | Out-File -FilePath $logPath -Encoding UTF8 -Append
            } catch { }
            try {
                [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            } catch { }
        }
    })
    [System.Windows.Forms.Application]::Run($form)
} catch {
    # Release mutex on error
    try {
        if ($mutex) {
            $mutex.ReleaseMutex()
            $mutex.Dispose()
        }
    } catch { }
    
    $errorMsg = "Error occurred while starting server control panel.`n`nError Type: $($_.Exception.GetType().FullName)`nError Message: $($_.Exception.Message)`n`nStack Trace:`n$($_.Exception.StackTrace)"
    $logPath = Join-Path $PSScriptRoot "server-panel-error.log"
    try {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "[$timestamp] $errorMsg" | Out-File -FilePath $logPath -Encoding UTF8 -Append
    } catch {
        # 로그 파일 쓰기 실패 시 무시
    }
    try {
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    } catch {
        # MessageBox도 실패하면 파일로 저장하고 창을 표시하여 사용자가 볼 수 있도록 함
        $logPath = Join-Path $PSScriptRoot "server-panel-error.log"
        try {
            $errorMsg | Out-File -FilePath $logPath -Encoding UTF8
        } catch { }
        # 오류 발생 시 창을 표시하여 사용자가 오류를 볼 수 있도록 함
        $host.UI.RawUI.WindowTitle = "Server Control Panel Error"
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host "`n오류 로그가 저장되었습니다: $logPath" -ForegroundColor Yellow
        Write-Host "`n아무 키나 누르면 종료됩니다..." -ForegroundColor Yellow
        $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    exit 1
}
