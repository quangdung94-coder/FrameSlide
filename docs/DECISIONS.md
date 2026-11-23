# DECISIONS – các quyết định đã chốt

Mỗi quyết định có lý do. **Không đề xuất lại cái đã bỏ** trừ khi chủ dự án hỏi. Quyết định mới thêm vào cuối, đánh số tiếp.

| # | Ngày | Quyết định | Lý do |
|---|---|---|---|
| D01 | 23/11/2026 | Electron (Chromium đóng gói) thay vì Tauri | WebGL chạy giống nhau trên mọi máy vì cùng một Chromium; Tauri dùng WebView2 của hệ thống, khác bản driver/flag. Node ở main process gọi FFmpeg qua pipe dễ. Đổi lại bộ cài nặng thêm ~100–150MB, chấp nhận được. |
| D02 | 23/11/2026 | Three.js (WebGL2), shader GLSL | Camera 3D, render target, post-process có sẵn. WebGPU chưa cần. |
| D03 | 23/11/2026 | **Không có nhạc**, không audio | Video là B-roll không tiếng để chèn vào phim cưới, sự kiện, year end party. Bỏ nhạc làm app nhẹ và đơn giản hơn. |
| D04 | 23/11/2026 | **Chỉ 1920x1080, 30fps** | Slideshow ảnh không cần 4K; 4K nặng gấp 4 lần cho mọi hiệu ứng điểm ảnh và VRAM. 25fps có thể thêm sau (PLAN S05). |
| D05 | 23/11/2026 | **Film look luôn bật**, độ mạnh 10–100%, không có xuất "sạch" | Film look xưa là bản sắc của sản phẩm. Người dùng chỉ chỉnh độ mạnh cho hợp phim chính. |
| D06 | 23/11/2026 | Xuất MP4 H.264 + ProRes 422 HQ + DNxHR HQ | Editor cần codec trung gian để đưa vào Resolve/Premiere không vỡ grain. |
| D07 | 23/11/2026 | Xuất theo độ dài cố định và xuất hàng loạt | B-roll cần đúng độ dài để thả vào timeline; một thư mục cưới ra nhiều clip một lần. |
| D08 | 23/11/2026 | Dựng hình tất định, xuất từng khung (offline), không quay màn hình | Bảo đảm không mất khung và khớp xem trước. Ngẫu nhiên dùng PRNG có seed. |
| D09 | 23/11/2026 | Transition lấy từ GL Transitions (MIT), ghi công tác giả | Có sẵn hàng trăm shader nhỏ, giấy phép cho phép thương mại. Phải chọn lọc và chỉnh easing. |
| D10 | 23/11/2026 | Hư hỏng phim (bụi, xước, grain, light leak) làm **thủ tục bằng shader** trong MVP, không dùng video overlay | Không phải lo giấy phép tài nguyên video, nhẹ hơn, không phải giải mã nhiều video song song. Video overlay có thể thêm ở bản 2. |
| D11 | 23/11/2026 | Look và LUT tự làm, tên tự đặt | Không sao chép Resolve Film Look Creator hay Retrograde; không dùng tên thương hiệu phim (Kodak, Fuji...). Resolve chỉ dùng để so sánh khi duyệt. |
| D12 | 23/11/2026 | Không mở file .aep/.mogrt, không plugin AE | Không khả thi; mỗi phong cách dựng lại trong app. Không sao chép template Motion Array, chỉ học phong cách. |
| D13 | 23/11/2026 | Ảnh làm việc (proxy) 3200px cạnh dài, chỉ giữ ~4 ảnh trên GPU | Ảnh 24MP chiếm ~96MB VRAM; 3200px đủ cho zoom Ken Burns ở 1080p. |
| D14 | 23/11/2026 | Installer .exe để sau MVP | Hạn 25/11 chỉ đủ cho app chạy được bằng `npm run dev` / build. |
| D15 | 23/11/2026 | Làm việc bằng hai luồng Claude: coder (mỗi việc một PR) và reviewer (soát, sửa, merge) | Phiên có thể bị ngắt khi hết giới hạn; trạng thái nằm trong PLAN.md và PR nên phiên mới tiếp tục được. Xem CLAUDE.md. |
| D16 | 23/11/2026 | React cho UI, zod cho schema, sharp cho ảnh, ffmpeg-static cho FFmpeg | Thư viện phổ biến, ổn định trên Windows, Claude viết tốt. Danh sách đầy đủ ở ARCHITECTURE.md mục 6. |
| D18 | 23/11/2026 | Đưa chia khung 2 ô và 4 ô vào MVP (PLAN T15b); mosaic 3x3 trở lên vẫn là stretch | Chủ dự án yêu cầu; B-roll cưới hay ghép đôi ảnh dọc. Làm bằng viewport, nhẹ. |
| D17 | 23/11/2026 | Lưu ý giấy phép FFmpeg: bản `ffmpeg-static` là build GPL (có libx264) | Dùng nội bộ thì không sao. Trước khi phát hành/bán phải xem lại (build LGPL + chỉ NVENC/encoder ngoài, hoặc tuân thủ GPL). Ghi trong ASSETS.md. |
