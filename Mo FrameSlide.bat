@echo off
chcp 65001 >nul
title FrameSlide - đừng tắt cửa sổ này khi đang dùng app
cd /d "%~dp0"

echo ============================================================
echo   Đang mở FrameSlide, đừng tắt cửa sổ này...
echo   (Tắt cửa sổ này là tắt luôn app. Có thể thu nhỏ nó xuống.)
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [LỖI] Máy chưa cài Node.js nên không mở được FrameSlide.
  echo Hãy cài Node.js bản LTS tại https://nodejs.org rồi bấm lại.
  pause
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo [Bỏ qua] Không thấy Git, mở bản đang có trên máy.
) else (
  echo [1/3] Đang lấy bản mới nhất từ GitHub...
  git pull --ff-only
  if errorlevel 1 echo [Bỏ qua] Không cập nhật được ^(mất mạng hoặc có sửa đổi riêng^). Vẫn mở bản đang có.
)
echo.

rem Chỉ chạy npm install khi chưa có thư viện hoặc package-lock.json mới hơn lần cài trước
powershell -NoProfile -Command "$m='node_modules\.package-lock.json'; if (-not (Test-Path $m) -or (Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item $m).LastWriteTime) { exit 1 } else { exit 0 }"
if errorlevel 1 (
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
echo.

echo [3/3] Đang chạy FrameSlide... Cửa sổ app sẽ hiện ra sau vài giây.
call npm run dev
if errorlevel 1 (
  echo.
  echo [LỖI] FrameSlide dừng do có lỗi. Chụp màn hình cửa sổ này gửi cho Claude.
  pause
)
