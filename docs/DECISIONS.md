# Các quyết định đã chốt (DECISIONS)

File này lưu lại các quyết định quan trọng về sản phẩm và kỹ thuật để tránh thảo luận lại hoặc đi chệch hướng ở các phiên làm việc sau.

---

### D01. Phát hành cá nhân & bạn bè – Không thương mại, không bảo mật/key
- **Quyết định:** App dùng cá nhân và chia sẻ bạn bè miễn phí. Không cài hệ thống license key, không đăng nhập/password, không mã hóa chống crack, không gửi dữ liệu/telemetry.
- **Hệ quả:** Không cần bận tâm rào cản bản quyền GPL nếu sử dụng FFmpeg kèm `libx264` hoặc các codec dựng phim. Toàn bộ tài nguyên và xử lý chạy 100% offline/local.

### D02. B-roll không nhạc (Chốt ngày 23/11)
- **Quyết định:** Bỏ hoàn toàn tính năng nhập nhạc MP3/WAV và tự dò nhịp beat.
- **Lý do:** Video xuất ra là B-roll không tiếng để editor ghép vào timeline phim cưới/sự kiện vốn đã có nhạc nền riêng trong DaVinci Resolve / Premiere. Bỏ nhạc giúp UI gọn hơn, tập trung tối đa vào chất lượng hình ảnh.

### D03. Chỉ xuất Full HD 1080p, hỗ trợ đa FPS (Chốt ngày 23/11 & 24/11)
- **Quyết định:** Chỉ hỗ trợ **1920×1080** (bỏ 4K ở Bản 1). Tuy nhiên **không hardcode 30fps** mà cho chọn **23.976 / 24 / 25 / 30 fps**.
- **Lý do:** 1080p giảm 4 lần áp lực VRAM và thời gian render so với 4K. Phim cưới/sự kiện tại Việt Nam quay nhiều ở 24fps và 25fps (tránh nhấp nháy đèn 50Hz), cần khớp frame rate với project Resolve.

### D04. Stack công nghệ: Electron + TypeScript + React + Three.js
- **Quyết định:** Dùng Electron thay vì Tauri; dùng TypeScript + React + Zustand + Tailwind; dùng Three.js (WebGL2).
- **Lý do:** Electron đóng gói sẵn nhân Chromium ổn định nhất cho WebGL2/WebGPU/WebCodecs trên Windows mà không phụ thuộc WebView2 của từng máy. TypeScript giúp AI viết code ít lỗi schema/IPC.

### D05. Pipeline màu WebGL2 `RGBA16F` Linear + Hỗ trợ `.cube` LUT
- **Quyết định:** Toàn bộ quá trình dựng hình, Halation, Bloom, Light Leak chạy trong không gian tuyến tính 16-bit float (`RGBA16F`), chỉ áp 3D LUT và Dithering ở pass cuối cùng trước khi xuất `bt709`. Hỗ trợ nạp `.cube` LUT từ DaVinci Resolve.
- **Lý do:** Tránh bết sáng (clipping), tránh sọc màu (banding) 8-bit, và đảm bảo màu B-roll khớp khi đưa vào DaVinci Resolve.

### D06. Ưu tiên Procedural Shader & Deterministic PRNG thay vì `<video>` HTML5
- **Quyết định:** Grain, bụi, vết xước, rung khung (gate weave), nhấp nháy (flicker), light leak mềm viết bằng GLSL shader tính theo `frameIndex` (deterministic). Nếu có overlay quay thật (film burn/ink mask), giải mã bằng WebCodecs hoặc chuỗi frame texture, tuyệt đối không dùng `<video>.currentTime` khi export.
- **Lý do:** Seeking `<video>` khi export từng frame cực chậm và dễ lệch khung. Procedural shader nét, nhẹ, và đảm bảo frame xem trước giống frame xuất ra 100%.

### D07. Tách đôi `Motion Template` × `Film Look` (có chế độ Clean)
- **Quyết định:** Không gộp cứng chuyển động với màu phim. Người dùng có thể ghép bất kỳ Motion Template nào với bất kỳ Film Look nào (hoặc tắt Look = Clean 0%).
- **Lý do:** Nhân số lượng tổ hợp phong cách lên gấp nhiều lần và cho phép editor xuất bản Clean nếu muốn tự chấm màu đồng bộ trên Resolve.

### D08. Xử lý ảnh dọc (Portrait) bắt buộc có ở Bản 1
- **Quyết định:** Hỗ trợ sẵn 3 chế độ (Smart Pairing ghép 2–3 ảnh, Matte/Framed, Safe Top-Third Crop + click đặt focal point) ngay ở Bản 1.
- **Lý do:** Thực tế ảnh cưới/sự kiện có 40–60% là ảnh dọc; nếu chỉ crop giữa 16:9 mặc định sẽ cắt mất đầu nhân vật.

### D09. Tinh gọn Transitions (15–20) và Text (5–6) cho Bản 1
- **Quyết định:** Thay vì 40–60 transition và 20 kiểu chữ như dự thảo ban đầu, Bản 1 chỉ chọn lọc 15–20 transition điện ảnh/editorial chất lượng cao và 5–6 kiểu chữ tối giản + date stamp.
- **Lý do:** Tập trung làm từng hiệu ứng thật mượt và đẹp thay vì dàn trải nhiều hiệu ứng sến/cũ không dùng đến trong phim cưới hiện đại.

### D20. Bảng phải theo ngữ cảnh, nhóm thu gọn có công tắc (Bước 5c)
- **Quyết định:** Bảng bên phải đổi theo thứ đang chọn (Dự án / Scene / Ảnh); mọi nhóm thông số là accordion thu gọn được, có công tắc bật/tắt và nút ⟲ đặt lại; thao tác phụ dồn vào menu "⋯", chuột phải và phím tắt.
- **Lý do:** Giao diện cũ trộn 3 cấp độ trong một cột cuộn dài, chữ nhỏ, nút sát nhau. Cách này giống CapCut/Resolve/Figma, không cần thêm thư viện.

### D21. Keyframe Đầu/Cuối cho ảnh (Bước 5c)
- **Quyết định:** Mỗi ảnh có tối đa 2 điểm (Đầu, Cuối) cho vị trí, zoom, xoay; nội suy theo `frameIndex` với 4 kiểu làm mượt. Không làm nhiều keyframe giữa (để Đợt 4 / sau Bản 1).
- **Lý do:** Đủ để tự đạo diễn chuyển động như ProShow, giữ preview và export khớp 100% (D06), không cần trình sửa scene toàn màn hình.

### D22. Hiệu ứng theo thời gian của scene tính trên CPU, shader chỉ nhận kết quả (Đợt 4)
- **Quyết định:** Ảnh xuất hiện lần lượt (S7) và các hiệu ứng vào/ra theo thời gian khác được tính bằng hàm thuần TypeScript từ thời gian của scene (`sceneTimeA/B` của `evaluateTimeline`, suy ra từ `frameIndex`), rồi gửi vào shader dưới dạng uniform (vd. `uStaggerA` = mức hiện của 4 ô). Không thêm điểm gọi hàm nặng trong shader.
- **Lý do:** Giữ preview và export khớp 100% (D06), test được bằng vitest, và tránh shader D3D trên Windows bị nở to (bài học từ việc gom tap list).

### D23. Chữ chuyển động: một kiểu cho cả dự án, thời điểm và vị trí riêng từng scene (Đợt 4)
- **Quyết định:** Kiểu chuyển động chữ (Mờ vào / Gõ máy chữ / Trượt lên) chọn một lần ở tab Chữ cho cả dự án. Chú thích riêng từng scene có thể có thời điểm hiện/ẩn và vị trí kéo riêng; nếu không thì theo vị trí của dự án. Vị trí lưu dạng độ lệch so với chỗ gốc của kiểu chữ (tỷ lệ khung), giới hạn ±45%.
- **Lý do:** B-roll cần chữ đồng bộ phong cách cả clip; thời điểm và chỗ đặt chữ thì phụ thuộc ảnh từng scene. Dời chữ bằng shader nên kéo mượt và không tốn CPU vẽ lại.


### D24. Scene Style lưu trên máy, không mang nội dung chữ (Đợt 4)
- **Quyết định:** "Scene Style" gom bố cục, thời lượng, chuyển động (kể cả ảnh xuất hiện lần lượt), nền, khung ảnh, chuyển cảnh, look riêng và thời điểm/vị trí chữ của một scene. Áp style giữ nguyên ảnh và nội dung chữ của scene đích. Style của người dùng lưu trong localStorage của máy (giống preset Look), không nằm trong file dự án. Có sẵn 4 style: Mở đầu, Kết thúc, Chân dung đôi, Lưới kỷ niệm.
- **Lý do:** Style là thói quen dựng của người dùng, dùng lại qua nhiều dự án; chữ là nội dung riêng của từng đám cưới/sự kiện nên không được chép theo.

### D25. Hình xem trước Template & Look bằng CSS, không dùng WebGL (Đợt 4)
- **Quyết định:** Ô Template và Look (lưới 2 cột) có hình nhỏ dùng ảnh trong khay (hoặc màu mẫu khi khay trống). Rê chuột thì Template chạy thử chuỗi bố cục + zoom chậm; Look mô phỏng màu, viền tối, hạt, nháy, rung bằng CSS filter/overlay (`src/engine/presetPreview.ts`). Đây chỉ là gợi ý; hình thật vẫn là khung xem chính.
- **Lý do:** Mỗi ô một WebGL context sẽ vượt giới hạn context của trình duyệt và tốn VRAM; CSS nhẹ, không cần thư viện, chỉ chạy khi rê chuột.
