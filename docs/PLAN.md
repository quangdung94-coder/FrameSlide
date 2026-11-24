# Kế hoạch triển khai (PLAN) – FrameSlide

> **Quy tắc cập nhật:** Sau mỗi đầu việc hoàn thành và vượt qua kiểm tra/test, đánh dấu `[x]` vào mục tương ứng.

---

## Bước 1: Hoàn thiện tài liệu kiến trúc & kế hoạch
- [x] Chốt phạm vi & các quyết định kỹ thuật (`DECISIONS.md`)
- [x] Viết `CLAUDE.md` ở thư mục gốc
- [x] Viết `docs/SPEC.md`
- [x] Viết `docs/ARCHITECTURE.md`
- [x] Viết `docs/PLAN.md`
- [x] Viết bản nháp v0.1 cho `docs/TEMPLATE_FORMAT.md`, `docs/EFFECTS.md`, `docs/ASSETS.md`

---

## Bước 2: Dựng khung dự án (Skeleton)
- [x] Khởi tạo dự án Electron + Vite + TypeScript + React + Tailwind + Zustand
- [x] Cấu hình thư mục `src/engine`, `src/renderer`, `src/main`, `src/shared`
- [x] Tích hợp Three.js vào `src/engine` (mở được canvas WebGL2 `RGBA16F` trống)
- [x] Thiết lập test runner (`vitest`) và script kiểm tra kiểu (`tsc --noEmit`)
- [x] Cấu hình GitHub Actions tự động build kiểm tra trên Windows khi push code

---

## Bước 3: Bản mẫu Engine (Prototype – Điểm duyệt quan trọng)
- [x] Nạp thử 3 ảnh (gồm cả ảnh ngang & ảnh dọc) qua `sharp` proxy
- [x] Dựng Motion cơ bản: Ken Burns + 1 Transition (Film Dissolve / Light Leak)
- [x] Dựng Film Look mẫu: **Super 8** (LUT/màu + Halation + Grain + Gate Weave + Viền bo + Dithering)
- [x] Export thử clip 15 giây (1080p, 24fps & 30fps) ra MP4 (WebCodecs), ProRes 422 & DNxHR HQ (FFmpeg `bt709`)
- [x] **Đo KPI & Review kỹ thuật:** Đã kiểm tra, sửa lỗi ma trận màu `bt709`, white-point filmic, FBO readback, và xác nhận ổn định
- [x] Khóa schema chính thức trong `docs/TEMPLATE_FORMAT.md` và `docs/EFFECTS.md`

---

## Bước 4: Tính năng cốt lõi Bản 1
- [x] **Quản lý ảnh:** Kéo thả thư mục, EXIF rotate, sắp xếp theo ngày/tên, `sharp` proxy queue, Sliding Window VRAM
- [x] **Xử lý ảnh dọc (Portrait):** Smart Pairing (ghép đôi 2 ảnh dọc), Matte/Framed, Safe Top-Third Crop + click đặt Focal Point
- [x] **Giao diện chỉnh sửa kiểu ProShow:** Danh sách slide kéo thả, chỉnh thời lượng từng slide, chế độ tổng thời lượng cố định (10/15/20/30s) & Handles
- [x] **Quick Create:** Nút tạo nhanh 1 chạm từ thư mục ảnh + phong cách
- [x] **Import `.cube` LUT:** Đọc và biên dịch file `.cube` 3D LUT (17x17x17, 33x33x33) lên GPU
- [x] **Chữ (Text):** 5 kiểu tối giản + Date Stamp 90s, hỗ trợ đầy đủ font tiếng Việt
- [x] **Xem trước & Quản lý dự án:** Chế độ Auto / Half / Full, Lưu/Mở `.frameslide`, Autosave, Undo/Redo (`Ctrl+Z`/`Ctrl+Y`)
- [x] **Batch Export:** Hàng đợi xuất nhiều clip B-roll liên tiếp từ một thư mục ảnh lớn

---

## Bước 5: Thư viện Transitions, Film Look, 3D Motion Templates & Nâng cấp UX/UI
- [x] Nâng cấp giao diện **Scene Track + Photo Slots + Khay Ảnh** (thấy rõ tổng số Scene, bỏ ảnh vào từng ô 1/2/3/4 ảnh, Auto-Fill, kéo-thả đổi vị trí thẻ Scene, nhân bản Scene, chế độ Gọn, lọc "Chưa dùng" & thu gọn Khay ảnh)
- [x] Hoàn thiện **20 Transitions** điện ảnh/editorial & 3D (gồm 4 chuyển cảnh **3D Phối cảnh**: `3D Card Flip`, `3D Cube Turn`, `3D Dolly Fly-Through`, `3D Page Turn`) + **Popover chọn trực tiếp** theo 5 nhóm & nút Trộn chuyển cảnh ngẫu nhiên
- [x] Hoàn thiện **12 Film Look presets** + chế độ **Clean (0%)** + thanh trượt chỉnh từng thành phần (kèm VHS scanline/chroma bleed, Sprocket holes, **Bokeh / Bụi sáng**, **Bụi & Xước phim**, **Lóe sáng nền**, **Khung Letterbox 2.39:1 / 2.00:1 / 4:3**)
- [x] Hoàn thiện **7 Motion Templates** (5 mẫu 2D/2.5D + 2 mẫu 3D phối cảnh thật: `3D Floating Gallery`, `3D Photo Wall Depth`)
- [x] Bổ sung bộ tùy chọn dựng phim thực chiến: `Motion Intensity`, `Transition Duration`, Hướng chuyển động & Chú thích riêng từng Scene, Tự lấy ngày chụp EXIF, Xoay 90° & Exposure từng ảnh, Kiểu nền & Viền khung, Preset cá nhân (`My Presets`), Tỷ lệ xuất (`16:9 / 9:16 / 1:1`), Video Fade In/Out, nút Mở thư mục sau khi xuất
- [x] Bổ sung trải nghiệm UX/UI Pro: Vạch chia Scene & Handles trên thanh tua, So sánh Trước/Sau & Chia đôi (Before/After Split, phím `\`), Phóng to Preview (`F`), Empty State trực quan & Bảng phím tắt (`?`)
- [x] Rà soát & sửa 10 lỗi Bước 4–5 (VRAM cache 4-slot, GPU context restore, Whip Pan seam, Focal Point đa ô, `.cube` domain, Batch Export options, proxy rehydration, `sharp` asarUnpack); 26/26 unit tests pass

---

## Bước 6: Đóng gói & Thử nghiệm thực tế
- [ ] Cấu hình `electron-builder` tạo bộ cài `.exe` (NSIS) kèm sẵn FFmpeg binary
- [ ] Thêm kiểm tra GPU/Driver lần đầu mở app & cảnh báo thân thiện
- [ ] Thử nghiệm trên máy chính và ít nhất 1 máy cấu hình yếu hơn
- [ ] Sửa lỗi phát sinh và phát hành bản v1.0 dùng thực tế

---

## Bước 5b: Góp ý giao diện của anh Dũng (24/11/2026)
> Mỗi mục một PR nhỏ; typecheck + test + build + CI Windows phải đạt trước khi gộp. Không làm đóng gói .exe ở đây. Giữ nguyên nguyên tắc D19: mọi tính năng là tùy chọn bật/tắt, film look bật sẵn.

- [x] 1. **Khay ảnh:** thumbnail thật, nhóm theo thư mục mẹ/con kiểu Explorer (mở/thu được), chỉ tải thumbnail phần đang thấy (500 ảnh vẫn mượt). (Thumbnail 320px do sharp tạo sẵn; khay chỉ dựng phần đang thấy + `loading="lazy"`; mỗi thư mục có nút "+ Thêm".)
- [x] 2. **Khung xem giữa:** bỏ dòng "1920x1080 • 30fps" đè lên hình, chuyển xuống thanh trạng thái.
- [x] 3. **Bố cục kéo giãn:** khay ảnh, khung xem, timeline, bảng phải kéo giãn bằng thanh chia, lưu bố cục, nút đặt lại. Thẻ scene ở timeline to hơn, có thanh zoom. (Lưu trong localStorage của máy, không vào file dự án; nút "⟲ Bố cục" trên thanh trên cùng; bấm đúp thanh chia để về mặc định.)
- [x] 4. **Bấm scene / vị trí trên timeline:** playhead nhảy tới đó, khung giữa hiện scene đó. (Bấm thẻ scene → đầu scene; bấm/kéo thanh thời gian dưới mỗi thẻ → đúng vị trí trong scene, có vạch playhead.)
- [ ] 5. **Chỉnh ảnh trực tiếp trên khung giữa:** kéo đổi position, scale, rotation; tay nắm + ô số; nút đặt lại.
- [x] 6. **Nền sau scene 2–4 ảnh:** nền trơn, gradient (nhiều mẫu, chỉnh màu và góc), ảnh mờ, họa tiết; áp cho một scene hoặc cả dự án. (8 mẫu gradient; 4 họa tiết chấm bi/sọc chéo/kẻ ô/quả trám; họa tiết tĩnh nên preview và export khớp nhau; cấu hình trong `src/engine/background.ts`.)
- [x] 7. **Thẻ scene nhiều ảnh:** ô nhỏ đúng kiểu chia khung (2 ảnh cạnh nhau, 4 ảnh lưới 2x2), số thứ tự, kéo thả đổi chỗ. (Khung mini theo đúng tỉ lệ xuất và vị trí ô thật trong shader — `src/engine/layoutGeometry.ts`.)
- [x] 8. **Nhập thư mục:** không tự thêm tất cả ảnh vào timeline; ảnh chỉ vào khay; thêm nút "Thêm ảnh đã chọn" và "Thêm cả thư mục". (Ảnh mẫu vẫn tự dựng timeline để thử nhanh; "Thêm cả thư mục" = mọi ảnh chưa dùng trong khay, sẽ tách theo từng thư mục ở mục 1.)
