# Hướng dẫn cài & chạy FrameSlide trên Windows

## Tải về
Vào trang **Releases** của repo: https://github.com/quangdung94-coder/FrameSlide/releases , mở bản **"FrameSlide (bản mới nhất)"** và tải một trong hai file:

| File | Dùng khi nào |
|---|---|
| `FrameSlide-Setup-x.y.z.exe` | **Khuyên dùng.** Cài một lần, có biểu tượng trên Desktop và Start Menu, mở nhanh nhất. |
| `FrameSlide-Portable-x.y.z.exe` | Không muốn cài. Bấm đúp là chạy (mỗi lần mở chậm hơn vài giây vì phải giải nén). Chép được qua USB cho bạn bè. |

Không cần cài Node.js hay FFmpeg. FFmpeg (để xuất ProRes / DNxHR) có sẵn trong app.

## Cài đặt (bản Setup)
1. Bấm đúp `FrameSlide-Setup-x.y.z.exe`.
2. Nếu Windows hiện **"Windows protected your PC"** (do file không ký số): bấm **More info** → **Run anyway**.
3. Chọn thư mục cài (để mặc định cũng được) → **Install** → **Finish**.
4. Mở app bằng biểu tượng **FrameSlide** trên Desktop. Không có cửa sổ cmd nào hiện ra.

## Cập nhật bản mới
Tải file Setup mới và cài đè lên bản cũ. Dự án, bố cục và cài đặt vẫn giữ nguyên.

## Gỡ cài đặt
Settings → Apps → FrameSlide → Uninstall. Thư mục cache ảnh và dự án anh lưu không bị xóa.

## Lần đầu mở app
- Thanh dưới cùng hiện **WebGL2: OK**, **RGBA16F: OK**, **FFmpeg: OK** là máy đủ điều kiện.
- Nếu máy yếu hoặc driver cũ, app hiện một khung cảnh báo nói rõ cần làm gì (thường là cập nhật driver card màn hình). Bấm **Đã hiểu** để ẩn.

## Xuất video
Bấm **Xuất video** (Ctrl+E). Ở mục **Lưu vào** chọn thư mục một lần (app nhớ cho lần sau), đặt tên file nếu muốn, chọn định dạng rồi bấm **Xuất**. Trùng tên file thì app tự thêm `_2`, không ghi đè.

## Dành cho người sửa code
- `npm run package:win` đóng gói trên máy Windows (cần tự đặt `ffmpeg.exe` vào `vendor/ffmpeg/` nếu muốn kèm FFmpeg).
- Bình thường không cần: mỗi lần gộp vào `main`, GitHub Actions (`release.yml`) tự đóng gói, tự kiểm tra và cập nhật Release.
- `Mo FrameSlide.bat` vẫn dùng được để chạy thẳng từ mã nguồn.
