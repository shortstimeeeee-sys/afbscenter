On Error Resume Next

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psScriptPath = scriptDir & "\server-control-panel.ps1"

If Not fso.FileExists(psScriptPath) Then
    MsgBox "server-control-panel.ps1 file not found.", vbCritical, "Error"
    WScript.Quit
End If

psScriptPathEscaped = Replace(Replace(psScriptPath, "\", "\\"), "'", "''")

psCommand = "powershell.exe -ExecutionPolicy Bypass -NoProfile -STA -WindowStyle Hidden -Command ""[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; $PSDefaultParameterValues['*:Encoding'] = 'utf8'; $env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8'; try { $content = [System.IO.File]::ReadAllText('" & psScriptPathEscaped & "', [System.Text.Encoding]::UTF8); Invoke-Expression $content } catch { [System.Windows.Forms.MessageBox]::Show('Error: ' + $_.Exception.Message, 'Control Panel Error', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) }"""

WshShell.Run psCommand, 0, False

Set WshShell = Nothing
Set fso = Nothing
