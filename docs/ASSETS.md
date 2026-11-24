# Nguồn tài nguyên & Bản quyền (ASSETS) – FrameSlide

Vì app dùng cá nhân và chia sẻ bạn bè (không thương mại hóa), ta vẫn ưu tiên sử dụng các tài nguyên **mã nguồn mở / miễn phí hợp lệ** và tự sinh bằng thuật toán để bộ cài nhẹ và sạch sẽ.

## 1. Shaders & Transitions
- **GL Transitions (`gl-transitions`):**
  - Nguồn: [https://gl-transitions.com](https://gl-transitions.com)
  - Giấy phép: MIT / BSD (chỉ cần giữ thông tin tác giả trong file ghi công).
  - Sử dụng: Chọn lọc một số shader phù hợp (ví dụ `InvertedPageCurl`, `Directional`, `CrossZoom`...) và tinh chỉnh easing lại cho mượt.
- **Film Look & Optical Shaders (Tự viết):**
  - Halation, Bloom, Grain (Simplex/Hash PRNG theo `frameIndex`), Gate Weave, Flicker, Chromatic Aberration, Vignette, Dithering → Tự viết bằng GLSL cho Three.js.

## 2. Font chữ hỗ trợ tiếng Việt
Chọn các font từ **Google Fonts** (giấy phép **SIL Open Font License - OFL**, miễn phí đóng gói kèm app) có hỗ trợ đầy đủ bảng mã tiếng Việt:
- **Không chân hiện đại (Sans-serif):** `Inter`, `Be Vietnam Pro`, `Plus Jakarta Sans`
- **Có chân thanh lịch (Serif – hợp phim cưới):** `Playfair Display`, `Cormorant Garamond`, `Lora`
- **Kiểu đánh máy / Date Stamp:** `JetBrains Mono`, `Share Tech Mono` (hoặc font kiểu LED/7-segment hỗ trợ số và dấu)

## 3. Overlay & Texture (Light Leak, Film Burn, Paper)
- **Ưu tiên 1:** Tự tạo bằng Procedural Shader (không tốn dung lượng bộ cài).
- **Ưu tiên 2:** Tự quay/chụp hoặc dùng các gói overlay CC0 / miễn phí bản quyền cho phần mềm, nén thành texture atlas hoặc chuỗi frame tối ưu dung lượng.

## 4. Phần mềm đóng gói kèm
- **FFmpeg:** Dùng bản build Windows tĩnh (`ffmpeg.exe`) để xuất ProRes 422 / DNxHR HQ.
- **Sharp:** Thư viện Node.js xử lý ảnh tốc độ cao (Apache-2.0).
- **mp4-muxer:** Thư viện TypeScript mux luồng WebCodecs thành MP4 (MIT).
