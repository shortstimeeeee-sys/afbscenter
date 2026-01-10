# AFBS 센터 서버 제어판
# 작은 모달 창으로 서버를 제어할 수 있는 GUI

# 오류 처리 설정
$ErrorActionPreference = "Continue"

# 어셈블리 로드
try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
} catch {
    # 어셈블리 로드 실패 시 오류 메시지 표시
    $errorMsg = "필요한 .NET 어셈블리를 로드할 수 없습니다.`n`n오류: $($_.Exception.Message)"
    try {
        # MessageBox를 사용할 수 없으므로 콘솔에 출력
        Write-Host $errorMsg -ForegroundColor Red
        Read-Host "Press Enter to exit"
    } catch {
        # 콘솔도 실패하면 그냥 종료
    }
    exit 1
}

# 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8'

# 메인 폼 생성
$form = New-Object System.Windows.Forms.Form
$form.Text = "AFBS 센터 서버 제어판"
$form.Size = New-Object System.Drawing.Size(350, 280)
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true

# 제목 레이블
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "⚾ AFBS 센터 서버 관리"
$titleLabel.Font = New-Object System.Drawing.Font("맑은 고딕", 12, [System.Drawing.FontStyle]::Bold)
$titleLabel.AutoSize = $true
$titleLabel.Location = New-Object System.Drawing.Point(80, 15)
$form.Controls.Add($titleLabel)

# 상태 레이블
$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = "상태 확인 중..."
$statusLabel.AutoSize = $true
$statusLabel.Location = New-Object System.Drawing.Point(20, 50)
$statusLabel.Font = New-Object System.Drawing.Font("맑은 고딕", 9)
$form.Controls.Add($statusLabel)

# 상태 표시 레이블 (큰 글씨)
$statusDisplay = New-Object System.Windows.Forms.Label
$statusDisplay.Text = "●"
$statusDisplay.Font = New-Object System.Drawing.Font("맑은 고딕", 20)
$statusDisplay.AutoSize = $true
$statusDisplay.Location = New-Object System.Drawing.Point(20, 75)
$form.Controls.Add($statusDisplay)

# 서버 시작 버튼
$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "▶ 서버 시작"
$btnStart.Size = New-Object System.Drawing.Size(140, 40)
$btnStart.Location = New-Object System.Drawing.Point(20, 120)
$btnStart.Font = New-Object System.Drawing.Font("맑은 고딕", 10)
$btnStart.BackColor = [System.Drawing.Color]::FromArgb(46, 204, 113)
$btnStart.ForeColor = [System.Drawing.Color]::White
$btnStart.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnStart.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnStart)

# 서버 중지 버튼
$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text = "■ 서버 중지"
$btnStop.Size = New-Object System.Drawing.Size(140, 40)
$btnStop.Location = New-Object System.Drawing.Point(180, 120)
$btnStop.Font = New-Object System.Drawing.Font("맑은 고딕", 10)
$btnStop.BackColor = [System.Drawing.Color]::FromArgb(231, 76, 60)
$btnStop.ForeColor = [System.Drawing.Color]::White
$btnStop.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnStop.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnStop)

# 서버 재시작 버튼
$btnRestart = New-Object System.Windows.Forms.Button
$btnRestart.Text = "↻ 서버 재시작"
$btnRestart.Size = New-Object System.Drawing.Size(140, 40)
$btnRestart.Location = New-Object System.Drawing.Point(20, 170)
$btnRestart.Font = New-Object System.Drawing.Font("맑은 고딕", 10)
$btnRestart.BackColor = [System.Drawing.Color]::FromArgb(52, 152, 219)
$btnRestart.ForeColor = [System.Drawing.Color]::White
$btnRestart.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnRestart.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnRestart)

# 브라우저 열기 버튼
$btnBrowser = New-Object System.Windows.Forms.Button
$btnBrowser.Text = "🌐 브라우저 열기"
$btnBrowser.Size = New-Object System.Drawing.Size(140, 40)
$btnBrowser.Location = New-Object System.Drawing.Point(180, 170)
$btnBrowser.Font = New-Object System.Drawing.Font("맑은 고딕", 10)
$btnBrowser.BackColor = [System.Drawing.Color]::FromArgb(155, 89, 182)
$btnBrowser.ForeColor = [System.Drawing.Color]::White
$btnBrowser.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnBrowser.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnBrowser)

# Java 프로세스 확인 함수
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

# 상태 업데이트 함수
function Update-Status {
    try {
        $processes = Get-JavaProcess
        if ($processes) {
            $statusLabel.Text = "서버 실행 중 (PID: $($processes.Id))"
            $statusDisplay.Text = "●"
            $statusDisplay.ForeColor = [System.Drawing.Color]::Green
            $btnStart.Enabled = $false
            $btnStop.Enabled = $true
            $btnRestart.Enabled = $true
        } else {
            $statusLabel.Text = "서버 중지됨"
            $statusDisplay.Text = "○"
            $statusDisplay.ForeColor = [System.Drawing.Color]::Red
            $btnStart.Enabled = $true
            $btnStop.Enabled = $false
            $btnRestart.Enabled = $false
        }
    } catch {
        $statusLabel.Text = "상태 확인 오류"
        $statusDisplay.Text = "?"
        $statusDisplay.ForeColor = [System.Drawing.Color]::Orange
    }
}

# 서버 시작
$btnStart.Add_Click({
    try {
        $btnStart.Enabled = $false
        $statusLabel.Text = "서버 시작 중..."
        
        $scriptPath = $PSScriptRoot
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; `$env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; mvn spring-boot:run" -WindowStyle Normal
        
        Start-Sleep -Seconds 3
        Update-Status
    } catch {
        [System.Windows.Forms.MessageBox]::Show("서버 시작 중 오류가 발생했습니다.`n`n$($_.Exception.Message)", "오류", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        Update-Status
    }
})

# 서버 중지
$btnStop.Add_Click({
    try {
        $btnStop.Enabled = $false
        $statusLabel.Text = "서버 중지 중..."
        
        $processes = Get-JavaProcess
        if ($processes) {
            Stop-Process -Id $processes.Id -Force -ErrorAction SilentlyContinue
        }
        
        Start-Sleep -Seconds 2
        Update-Status
    } catch {
        [System.Windows.Forms.MessageBox]::Show("서버 중지 중 오류가 발생했습니다.`n`n$($_.Exception.Message)", "오류", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        Update-Status
    }
})

# 서버 재시작
$btnRestart.Add_Click({
    try {
        $btnRestart.Enabled = $false
        $statusLabel.Text = "서버 재시작 중..."
        
        # 중지
        $processes = Get-JavaProcess
        if ($processes) {
            Stop-Process -Id $processes.Id -Force -ErrorAction SilentlyContinue
        }
        
        Start-Sleep -Seconds 2
        
        # 시작
        $scriptPath = $PSScriptRoot
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; `$env:JAVA_TOOL_OPTIONS='-Dfile.encoding=UTF-8'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; mvn spring-boot:run" -WindowStyle Normal
        
        Start-Sleep -Seconds 3
        Update-Status
    } catch {
        [System.Windows.Forms.MessageBox]::Show("서버 재시작 중 오류가 발생했습니다.`n`n$($_.Exception.Message)", "오류", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        Update-Status
    }
})

# 브라우저 열기
$btnBrowser.Add_Click({
    try {
        Start-Process "http://localhost:8080"
    } catch {
        [System.Windows.Forms.MessageBox]::Show("브라우저를 열 수 없습니다.`n`n$($_.Exception.Message)", "오류", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
})

# 타이머로 상태 자동 업데이트
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000  # 3초마다
$timer.Add_Tick({ Update-Status })
$timer.Start()

# 폼 닫을 때 타이머 정리
$form.Add_FormClosing({
    $timer.Stop()
    $timer.Dispose()
})

# 초기 상태 확인 (오류 발생 시에도 계속 진행)
try {
    Update-Status
} catch {
    $statusLabel.Text = "상태 확인 중..."
}

# 폼 표시
try {
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $form.Add_Shown({
        try {
            $form.Activate()
            $form.BringToFront()
            $form.Focus()
            $form.WindowState = [System.Windows.Forms.FormWindowState]::Normal
            $form.TopMost = $true
        } catch {
            # Shown 이벤트 오류 무시
        }
    })
    [System.Windows.Forms.Application]::Run($form)
} catch {
    $errorMsg = "서버 제어판을 시작하는 중 오류가 발생했습니다.`n`n오류: $($_.Exception.Message)"
    try {
        [System.Windows.Forms.MessageBox]::Show($errorMsg, "오류", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    } catch {
        Write-Host $errorMsg -ForegroundColor Red
        Read-Host "Press Enter to exit"
    }
}
