# Danh mục Hiệu ứng (EFFECTS) – v1.0 (Đã khóa sau Bước 3)

> **Trạng thái:** Đã khóa danh mục v1.0 cho Bản 1 sau Prototype Bước 3. Pipeline 3-Pass Linear (`RGBA16F`) đã được kiểm chứng.

---

## 1. Transitions (15–20 kiểu chọn lọc cho Bản 1)

| Nhóm | Tên hiệu ứng | Nguồn / Cách làm | Mức nặng |
|---|---|---|---|
| **Cơ bản & Mềm** | Film Dissolve | Shader (Linear crossfade) | Nhẹ |
| | Dip to Black / White | Shader (FadeColor) | Nhẹ |
| | Dreamy Blur Dissolve | Shader (Defocus + Crossfade) | Trung bình |
| | Glow / Bloom Dissolve | Shader (Overbright + Fade) | Trung bình |
| **Ánh sáng & Phim** | Light Leak Wipe | Procedural / Atlas Overlay + Add | Trung bình |
| | Film Burn | Procedural / Atlas Overlay | Trung bình |
| | Overexposure Flash | Shader (Exposure spike) | Nhẹ |
| | Filmstrip Push | Shader + UV offset | Nhẹ |
| **Chuyển động** | Smooth Zoom In / Out | Shader (Radial blur + Scale) | Nhẹ |
| | Whip Pan (Trái/Phải/Lên/Xuống) | Shader (Directional motion blur) | Nhẹ |
| | Camera Shake Cut | Procedural shake + Cut | Nhẹ |
| **Giấy & Khung** | Paper Slide / Taped | Shader + Bóng đổ | Nhẹ |
| | Polaroid Toss (Ảnh bay vào) | 2.5D Plane transform | Nhẹ |
| | Page Curl (Lật nhẹ) | `gl-transitions` (`InvertedPageCurl`) | Trung bình |
| | Ink Bleed (Mực loang nhẹ) | `gl-transitions` / Mask | Trung bình |

---

## 2. Film Look Presets (12 kiểu + Clean Mode)

Mỗi preset đều chỉnh được thanh **Intensity (0–100%)** và từng thành phần riêng lẻ:

| STT | Tên Preset | Đặc trưng chính | Ghi chú sử dụng |
|---|---|---|---|
| 0 | **Clean (Tắt Look)** | Không màu, không hạt, giữ nguyên ảnh | Dùng khi muốn tự chấm màu trong Resolve |
| 1 | **Super 8 Gia Đình** | Hạt to, ấm ngả đỏ, halation, gate weave, giả 18fps, bo góc | Hợp B-roll cưới, kỷ niệm |
| 2 | **16mm Tài Liệu** | Hạt vừa, mềm, vùng tối hơi xanh lục, rung nhẹ | Hợp phóng sự cưới, hậu trường |
| 3 | **35mm Điện Ảnh** | Hạt mịn, halation đỏ quanh đèn, da ấm, màu dày | Hợp tiệc tối, sự kiện |
| 4 | **Dương Bản 60–70s** | Đỏ/vàng rực, xanh dương đậm, tương phản cao | Hợp ảnh ngoại cảnh, du lịch |
| 5 | **Bản In Phai Màu 70–80s** | Đen bạc màu (fade), ngả nâu/tím nhẹ, ít bão hòa | Hợp hoài niệm, gia đình |
| 6 | **Ảnh Lấy Liền (Instant)** | Bóng tối ngả xanh, vùng sáng ấm, khung trắng | Hợp template Polaroid |
| 7 | **Máy Dùng 1 Lần 90s** | Cảm giác flash, vignette, hơi cháy sáng | Hợp tiệc vui, year end party |
| 8 | **Đen Trắng Cổ Điển** | Tương phản cao, hạt rõ, bụi & vết xước nhẹ | Hợp khoảnh khắc cảm xúc |
| 9 | **Sepia Đầu Thế Kỷ** | Tông nâu cổ, vignette đậm, vết xước | Hợp ảnh tư liệu/lịch sử |
| 10 | **Máy Chiếu Phim** | Nhấp nháy (flicker), điểm sáng giữa khung, sprocket | Hợp mở đầu/chuyển hồi |
| 11 | **VHS / Camcorder 90s** | Lem màu (chroma bleed), scanline, khung 4:3 tùy chọn | Hợp retro, year end party |
| 12 | **Bleach Bypass** | Màu nhạt, tương phản mạnh, gai góc | Hợp sự kiện, sân khấu |

---

## 3. Text & Date Stamp (5–6 kiểu Bản 1)
Hỗ trợ đầy đủ bộ gõ & font tiếng Việt có dấu:
1. **Date Stamp 90s:** Chữ cam điện tử phát sáng nhẹ ở góc dưới phải (kiểu máy ảnh phim).
2. **Minimal Fade:** Tiêu đề mảnh, căn giữa hoặc góc, mờ dần.
3. **Editorial Serif:** Font có chân thanh lịch + phụ đề nhỏ (hợp thiệp cưới).
4. **Filmstrip Label:** Chữ nhỏ chạy dọc/ngang theo viền phim.
5. **Lower Third Tối Giản:** Thanh chú thích nhỏ ở góc trái dưới.
