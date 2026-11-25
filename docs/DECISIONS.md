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

### D26. Font đóng gói trong app, một thang cỡ chữ (Đợt 5.3a)
- **Quyết định:** Font Be Vietnam Pro, JetBrains Mono, Playfair Display lấy từ gói `@fontsource/*` (giấy phép OFL, chỉ là file font, không có code chạy), Vite gom vào bản build; bỏ link Google Fonts. Giao diện dùng Be Vietnam Pro, số/thời gian dùng JetBrains Mono. Thang cỡ chữ duy nhất trong `index.css`: `text-2xs` 11px, `text-xs` 12px, `text-sm` 13px, `text-title` 15px; cấm `text-[Npx]` (có test). Trước khi vẽ chữ vào video, engine chờ font tải xong (`loadTextFonts`).
- **Lý do:** Máy không có mạng thì chữ trong video bị đổi sang font khác; giao diện trước đó dùng font hệ thống và cỡ chữ lẫn lộn 8–18px.

### D27. Chữ riêng từng scene (Đợt 5.4a, sửa D23)
- **Quyết định:** Chữ của dự án vẫn là mặc định cho mọi scene, nhưng mỗi scene có thể "Tắt chữ" hoặc có chữ "Riêng" (kiểu chữ, chuyển động, tiêu đề, phụ đề) lưu trong `SceneItem.text`; thiếu trường này là theo dự án. Chữ riêng dùng thời điểm hiện/ẩn và vị trí riêng của scene như chú thích. Engine vẫn một texture chữ, lấy theo scene A (giống chú thích trước đây), không cần cặp A/B. Dán thiết lập "Chữ" và Scene Style chỉ mang kiểu, scene đích giữ chữ của nó (giữ D24).
- **Lý do:** Phim cưới/sự kiện cần tiêu đề khác kiểu ở vài cảnh (mở đầu, lễ vu quy, kết) mà vẫn giữ chữ đồng bộ cho phần còn lại. Bỏ ý cũ "một kiểu chữ cho cả dự án" của D23.

### D28. Thêm 4 font tiêu đề tiếng Việt, chỉnh chữ là lớp phủ lên kiểu chữ (Đợt 5.4b)
- **Quyết định:** Thêm `@fontsource/montserrat`, `lora`, `dancing-script`, `great-vibes` (OFL, chỉ là file font, có bộ chữ tiếng Việt) bên cạnh 3 font của D26; nạp các độ đậm 400/700 và nghiêng nếu font có. Bảng chữ lưu `look` (font, cỡ %, đậm, nghiêng, canh lề, khoảng cách chữ, màu, viền, bóng); trường nào thiếu thì theo kiểu chữ gốc, nên dự án cũ và 5 kiểu chữ có sẵn không đổi. Không cho chọn font cài trên máy.
- **Lý do:** Video xuất ra phải giống nhau trên mọi máy bạn bè dùng; font hệ thống thiếu dấu tiếng Việt hoặc khác nhau giữa máy. 7 font đủ cho phim cưới/sự kiện (không chân, có chân, viết tay, đơn cách) mà bản build chỉ nặng thêm khoảng 700 KB (chỉ nạp bộ chữ Latin + tiếng Việt).

### D29. Nền mờ dùng bản mờ nhỏ tạo sẵn cho từng ảnh (Đợt 5.4c)
- **Quyết định:** Nền "Ảnh mờ" không làm mờ mạnh trong shader chính. Mỗi ảnh (theo kiểu mờ + độ mờ) được vẽ một lần ra canvas nhỏ 320px bằng bộ lọc blur của canvas (mờ phóng / chuyển động = cộng nhiều lớp vẽ lệch, kính mờ = thêm hạt với seed cố định), giữ trong bộ nhớ đệm LRU 16 bản, rồi shader chỉ đọc bản này 1 lần (`uBgTexA/B`). Độ tối, phóng nền và tối viền tính trong shader bằng uniform. Khi bản mờ chưa có (ảnh đang tải) thì dùng lại phép mờ 3×3 cũ. Mặc định (độ tối 80, phóng 118%) giữ đúng độ sáng và khung nền như trước.
- **Lý do:** Mờ mạnh trong shader cần hàng chục lần đọc ảnh mỗi điểm ảnh, vừa nặng vừa làm shader D3D trên Windows nở to (bài học D22). Bản mờ không có thành phần ngẫu nhiên theo frame nên xem trước và xuất khớp (D06).


### D30. Xuất video không hỏi chỗ lưu sau khi bấm (Đợt 6.1)
- **Quyết định:** Hộp Xuất video hiện sẵn thư mục lưu (mặc định thư mục Videos, nhớ thư mục chọn lần trước trên máy) và tên file gợi ý theo tên dự án. Bấm "Xuất" là render thẳng vào đó, không mở hộp Save As nữa. Trùng tên thì tự thêm `_2`, `_3`, không bao giờ ghi đè. Định dạng và "Mở thư mục khi xong" cũng nhớ trên máy (localStorage), không vào file dự án.
- **Lý do:** Anh Dũng muốn chọn thư mục trước khi bấm xuất; hộp Save As hiện sau khi bấm dễ bị bỏ quên khi xuất nhiều lần.

### D31. Đóng gói bằng GitHub Actions, FFmpeg tải lúc đóng gói (Bước 6)
- **Quyết định:** File `.exe` được đóng gói trên máy Windows của GitHub Actions (`.github/workflows/release.yml`), không đóng gói trên máy anh Dũng. Mỗi lần gộp vào `main` thì cập nhật GitHub Release "FrameSlide (bản mới nhất)" với 2 file: bộ cài `FrameSlide-Setup-x.y.z.exe` (khuyên dùng, mở nhanh) và `FrameSlide-Portable-x.y.z.exe` (bấm là chạy, không cài). FFmpeg (bản Windows tĩnh, có `prores_ks`, `dnxhd`, `libx264`) được tải lúc đóng gói vào `resources/ffmpeg/`, app ưu tiên bản này rồi mới tới `ffmpeg` trong PATH. Trước khi phát hành, CI mở bản đã đóng gói với `--smoke-test` để kiểm tra giao diện tải được, `sharp` tạo được ảnh mẫu và FFmpeg chạy được. Không ký số (D01: không thương mại), nên Windows SmartScreen có thể hỏi lần đầu.
- **Lý do:** Không cần Node / FFmpeg trên máy người dùng; không cho file nhị phân hơn 100 MB vào repo; bản phát hành luôn khớp code trên `main` và đã qua kiểm tra tự động.
