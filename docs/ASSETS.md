# ASSETS – nguồn và giấy phép tài nguyên

**Quy tắc:** mọi shader, font, LUT, texture, thư viện đưa vào repo hoặc đóng gói vào app phải có một dòng ở đây **trước khi merge**. Không rõ giấy phép thì không dùng. Reviewer từ chối PR thiếu dòng này.

Trạng thái: `dự kiến` = chưa đưa vào repo · `đã dùng` = có trong repo, đã kiểm giấy phép.

## 1. Thư viện

| Tên | Dùng để | Giấy phép | Trạng thái |
|---|---|---|---|
| Electron | vỏ app | MIT | dự kiến |
| Three.js | dựng hình WebGL | MIT | dự kiến |
| React, React DOM | giao diện | MIT | dự kiến |
| zod | kiểm tra JSON | MIT | dự kiến |
| sharp (libvips) | đọc/thu nhỏ ảnh | Apache-2.0 (libvips LGPL-3.0) | dự kiến |
| ffmpeg-static | mã hóa video | GPL-3.0 (binary FFmpeg build GPL, có libx264) | dự kiến – xem DECISIONS D17 trước khi phát hành |
| gl-transitions | nguồn shader transition | MIT (một số file BSD) – kiểm từng file | dự kiến |

## 2. Transition (GL Transitions)

Ghi **từng file** khi port: tên file gốc, tác giả (dòng `// Author:` trong file), giấy phép (dòng `// License:`), phiên bản package.

| id trong app | File gốc | Tác giả | Giấy phép | Phiên bản package |
|---|---|---|---|---|
| | | | | |

## 3. Font (OFL, có dấu tiếng Việt)

Tải từ Google Fonts hoặc repo gốc, kèm file `OFL.txt` trong `assets/fonts/<font>/`. Kiểm hiển thị đủ dấu trước khi ghi "đã dùng".

| Font | Nguồn | Giấy phép | Có dấu tiếng Việt | Trạng thái |
|---|---|---|---|---|
| Be Vietnam Pro | Google Fonts | SIL OFL 1.1 | có (thiết kế cho tiếng Việt) | dự kiến |
| Playfair Display | Google Fonts | SIL OFL 1.1 | cần xác minh | dự kiến |
| Lora | Google Fonts | SIL OFL 1.1 | cần xác minh | dự kiến |
| Dancing Script | Google Fonts | SIL OFL 1.1 | cần xác minh | dự kiến |

Nếu font nào thiếu dấu, thay bằng font OFL khác có tiếng Việt và ghi lý do.

## 4. LUT, texture, overlay

MVP **không dùng** video overlay hay texture ngoài (DECISIONS D10). Mọi grain, bụi, xước, light leak làm bằng shader trong repo. LUT nếu có là tự tạo trong repo.

| Tên | Nguồn | Giấy phép | Trạng thái |
|---|---|---|---|
| (chưa có) | | | |

## 5. Không được dùng

- Template, video, ảnh, âm thanh tải từ Motion Array / Envato để đóng gói vào app (giấy phép chỉ cho dùng trong video của người tải).
- LUT hay preset trích từ DaVinci Resolve, Red Giant Retrograde hay phần mềm thương mại khác.
- Tên thương hiệu phim làm tên look.
