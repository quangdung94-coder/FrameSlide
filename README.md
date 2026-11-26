# FrameSlide

App Windows làm B-roll slideshow ảnh có film look xưa, xuất 1080p30 MP4 / ProRes / DNxHR (không tiếng) để chèn vào phim cưới, sự kiện, year end party.

## Trạng thái (26/11/2026)
- **Đã xong Bước 1 → 6** trong `docs/PLAN.md`: app đã đóng gói thành `FrameSlide.exe` và **chạy ổn định trên máy chính** của anh Dũng.
- Bản phát hành hiện tại: **v0.9.0** trên GitHub Release [`ban-moi-nhat`](https://github.com/quangdung94-coder/FrameSlide/releases/tag/ban-moi-nhat) (`FrameSlide-Setup-0.9.0.exe` và `FrameSlide-Portable-0.9.0.exe`, đã kèm FFmpeg).
- Việc còn lại trước v1.0: thử trên ít nhất 1 máy cấu hình yếu hơn, sửa lỗi nếu có.

## Tải & cài
1. Mở https://github.com/quangdung94-coder/FrameSlide/releases/tag/ban-moi-nhat
2. Tải `FrameSlide-Setup-0.9.0.exe` (khuyên dùng) hoặc bản Portable (chạy liền, không cần cài).
3. Bấm đúp file Setup. Nếu Windows báo "Windows protected your PC": **More info → Run anyway** → Install → Finish.
4. Mở app bằng biểu tượng FrameSlide trên Desktop. Cập nhật bản mới: cài đè, dự án và cài đặt vẫn giữ.

Chi tiết: [`docs/HUONG_DAN_CAI_DAT.md`](docs/HUONG_DAN_CAI_DAT.md).

## Các đợt đã phát hành
| Đợt | PR | Nội dung chính |
|---|---|---|
| Bước 1–5 | #3 | Engine WebGL2 16-bit, 20 chuyển cảnh, 12 Film Look, 7 Motion Template, xuất MP4 / ProRes / DNxHR |
| Bước 5b | #9–#16 | 8 góp ý giao diện: khay ảnh thumbnail, bố cục kéo giãn, chỉnh ảnh trên khung xem, nền scene nhiều ảnh… |
| Đợt 4 | #28–#34 | Refactor + S7/S8/S9/U9 |
| Đợt 5.1–5.4 | #35–#47 | 11 góp ý giao diện: thanh phát, dải scene lưới, In/Out, crop có lưới, bảng chữ kiểu Premiere/CapCut, nền mờ 5 kiểu… |
| Đợt 6 + Bước 6 | #48–#51 | Mở app không hiện cmd, Shift/Ctrl chọn nhiều scene để xóa, hộp Xuất chọn thư mục trước, đóng gói `.exe` (Setup + Portable) kèm FFmpeg |

## Cho người sửa code
Xem `CLAUDE.md` và thư mục `docs/` (bắt đầu từ `docs/PLAN.md`). Mỗi lần gộp vào `main`, GitHub Actions (`release.yml`) tự đóng gói, tự kiểm tra và cập nhật Release.
