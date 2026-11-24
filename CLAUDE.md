# FrameSlide – Hướng dẫn dự án

App làm slideshow ảnh trên Windows, xuất video **B-roll không tiếng (1080p)** mang phong cách điện ảnh và film look xưa để chèn vào phim cưới, sự kiện, year end party (dựng trong DaVinci Resolve / Premiere).
App dùng cá nhân và chia sẻ bạn bè: **không thương mại hóa, không cài license key, không đăng nhập/mật khẩu**.

## Công nghệ cốt lõi
- **Desktop Shell:** Electron + Vite + TypeScript + `electron-builder`
- **UI:** React + Tailwind CSS + Zustand
- **Render Engine:** Three.js (WebGL2 `RGBA16F` Linear Pipeline + Custom GLSL Shaders), tách thành module thuần chạy độc lập được trên trình duyệt để test.
- **Xử lý ảnh:** `sharp` (tạo thumbnail & working proxy 2560–3200px, tự xoay EXIF).
- **Export:** WebCodecs `VideoEncoder` + `mp4-muxer` (MP4 H.264) và FFmpeg (ProRes 422 / DNxHR HQ, gắn color tags `bt709`).

## Lệnh phát triển
- `npm run dev` — Chạy app Electron ở chế độ phát triển
- `npm run dev:web` — Chạy riêng `src/engine` & UI trên trình duyệt thường (debug shader / Playwright nhanh)
- `npm run typecheck` — Kiểm tra kiểu TypeScript cho cả Node & Renderer/Engine
- `npm run test` — Chạy unit test (`vitest`)
- `npm run build` — Build sản phẩm (`out/main`, `out/preload`, `out/renderer`)
- `npm run package:dir` — Build & đóng gói thử bản Windows vào thư mục `release/`

## Quy tắc làm việc bắt buộc
1. **Giao tiếp bằng tiếng Việt.**
2. **Đọc tài liệu trước khi code:** Khi bắt đầu phiên mới, đọc `docs/PLAN.md` để biết việc tiếp theo cần làm, và kiểm tra `docs/DECISIONS.md` để không đề xuất lại những thứ đã bỏ.
3. **Làm từng việc nhỏ:** Mỗi lần chỉ hoàn thành một mục rõ ràng trong `PLAN.md`. Không tự ý mở rộng phạm vi ngoài `docs/SPEC.md`.
4. **Kiểm tra trước khi báo xong:** Chạy test/typecheck sau khi sửa code. Nếu liên quan đến hình ảnh/shader, xuất ảnh hoặc kiểm tra visual.
5. **Không tự ý thêm thư viện nặng** nếu chưa thảo luận và ghi vào `docs/DECISIONS.md`.
6. **Không thêm cơ chế bảo mật/thu phí:** Không viết code check key, DRM, telemetry, hay login.
7. **Deterministic Render:** Mọi hiệu ứng nhiễu/hạt/rung (grain, dust, weave, flicker) phải tính theo `frameIndex` cố định để preview và export khớp nhau 100%.

## Danh sách tài liệu trong `docs/`
- `docs/SPEC.md` — Mục tiêu, tính năng Bản 1 & Bản 2, phạm vi loại trừ, tiêu chí hoàn thành.
- `docs/ARCHITECTURE.md` — Kiến trúc Render Engine, WebGL2 Linear Pipeline, VRAM, Export.
- `docs/DECISIONS.md` — Các quyết định kỹ thuật & sản phẩm đã chốt kèm lý do.
- `docs/PLAN.md` — Lộ trình và checklist từng bước (Bước 1 → Bước 6).
- `docs/TEMPLATE_FORMAT.md` — Cấu trúc JSON cho Motion Template & Film Look (nháp v0.1, khóa sau Bước 3).
- `docs/EFFECTS.md` — Danh sách Transitions, Film Look, Text & tham số (nháp v0.1, khóa sau Bước 3).
- `docs/ASSETS.md` — Nguồn tài nguyên, font tiếng Việt, shader/LUT và ghi công.
