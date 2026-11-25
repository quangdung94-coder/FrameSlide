' Mở FrameSlide KHÔNG hiện cửa sổ đen. Bấm đúp file này để dùng hằng ngày.
' Khi có bản mới cần cài/build lại, cửa sổ tiến trình hiện ra rồi tự đóng khi app mở.
' App lỗi không mở được: bấm "Mo FrameSlide.bat" để thấy thông báo lỗi.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = folder
bat = folder & "\Mo FrameSlide.bat"
rc = sh.Run("cmd /c """"" & bat & """ auto""", 0, True)
If rc = 0 Then
  exeName = "electron.exe"
  pathTxt = folder & "\node_modules\electron\path.txt"
  If fso.FileExists(pathTxt) Then
    Set f = fso.OpenTextFile(pathTxt, 1)
    If Not f.AtEndOfStream Then exeName = Trim(f.ReadLine)
    f.Close
  End If
  exe = folder & "\node_modules\electron\dist\" & exeName
  If fso.FileExists(exe) Then
    sh.Run """" & exe & """ """ & folder & """", 1, False
    WScript.Quit 0
  End If
End If
' Cần cài thư viện / build lại (hoặc có lỗi): mở cửa sổ tiến trình.
sh.Run "cmd /c """"" & bat & """""", 1, False
