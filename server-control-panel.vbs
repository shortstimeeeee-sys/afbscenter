On Error Resume Next

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 현재 스크립트가 있는 디렉토리 찾기
If WScript.ScriptFullName <> "" Then
    scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
Else
    ' 바로가기에서 실행된 경우 작업 디렉토리 사용
    scriptDir = WshShell.CurrentDirectory
End If

' 영어 파일명 사용
psScriptPath = scriptDir & "\server-control-panel.ps1"

' 파일 존재 확인
If Not fso.FileExists(psScriptPath) Then
    MsgBox "server-control-panel.ps1 파일을 찾을 수 없습니다." & vbCrLf & vbCrLf & "경로: " & psScriptPath, vbCritical, "오류"
    WScript.Quit
End If

' 작업 디렉토리를 스크립트 디렉토리로 설정
WshShell.CurrentDirectory = scriptDir

' PowerShell을 STA 모드로 실행 (GUI 애플리케이션에 필요)
' -WindowStyle Hidden: PowerShell 콘솔 창은 숨기고 GUI만 표시
' -STA: Single Threaded Apartment 모드 (GUI에 필수)
' -NoProfile: 프로필 로드 생략으로 빠른 실행
Dim psCommand
psCommand = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -STA -File """ & psScriptPath & """"

' 창을 표시하고 포커스를 주기 위해 0 사용 (Hidden 창)
' False = 비동기 실행 (바로 반환)
WshShell.Run psCommand, 0, False

' 잠시 대기 (GUI가 표시될 시간을 줌)
WScript.Sleep 500

' 오류 확인
If Err.Number <> 0 Then
    MsgBox "PowerShell 실행 중 오류가 발생했습니다." & vbCrLf & vbCrLf & "오류 번호: " & Err.Number & vbCrLf & "오류 설명: " & Err.Description, vbCritical, "오류"
End If

Set WshShell = Nothing
Set fso = Nothing
