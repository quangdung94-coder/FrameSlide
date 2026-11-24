' Mở FrameSlide mà KHÔNG hiện cửa sổ đen (console).
' Lưu ý: muốn tắt hẳn thì đóng cửa sổ FrameSlide; nếu app treo, dùng "Mo FrameSlide.bat" để thấy lỗi.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = folder
sh.Run "cmd /c """ & folder & "\Mo FrameSlide.bat""", 0, False
