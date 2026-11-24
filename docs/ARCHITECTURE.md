# Kiến trúc kỹ thuật (ARCHITECTURE) – FrameSlide

## 1. Tổng quan cấu trúc
Ứng dụng được chia thành **3 lớp tách biệt rõ ràng** để dễ phát triển, debug và kiểm thử tự động:

```text
src/
├── engine/          # Render Engine thuần (TypeScript + Three.js + GLSL), KHÔNG phụ thuộc Electron/Node
├── renderer/        # Giao diện React + Tailwind + Zustand (Timeline, Preview, Controls)
├── main/            # Electron Main Process (File I/O, Sharp Proxy Worker, FFmpeg Export, IPC)
└── shared/          # Kiểu dữ liệu dùng chung (Project schema, Template schema, IPC contracts)
```

> **Nguyên tắc vàng:** `src/engine/` phải chạy độc lập được cả trong Electron lẫn trên trình duyệt thường (qua Vite) để phục vụ test tự động (visual regression test) và debug shader nhanh.

---

## 2. Pipeline dựng hình (WebGL2 Linear Pipeline)

Mỗi khung hình tại thời điểm `t` (tính bằng `frameIndex / fps`) đi qua chuỗi render sau:

1. **Pass 1 – Scene & Camera 2.5D (`RGBA16F` Linear):**
   - Dựng các lớp ảnh (2D/2.5D plane, khung Polaroid, dải Filmstrip) trong không gian 3D với camera chuyển động (Ken Burns, parallax Z).
   - Ảnh đầu vào (sRGB) được chuyển sang Linear space khi lấy mẫu (`SRGBColorSpace` texture).
   - Áp dụng Transition shader giữa Slide `i` và Slide `i+1` nếu `t` nằm trong vùng chuyển cảnh.
   - Vẽ Text / Date Stamp overlay (Canvas2D texture nét cao, hỗ trợ font tiếng Việt).

2. **Pass 2 – Optical Effects (`RGBA16F` Linear):**
   - **Halation:** Tách vùng sáng cao → blur kênh đỏ/cam → cộng nhẹ lại (Add) vào ảnh gốc.
   - **Bloom:** Tỏa sáng mềm quanh vùng highlight.
   - **Lens Softness & Chromatic Aberration:** Làm mềm nhẹ và lệch sắc ở rìa khung.

3. **Pass 3 – Film Look & Color Grading (`RGBA16F` → `sRGB 8-bit`):**
   - **3D LUT:** Áp dụng LUT nội bộ của preset hoặc file `.cube` do người dùng nạp vào (nội suy trilinear trên GPU).
   - **Tone & Fade:** Chỉnh contrast, lift/gamma/gain, fade vùng đen.
   - **Procedural Grain, Dust, Scratches, Gate Weave, Flicker, Light Leak:** Tất cả tính bằng GLSL shader sử dụng **Deterministic PRNG theo `frameIndex`** (xem Mục 3).
   - **Viền khung & Vignette:** Bo góc Super 8, lỗ răng cưa (sprocket), khung Polaroid.
   - **Dithering:** Thêm nhiễu tam giác (triangular dither) 1-LSB trước khi lượng tử hóa về 8-bit để triệt tiêu hoàn toàn hiện tượng sọc màu (banding) ở vùng light leak.

---

## 3. Deterministic Render (Khớp 100% Preview & Export)
- Không dùng `Math.random()` hay `Date.now()` trong bất kỳ hiệu ứng nào.
- Mọi chuyển động rung (gate weave), nhấp nháy (flicker), hạt phim (grain), bụi/xước đều nhận đầu vào là `uFrameIndex` (số nguyên) hoặc `uTime = frameIndex / fps`.
- Nhờ vậy, khi người dùng dừng playhead ở frame thứ 120 để xem thử và khi xuất video ở frame thứ 120, kết quả giống hệt nhau từng pixel.

---

## 4. Quản lý Ảnh, Proxy & VRAM

### 4.1. Luồng nhập ảnh (Background Worker với `sharp`)
Khi người dùng kéo thả 100–500 ảnh vào app:
1. Main process tạo thư mục cache cho dự án (ví dụ `%AppData%/FrameSlide/cache/<projectId>/`).
2. `sharp` chạy đa luồng tạo nhanh 2 phiên bản (ảnh gốc giữ nguyên):
   - **Thumbnail:** chiều rộng `320px` (JPEG q80) → hiển thị ngay trên danh sách slide.
   - **Working Proxy:** cạnh dài tối đa `2880px` (đủ cho zoom Ken Burns 1.5x ở 1080p mà không vỡ nét), tự động xoay đúng chiều theo EXIF (`sharp().rotate()`).

### 4.2. Sliding Window VRAM trên GPU
- Một ảnh 2880×1920 giải nén trên GPU tốn ~22MB VRAM.
- Engine chỉ giữ **tối đa 4–5 texture** quanh vị trí playhead hiện tại (`slide[i-1]`, `slide[i]`, `slide[i+1]`, `slide[i+2]`).
- Texture của slide đã đi qua được giải phóng ngay (`texture.dispose()`), và slide sắp tới được giải mã trước (`createImageBitmap`) trên worker thread → VRAM luôn ổn định dưới **~300–400MB**, không bao giờ tràn dù dự án có 500 ảnh.

---

## 5. Luồng Export Video (Tốc độ cao & Chuẩn màu)

Tách làm 2 nhánh tối ưu theo định dạng:

1. **Nhánh MP4 (H.264) – Dùng WebCodecs `VideoEncoder` + `mp4-muxer`:**
   - Tạo `VideoFrame(canvas, { timestamp })` trực tiếp từ WebGL canvas trên GPU (không cần `gl.readPixels` về CPU, tận dụng phần cứng NVENC/QuickSync/AMF qua Chromium).
   - `mp4-muxer` đóng gói thành file `.mp4` chuẩn Rec.709 (`bt709`), không cần spawn tiến trình ngoài, tốc độ nhanh gấp nhiều lần so với pipe qua IPC.

2. **Nhánh ProRes 422 / DNxHR HQ (.mov) – Dùng WebGL2 PBO + FFmpeg:**
   - Đọc pixel bất đồng bộ bằng WebGL2 Pixel Buffer Object (PBO) để giảm stall GPU.
   - Đẩy raw frame vào `ffmpeg` với tham số gắn color metadata chuẩn cho DaVinci Resolve:
     ```text
     -colorspace bt709 -color_primaries bt709 -color_trc bt709
     ```
   - Hỗ trợ xuất hàng loạt (Batch Export) theo hàng đợi (Export Queue), có nút Hủy và thanh tiến trình chính xác theo từng frame.

---

## 6. Định dạng File Dự án (`.frameslide`)
- Là file JSON gọn nhẹ lưu: danh sách ảnh (đường dẫn gốc + hash + đường dẫn proxy), thứ tự slide, thiết lập ảnh dọc (chế độ + focal point), Motion Template đang chọn, Film Look + thông số thanh trượt + đường dẫn `.cube` LUT (nếu có), thiết lập Export (FPS, Codec, thời lượng).
- Tự động lưu (Autosave) bản nháp định kỳ vào thư mục cache để phục hồi nếu mất điện hoặc driver GPU reset.
