# EFFECTS – transition, chuyển động, film look, chữ

Mức nặng ở 1080p: **Nhẹ** (chạy tốt cả iGPU), **Vừa** (cần card tầm trung để mượt khi xem trước), **Nặng**.

## 1. Transition (MVP: 10 cái từ GL Transitions)

Nguồn: thư viện GL Transitions (gl-transitions.com, package npm `gl-transitions`), phần lớn giấy phép MIT. **Khi port, coder phải mở đúng file `.glsl` trong package, ghi tên file, tác giả và giấy phép thật vào `docs/ASSETS.md`.** Nếu một tên dưới đây không có trong package thì chọn cái gần nhất cùng nhóm và ghi lại.

| id trong app | File GL Transitions (dự kiến) | Nhóm | Thời lượng mặc định | Nặng |
|---|---|---|---|---|
| `fade` | fade.glsl | mềm | 1.0s | Nhẹ |
| `fadecolor` | fadecolor.glsl | mềm (qua đen/trắng kem) | 0.8s | Nhẹ |
| `fadegrayscale` | fadegrayscale.glsl | mềm, kỷ niệm | 1.2s | Nhẹ |
| `dreamy` | Dreamy.glsl | mềm, kỷ niệm | 1.2s | Nhẹ |
| `dreamyzoom` | DreamyZoom.glsl | mềm | 1.2s | Nhẹ |
| `crosszoom` | crosszoom.glsl | năng động | 0.8s | Vừa |
| `linearblur` | LinearBlur.glsl | mềm | 0.8s | Vừa |
| `directionalwarp` | directionalwarp.glsl | năng động | 0.7s | Nhẹ |
| `simplezoom` | SimpleZoom.glsl | năng động | 0.8s | Nhẹ |
| `filmburn` | FilmBurn.glsl (nếu không có: burn.glsl) | phim xưa | 1.0s | Nhẹ |

Wrapper chung: shader GL Transitions có dạng `vec4 transition(vec2 uv)` dùng `getFromColor`, `getToColor`, `progress`, `ratio` và uniform riêng. Viết một wrapper tạo `ShaderMaterial` từ chuỗi GLSL gốc (giữ nguyên thân hàm, chỉ bọc thêm), để thêm transition mới chỉ cần thêm file `.glsl` + một dòng registry.

Easing của `progress` mặc định `easeInOutSine` (nhiều shader gốc chạy tuyến tính trông cứng).

Stretch: transition overlay tự viết (`lightleak-flash`, `filmburn-flash`) bằng shader nhiễu, không dùng video.

## 2. Chuyển động

| id | Mô tả | Tham số | Nặng |
|---|---|---|---|
| `kenburns` | Camera trực giao, crop khung 16:9 trong ảnh, nội suy tâm + zoom | from, to, easing | Nhẹ |
| `camera25d/dolly-in` | Camera phối cảnh tiến về ảnh, ảnh hơi nghiêng 1–2° | intensity 0..1 | Nhẹ |
| `camera25d/dolly-out` | Ngược lại | intensity | Nhẹ |
| `camera25d/pan-left`, `pan-right` | Lướt ngang, có thị sai nhẹ (FOV 35°) | intensity | Nhẹ |
| `camera25d/tilt` | Xoay nhẹ quanh trục dọc 3–6° | intensity | Nhẹ |

Mọi preset tự tính scale tối thiểu để khung hình luôn phủ kín ảnh.

## 3. Film look

### 3.1 Chuỗi pass (theo thứ tự)

| # | Pass | Tham số chính | Nặng |
|---|---|---|---|
| 1 | Frame hold (giả 18fps) | `holdFps` (0 = tắt, 18, 24) – chọn khung nguồn `floor(t*holdFps)/holdFps` | Không tốn |
| 2 | Gate weave | biên độ px (0–6), tần số; dịch + xoay rất nhỏ, nhiễu mượt theo seed | Nhẹ |
| 3 | Màu | exposure, contrast, saturation, fade (nâng đen), split tone (màu bóng tối / vùng sáng), cân bằng ấm lạnh; tùy chọn LUT 3D `.cube` tự làm | Nhẹ |
| 4 | Halation | ngưỡng sáng, bán kính, màu (đỏ cam), độ mạnh – blur 2 pass ở nửa độ phân giải | Vừa |
| 5 | Bloom | ngưỡng, bán kính, độ mạnh – dùng chung mip blur với halation | Vừa |
| 6 | Độ nét | soften (blur nhẹ), chromatic aberration ở rìa | Nhẹ |
| 7 | Grain | kích thước, độ mạnh, theo luma (vùng tối hạt nhiều hơn), tất định theo seed+frame | Nhẹ |
| 8 | Hư hỏng phim | bụi (chấm), sợi tóc, vết xước dọc – thủ tục (procedural) theo seed, mật độ | Nhẹ |
| 9 | Flicker | độ sáng dao động ±% | Không tốn |
| 10 | Vignette + viền | vignette, viền đen bo góc (gate), tùy chọn | Nhẹ |
| 11 | Dither + output | thêm nhiễu ±0.5/255 chống sọc, về sRGB 8-bit | Không tốn |

**Độ mạnh `strength` (0.1–1.0)** nội suy mọi tham số của preset giữa giá trị trung tính và giá trị đầy đủ. Riêng `holdFps` chỉ bật khi strength ≥ 0.5.

### 3.2 Look MVP (5 cái)

Tên hiển thị tự đặt, **không dùng tên thương hiệu phim**.

| id | Tên hiển thị | Đặc điểm |
|---|---|---|
| `super8` | Phim gia đình 8mm | Ấm ngả đỏ, hạt to, mềm, gate weave mạnh, flicker, viền đen bo góc, bụi + xước, holdFps 18. Hợp B-roll cưới. |
| `16mm` | Phim 16mm | Hạt vừa, mềm, bóng tối hơi xanh lục, weave nhẹ, ít bụi. |
| `35mm` | Điện ảnh 35mm | Hạt mịn, halation đỏ quanh đèn, da ấm, màu dày, contrast vừa. Hợp tiệc, sự kiện. |
| `faded70s` | Bản in phai màu | Đen bạc (fade cao), ngả nâu hồng, ít bão hòa, hạt vừa. |
| `bw-classic` | Đen trắng cổ điển | Đơn sắc, contrast cao, hạt rõ, bụi + xước, vignette. |

Stretch: `slide-6070` (dương bản rực), `instant`, `disposable90s` (ngày cam ở góc), `sepia`, `projector`, `vhs`, `bleach`.

Preset là dữ liệu trong `engine/looks/presets.ts`. Mỗi look có ảnh mẫu `docs/looks/<id>.jpg` sau khi chủ dự án duyệt.

## 4. Chữ

- Rasterize bằng Canvas 2D (`OffscreenCanvas`) ở đúng kích thước 1080p → texture. Chờ `document.fonts.load()` trước khi vẽ để không mất dấu.
- Font MVP (OFL, có dấu tiếng Việt – xác minh khi tải, ghi vào ASSETS.md): **Be Vietnam Pro** (sans), **Playfair Display** (serif sang), **Lora** (serif đọc), **Dancing Script** (viết tay).
- Kiểu hiệu ứng: `fade`, `fade-up` (mờ + trượt lên 3%), `typewriter` (hiện từng ký tự, tính theo grapheme để không tách dấu), `tracking-in` (giãn chữ rồi co lại).
- Chữ nằm **trước** film look, nên cũng bị grain/weave như phim thật.
- Test bắt buộc: chuỗi "Kỷ niệm ngày cưới – Thanh & Mai, Đà Lạt 2026" hiển thị đủ dấu với cả 4 font.
