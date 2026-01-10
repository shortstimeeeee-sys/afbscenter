On Error Resume Next

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 현재 스크립트가 있는 폴더 경로
scriptFolder = fso.GetParentFolderName(WScript.ScriptFullName)

' server-control.ps1 파일 경로
psScriptPath = scriptFolder & "\server-control.ps1"

' 파일 존재 확인
If Not fso.FileExists(psScriptPath) Then
    MsgBox "server-control.ps1 파일을 찾을 수 없습니다." & vbCrLf & vbCrLf & "경로: " & psScriptPath, vbCritical, "오류"
    WScript.Quit
End If

' 작업 디렉토리 설정
WshShell.CurrentDirectory = scriptFolder

' PowerShell을 STA 모드로 실행 (GUI 애플리케이션에 필요)
' -WindowStyle Hidden: PowerShell 콘솔 창은 숨기고 GUI만 표시
' -STA: Single Threaded Apartment 모드 (GUI에 필수)
psCommand = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -STA -File """ & psScriptPath & """"

' 창을 표시하고 포커스를 주기 위해 0 사용 (Hidden 창)
' False = 비동기 실행 (바로 반환)
Dim result
result = WshShell.Run(psCommand, 0, False)

' 잠시 대기 (GUI가 표시될 시간을 줌)
WScript.Sleep 1000

' 오류 확인
If Err.Number <> 0 Then
    MsgBox "PowerShell 실행 중 오류가 발생했습니다." & vbCrLf & vbCrLf & "오류 번호: " & Err.Number & vbCrLf & "오류 설명: " & Err.Description & vbCrLf & vbCrLf & "명령: " & psCommand, vbCritical, "오류"
    WScript.Quit
End If

Set WshShell = Nothing
Set fso = Nothing

