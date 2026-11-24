# Đặc tả sản phẩm (SPEC) – FrameSlide

## 1. Mục tiêu & Đối tượng sử dụng
- **Mục tiêu:** Tạo một ứng dụng Windows nhẹ, phản hồi nhanh (kiểu ProShow) nhưng cho ra chất lượng hình ảnh, chuyển động và màu phim xưa tiệm cận template After Effects.
- **Mục đích sử dụng:** Xuất các đoạn **video B-roll không tiếng** để editor kéo thẳng vào timeline DaVinci Resolve hoặc Premiere (phim cưới, sự kiện, phóng sự, year end party).
- **Phát hành:** App chạy local trên máy cá nhân và chia sẻ miễn phí cho bạn bè. Không có hệ thống tài khoản, không key kích hoạt, không quảng cáo/telemetry.

## 2. Chuẩn đầu ra (Output Spec)
- **Độ phân giải:** Full HD **1920×1080** (16:9). Không làm 4K ở Bản 1.
- **Tốc độ khung hình (FPS):** Cho phép chọn **23.976, 24, 25, hoặc 30 fps** ngay từ Bản 1 (mặc định 24fps hoặc 30fps tùy preset).
- **Định dạng xuất:**
  - **MP4 (H.264):** Bitrate cao, Rec.709 (`bt709`), dùng nhanh hoặc chia sẻ.
  - **ProRes 422 / DNxHR HQ (.mov):** Cho dựng phim chuyên nghiệp trong DaVinci Resolve / Premiere, giữ nguyên chi tiết grain/halation mà không bị vỡ nén.
- **Âm thanh:** Không có track âm thanh (video B-roll câm).

## 3. Những gì KHÔNG làm (Out of Scope)
- Không làm tính năng chèn nhạc, cắt ghép theo nhịp beat (beat-sync).
- Không xuất 4K (tránh tràn VRAM và chậm máy tầm trung).
- Không đọc/mở file `.aep` của After Effects hoặc chạy plugin AE.
- Không hỗ trợ nhập text overlay ngoài (Lottie / ProRes 4444) ở Bản 1.
- Không cài hệ thống bản quyền, license key, password, hay cloud sync.

## 4. Tính năng Bản 1 (Cốt lõi)

### 4.1. Nhập & Quản lý ảnh
- Kéo thả file ảnh hoặc cả thư mục ảnh (JPG, PNG, WebP, TIFF).
- Tự động xoay đúng chiều theo EXIF, sắp xếp theo ngày chụp hoặc tên file.
- Tự động tạo Thumbnail (UI) và Working Proxy (2560–3200px) chạy nền không đơ giao diện. Ảnh gốc giữ nguyên không bị chỉnh sửa.

### 4.2. Kiến trúc 2 lớp độc lập: Motion Template × Film Look
Người dùng chọn và tùy chỉnh độc lập hai lớp:
1. **Motion Template (Bố cục & Chuyển động):**
   - Ken Burns cổ điển, 2.5D Parallax (nhiều lớp Z), Polaroid / Khung ảnh nổi, Filmstrip (cuộn phim), Mosaic / Grid đơn giản.
   - Cho phép chỉnh tay từng slide: thời lượng, điểm bắt đầu/kết thúc (zoom/pan), kiểu transition.
2. **Film Look (Màu phim & Chất liệu):**
   - ~12 preset film look xưa (Super 8, 16mm, 35mm, Vintage Print, Instant, Đen trắng, Sepia, VHS...) + **Chế độ Clean (0% Look)** để editor tự chỉnh màu sau trong Resolve.
   - Thanh trượt **Look Intensity (0–100%)** và chỉnh từng thành phần (Grain, Halation, Bloom, Gate Weave, Flicker, Dust/Scratches, Vignette/Frame).
   - **Import `.cube` 3D LUT:** Cho phép nạp trực tiếp file `.cube` xuất từ DaVinci Resolve Studio.

### 4.3. Xử lý ảnh dọc (Portrait) trong khung hình ngang 16:9
Bắt buộc có sẵn 3 chế độ xử lý (áp dụng toàn cục hoặc từng slide):
- **Smart Pairing:** Tự động ghép 2–3 ảnh dọc liên tiếp vào chung một khung hình ngang (kiểu Polaroid, Filmstrip, Editorial Split).
- **Matte / Framed:** Đặt ảnh dọc vào khung ảnh nổi trên nền mờ (blurred background) hoặc nền giấy/tối kèm chuyển động 2.5D.
- **Safe Top-Third Crop:** Khi phóng to phủ kín 16:9, mặc định lấy tâm ở vùng 1/3 phía trên (tránh cắt đầu người) + cho phép click đặt lại tâm điểm (focal point) nhanh.

### 4.4. Quick Create, Thời lượng & Xuất hàng loạt
- **Quick Create 1 chạm:** Chọn thư mục ảnh → Chọn Motion Template → Chọn Film Look → Tự động dựng toàn bộ slideshow.
- **Chế độ thời lượng:**
  - *Cố định tổng thời lượng:* 10s, 15s, 20s, 30s hoặc tự nhập (app tự chia đều cho số ảnh).
  - *Theo từng slide:* Tổng thời lượng tự động tính theo độ dài từng slide + transition.
- **Handles:** Tùy chọn thêm khoảng dư đầu/cuối (0.5s – 1s) ở mỗi clip nếu cần để editor kéo chuyển cảnh trong Resolve.
- **Batch Export (Xuất hàng loạt):** Chia một thư mục nhiều ảnh (ví dụ 100 ảnh) thành nhiều clip B-roll ngắn (ví dụ mỗi clip 15s gồm 8 ảnh) với một hoặc nhiều phong cách khác nhau.

### 4.5. Transitions & Chữ
- **Transitions:** Chọn lọc **15–20 transition** mang tính điện ảnh/editorial (xem `docs/EFFECTS.md`), chỉnh được thời lượng và chế độ ngẫu nhiên cùng phong cách.
- **Chữ (Text):** **5–6 kiểu tối giản** (Date Stamp cam kiểu máy ảnh 90s, Minimal Title, Editorial Caption, Lower Third nhẹ), hỗ trợ đầy đủ **font tiếng Việt có dấu**.

### 4.6. Tiện ích ứng dụng
- Xem trước thời gian thực với 3 mức chất lượng: **Tự động / Nửa (540p) / Đầy đủ (1080p)**.
- Kiểm tra phần cứng lần đầu chạy (cảnh báo nếu đang chạy card tích hợp trên laptop có 2 GPU hoặc driver quá cũ).
- Lưu/mở file dự án (`.frameslide`), tự động lưu (autosave), hoàn tác/làm lại (`Ctrl+Z` / `Ctrl+Y`).

## 5. Tính năng Bản 2 (Mở rộng sau khi Bản 1 ổn định)
- Trình tạo & chỉnh sửa template dạng keyframe.
- AI Depth-Map Parallax (tách nền/chủ thể bằng model ONNX chạy local để tạo hiệu ứng 3D thật hơn cho ảnh đơn).
- Tự nhận diện khuôn mặt để căn khung thông minh.
- Mosaic tự xếp lưới từ hàng trăm ảnh, Gallery 3D, Sách lật trang 3D.
- Chèn video clip xen kẽ với ảnh.
- Hỗ trợ nhập Lottie (`.json`) và video nền trong suốt (ProRes 4444 / WebM), khung dọc 9:16.

## 6. Tiêu chí hoàn thành (Definition of Done) cho Bản 1
1. Mở được trên Windows 10/11 64-bit qua file cài `.exe` không cần cài thêm Python/Node/Plugin ngoài.
2. Xem trước 1080p mượt (≥ 30fps hoặc tự động hạ resolution mượt trên máy tầm trung).
3. Xuất 15s clip (450 frames ở 30fps) không bị rớt frame, không lệch màu/gamma khi kéo vào DaVinci Resolve, không lỗi banding ở vùng light leak.
4. Dự án 100+ ảnh không bị tràn VRAM hay crash.
