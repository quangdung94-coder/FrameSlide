@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem ------------------------------------------------------------------------------------------
rem  Mở FrameSlide bằng BẢN ĐÃ BUILD (không chạy chế độ phát triển nên mở nhanh, không cần
rem  giữ cửa sổ này). Chỉ cài thư viện / build lại khi có bản mới từ GitHub.
rem  "Mo FrameSlide.bat auto": file .vbs chạy ẩn để kiểm tra. Thoát mã 0 = sẵn sàng (file .vbs
rem  tự mở app), mã 10 = cần cài/build (file .vbs mở cửa sổ này để anh thấy tiến trình).
rem ------------------------------------------------------------------------------------------
set "MODE=%~1"
title FrameSlide - đang chuẩn bị mở app

where node >nul 2>nul
if errorlevel 1 (
  if /i "%MODE%"=="auto" exit /b 10
  echo [LỖI] Máy chưa cài Node.js nên không mở được FrameSlide.
  echo Hãy cài Node.js bản LTS tại https://nodejs.org rồi bấm lại.
  pause
  exit /b 1
)

rem 1) Lấy bản mới nhất (bỏ qua nếu không có Git hoặc mất mạng)
set "HAS_GIT=0"
where git >nul 2>nul
if not errorlevel 1 if exist ".git" set "HAS_GIT=1"
if "%HAS_GIT%"=="1" (
  if /i not "%MODE%"=="auto" echo [1/3] Đang lấy bản mới nhất từ GitHub...
  git pull --ff-only >nul 2>nul
)

rem 2) Có cần cài thư viện không? (chưa có thư viện, hoặc package-lock.json mới hơn lần cài trước)
set "NEED_INSTALL=0"
powershell -NoProfile -Command "$m='node_modules\.package-lock.json'; if (-not (Test-Path $m) -or (Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item $m).LastWriteTime) { exit 1 } else { exit 0 }"
if errorlevel 1 set "NEED_INSTALL=1"
if not exist "node_modules\electron\path.txt" set "NEED_INSTALL=1"

rem 3) Có cần build lại không? (chưa có bản build, hoặc bản build là của commit cũ)
set "NEED_BUILD=0"
set "HEAD="
if "%HAS_GIT%"=="1" for /f %%h in ('git rev-parse HEAD 2^>nul') do set "HEAD=%%h"
set "BUILT="
if exist "out\.build-commit" set /p BUILT=<"out\.build-commit"
if not exist "out\main\index.js" set "NEED_BUILD=1"
if not exist "out\renderer\index.html" set "NEED_BUILD=1"
if defined HEAD if not "%HEAD%"=="%BUILT%" set "NEED_BUILD=1"
if "%NEED_INSTALL%"=="1" set "NEED_BUILD=1"

if /i "%MODE%"=="auto" (
  if "%NEED_BUILD%"=="1" exit /b 10
  if not exist "node_modules\electron\dist" exit /b 10
  exit /b 0
)

echo ============================================================
echo   Đang chuẩn bị FrameSlide. Cửa sổ này tự đóng khi app mở.
echo ============================================================
echo.

if "%NEED_INSTALL%"=="1" (
  echo [2/3] Đang cài thư viện cho app, lần đầu có thể mất vài phút...
  call npm install
  if errorlevel 1 (
    echo [LỖI] Cài thư viện không thành công. Chụp màn hình cửa sổ này gửi cho Claude.
    pause
    exit /b 1
  )
) else (
  echo [2/3] Thư viện đã đủ, không cần cài lại.
)

if "%NEED_BUILD%"=="1" (
  echo [3/3] Có bản mới, đang build lại app, khoảng 10 - 30 giây...
  call npm run build
  if errorlevel 1 (
    echo [LỖI] Build không thành công. Chụp màn hình cửa sổ này gửi cho Claude.
    pause
    exit /b 1
  )
  if defined HEAD (>"out\.build-commit" echo %HEAD%)
) else (
  echo [3/3] Bản build đã mới nhất.
)

:launch
set "ELECTRON_EXE="
if exist "node_modules\electron\path.txt" set /p ELECTRON_EXE=<"node_modules\electron\path.txt"
if not defined ELECTRON_EXE set "ELECTRON_EXE=electron.exe"
if not exist "node_modules\electron\dist\%ELECTRON_EXE%" (
  echo [LỖI] Không thấy Electron trong node_modules. Xóa thư mục node_modules rồi bấm lại.
  pause
  exit /b 1
)
rem Electron là app cửa sổ: "start" mở nó rồi cửa sổ cmd này đóng ngay.
start "" "node_modules\electron\dist\%ELECTRON_EXE%" .
exit /b 0
