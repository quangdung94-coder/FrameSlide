# PLAN – FrameSlide MVP

Hạn: **thứ Tư 25/11/2026**. Bắt đầu code: tối thứ Ba 24/11/2026 sau 20:00 (giờ Việt Nam).

## Cách dùng file này

- Trạng thái: `[ ]` chưa làm · `[x]` đã merge vào `main`. Việc đang làm = có PR mở với tiêu đề `Txx: ...` (xem GitHub, không ghi vào đây).
- Coder: chọn việc `[ ]` đầu tiên mà mọi việc ở "Cần trước" đã `[x]`. Một PR = một việc. Đổi `[ ]` thành `[x]` của đúng việc đó **trong chính PR đó**.
- Reviewer: kiểm theo "Xong khi", sửa lỗi nhỏ trên nhánh PR, merge.
- Mọi việc còn phải qua tiêu chí chung: `npm run typecheck && npm test && npm run build` xanh.
- **[DUYỆT]** = chủ dự án cần xem bằng mắt (gửi ảnh/video trong PR).
- Thứ tự đã sắp theo ưu tiên: hết mốc M1 là có bản dùng thử end-to-end.

---

## M0 – Khung dự án

### [ ] T01 – Khung Electron + Vite + TypeScript + React + Three.js
- Cần trước: —
- Làm: dựng theo cấu trúc `docs/ARCHITECTURE.md` mục 2 (tạo thư mục rỗng có `.gitkeep` nếu chưa dùng). Scripts `dev`, `build`, `typecheck`, `test`. `src/shared/constants.ts` với `WIDTH=1920, HEIGHT=1080, FPS=30`. Cửa sổ mở ra có một canvas WebGL2 xóa màu xám đậm. `.gitignore` cho `node_modules`, `out`, `dist`, video xuất.
- Xong khi: `npm run dev` mở cửa sổ có canvas; 1 test mẫu Vitest qua; typecheck/build qua; cài đặt Electron an toàn (contextIsolation, sandbox).

### [ ] T02 – CI GitHub Actions
- Cần trước: T01
- Làm: workflow chạy trên `windows-latest` cho mọi PR và push lên `main`: `npm ci`, `typecheck`, `test`, `build`. Cache npm.
- Xong khi: workflow xanh trên chính PR này.

### [ ] T03 – Kiểu dữ liệu và schema dự án
- Cần trước: T01
- Làm: `src/shared/schema.ts` (zod) + kiểu TS cho Project, Slide, Motion, Transition, Text, LookRef, Style, BatchJob đúng `docs/TEMPLATE_FORMAT.md`. Hàm `parseProject(json)`, `serializeProject(p)`.
- Xong khi: test: dự án mẫu trong TEMPLATE_FORMAT.md parse được; `strength` 0.05 bị từ chối; transition dài quá nửa slide bị từ chối; round-trip serialize/parse giữ nguyên.

### [ ] T04 – Timeline và PRNG
- Cần trước: T03
- Làm: `engine/random.ts` (mulberry32, `hash(seed, frame, salt)`), `engine/easing.ts`, `engine/timeline.ts`: `totalFrames(project)`, `frameState(project, n)` → `{ slideA, localTimeA, slideB?, localTimeB?, transitionProgress? }`.
- Xong khi: test với 3 slide (3s, 3s, 3s) và 2 transition 1s: tổng 7s = 210 khung; khung 60 đang transition 0→1 progress 0.5 (trước easing); khung cuối thuộc slide 3; PRNG cùng seed ra cùng dãy.

## M1 – Lát cắt end-to-end (1 ảnh → MP4 có film look)

### [ ] T05 – Nhập ảnh và proxy
- Cần trước: T03
- Làm: main process: kéo thả file/thư mục vào cửa sổ → `sharp` xoay EXIF, tạo `work.jpg` 3200px cạnh dài và `thumb.jpg` 320px vào cache (ARCHITECTURE mục 3), đọc ngày chụp, sắp theo ngày. Trả danh sách Photo cho renderer. Xử lý song song tối đa 4 ảnh, báo tiến độ.
- Xong khi: kéo 20 ảnh JPG vào thì thấy lưới thumbnail đúng chiều, đúng thứ tự ngày chụp; ảnh lỗi bị bỏ qua có báo; test cho hàm sắp xếp và đường dẫn cache.

### [ ] T06 – Renderer lõi và quản lý texture
- Cần trước: T04, T05
- Làm: `engine/renderer.ts`: WebGLRenderer, render target HalfFloat 1920x1080, `renderFrame(project, n)` vẽ slide A (chưa motion, chỉ fit-cover) ra màn hình. `engine/textures.ts`: giữ texture cho slide trước/hiện tại/2 kế, `dispose` cái khác. Preview có nút Play/Pause và thanh kéo thời gian, chạy theo đồng hồ 30fps.
- Xong khi: dự án 10 ảnh phát hết không giật, số texture trên GPU (`renderer.info.memory.textures`) không vượt 6; không có ảnh méo tỉ lệ.

### [ ] T07 – Ken Burns
- Cần trước: T06
- Làm: `engine/motion/kenburns.ts` theo TEMPLATE_FORMAT mục 2, có clamp không lộ viền, hỗ trợ ảnh dọc. Hàm `autoKenBurns(rng, zoomRange)` sinh from/to ngẫu nhiên hợp lệ.
- Xong khi: test: với ảnh ngang và dọc, 1000 bộ from/to ngẫu nhiên đều cho khung nằm trọn trong ảnh; xem trước mượt, không rung răng cưa (dùng mipmap + lọc tuyến tính).

### [ ] T08 – Hệ transition + `fade`
- Cần trước: T06
- Làm: render slide A, B vào 2 RT; wrapper GL Transitions (EFFECTS mục 1) tạo ShaderMaterial từ GLSL gốc; registry; port `fade` (ghi credit vào ASSETS.md). Áp easing cho progress.
- Xong khi: dự án 3 ảnh có 2 fade 1s chạy đúng thời điểm theo timeline; thêm một transition mới chỉ cần file .glsl + 1 dòng registry (ghi trong README của thư mục).

### [ ] T09 – Chuỗi film look + look `super8` [DUYỆT]
- Cần trước: T08
- Làm: `engine/looks/pipeline.ts` với đủ 11 pass ở EFFECTS mục 3.1 (halation/bloom có thể đơn giản trước), nội suy theo `strength`, tất định theo seed+frame. Preset `super8`. Thanh trượt độ mạnh trên UI (10–100%).
- Xong khi: cùng seed + cùng khung → pixel giống hệt (test đọc pixel 2 lần); không có cách nào để strength < 0.1; ảnh chụp khung hình ở 30%, 70%, 100% trong PR.

### [ ] T10 – Xuất MP4 1080p30
- Cần trước: T09
- Làm: `src/main/ffmpeg-args.ts` (hàm thuần), `src/main/export.ts` chạy `ffmpeg-static`, nhận khung RGBA qua IPC có back-pressure, tiến độ %, hủy. Dò NVENC, không có thì libx264. Hộp thoại chọn nơi lưu.
- Xong khi: test cho ffmpeg-args (có `-an`, `-r 30`, `-s 1920x1080`, bt709); xuất dự án 10 giây ra MP4, `ffprobe` cho 1920x1080, 30fps, 300 khung, không có stream audio; hình xuất không bị lật ngược, màu khớp xem trước.

> **Điểm dừng M1:** chủ dự án chạy thử, xem độ đẹp và đo tốc độ xuất trên máy mình.

## M2 – Đủ nội dung

### [ ] T11 – Camera 2.5D (4 preset)
- Cần trước: T07
- Làm: `engine/motion/camera25d.ts`: dolly-in, dolly-out, pan-left/right, tilt theo EFFECTS mục 2, tự tính scale phủ kín.
- Xong khi: test: ở khung đầu, giữa, cuối của mỗi preset với intensity 1, bốn góc màn hình đều rơi vào ảnh (raycast hoặc tính hình học); xem trước có cảm giác chiều sâu.

### [ ] T12 – Thêm 9 transition
- Cần trước: T08
- Làm: port 9 transition còn lại trong bảng EFFECTS mục 1, thời lượng mặc định, credit từng tác giả vào ASSETS.md.
- Xong khi: mỗi transition có test compile shader (hoặc render 1 khung ở progress 0, 0.5, 1 không lỗi); ở progress 0 ra đúng ảnh A, ở 1 ra đúng ảnh B (sai số nhỏ); ảnh GIF/khung mẫu trong PR.

### [ ] T13 – 4 film look còn lại [DUYỆT]
- Cần trước: T09
- Làm: preset `16mm`, `35mm`, `faded70s`, `bw-classic` theo EFFECTS mục 3.2. Hoàn thiện halation/bloom nếu T09 làm đơn giản. Bộ chọn look trên UI.
- Xong khi: khung so sánh 5 look trên cùng một ảnh trong PR; xem trước 1 transition + `35mm` vẫn ≥ 30fps ở chế độ Tự động trên máy dev.

### [ ] T14 – Chữ tiếng Việt
- Cần trước: T06
- Làm: tải 4 font ở EFFECTS mục 4 vào `assets/fonts/` (kèm file giấy phép OFL), rasterize chữ, 4 animation, neo vị trí, nhập chữ trong Inspector.
- Xong khi: chuỗi test tiếng Việt trong EFFECTS hiển thị đủ dấu với cả 4 font (ảnh chụp trong PR); typewriter không tách dấu khỏi chữ (test grapheme); ASSETS.md có font + giấy phép.

### [ ] T15 – ProRes 422 HQ và DNxHR HQ
- Cần trước: T10
- Làm: thêm 2 định dạng vào ffmpeg-args và hộp thoại xuất (đuôi .mov).
- Xong khi: test tham số; ffprobe file ProRes ra `prores` profile HQ, yuv422p10le; DNxHR ra `dnxhd` dnxhr_hq; cả hai 1920x1080 30fps không audio.

## M3 – Giao diện và luồng làm việc

### [ ] T16 – Giao diện chính
- Cần trước: T07, T08
- Làm: bố cục: kho ảnh (trái), xem trước (giữa), Inspector (phải), danh sách slide (dưới) kéo thả đổi thứ tự, xóa, nhân đôi. Inspector chỉnh thời lượng slide, motion, transition + thời lượng, chữ. Giao diện tiếng Việt, nền tối.
- Xong khi: tạo được dự án 10 slide hoàn toàn bằng chuột; đổi thứ tự thì xem trước cập nhật ngay; ảnh chụp màn hình trong PR.

### [ ] T17 – Lưu / mở / tự lưu / hoàn tác
- Cần trước: T03, T16
- Làm: Ctrl+S, Ctrl+O, Ctrl+Z, Ctrl+Y; tự lưu 30 giây; hỏi khi đóng mà chưa lưu; ảnh mất đường dẫn thì báo và cho chọn lại.
- Xong khi: test cho lịch sử hoàn tác (100 bước, nhánh mới xóa redo); lưu → đóng → mở lại cho dự án giống hệt.

### [ ] T18 – Độ dài cố định
- Cần trước: T04, T16
- Làm: hàm giải độ dài cố định (TEMPLATE_FORMAT mục 3) + nút chọn 10/15/20/30s/tự nhập.
- Xong khi: test: 12 ảnh với 15s, 8 ảnh với 30s, 40 ảnh với 10s (phải bỏ bớt ảnh, có báo) đều ra đúng tổng khung ±1.

### [ ] T19 – Phong cách và Quick Create
- Cần trước: T11, T12, T13, T14, T18
- Làm: `styles/memory.json`, `styles/film.json` theo TEMPLATE_FORMAT mục 4; nạp phong cách; Quick Create: chọn ảnh + phong cách + độ dài → dựng dự án (không lặp transition liền nhau, tiêu đề slide đầu nếu có).
- Xong khi: test: cùng seed cùng ảnh → cùng dự án; không có 2 transition giống nhau liền kề; video mẫu 15s mỗi phong cách trong PR. [DUYỆT]

### [ ] T20 – Xuất hàng loạt
- Cần trước: T15, T19
- Làm: hộp thoại batch (TEMPLATE_FORMAT mục 5), hàng đợi job trong main, tiến độ từng clip, hủy cả hàng đợi, đặt tên theo mẫu.
- Xong khi: thư mục 60 ảnh → 4 clip 15s ProRes, tên đúng mẫu, mỗi clip qua ffprobe; test chia nhóm ảnh và đặt tên.

### [ ] T21 – Chế độ chất lượng xem trước
- Cần trước: T13
- Làm: Đầy đủ / Nửa / Tự động (ARCHITECTURE mục 4), hiện fps thực. Xử lý mất WebGL context (dựng lại tài nguyên).
- Xong khi: chế độ Tự động tự xuống Nửa khi fps < 28 trong 1 giây; giả lập mất context (`WEBGL_lose_context`) thì app tự phục hồi, không mất dự án.

## M4 – Chốt bản MVP

### [ ] T22 – Ghi công và giấy phép trong app
- Cần trước: T12, T14
- Làm: tạo `THIRD_PARTY_NOTICES.md` từ ASSETS.md; mục "Giới thiệu" trong app hiển thị nội dung đó.
- Xong khi: mọi mục trong ASSETS.md có trong notices; mở được từ menu.

### [ ] T23 – Kiểm thử đầu-cuối tự động
- Cần trước: T15, T19
- Làm: script `npm run e2e:export` dựng một dự án mẫu từ ảnh sinh sẵn (không dùng ảnh cá nhân), xuất 10s MP4 + ProRes, kiểm bằng ffprobe.
- Xong khi: script chạy xanh trên máy dev; hướng dẫn chạy ghi trong README.

---

## Stretch (chỉ làm khi M0–M4 xong)

### [ ] S01 – Phong cách Polaroid
- Cần trước: T19
- Xong khi: khung trắng có bóng đổ, ảnh bay vào đè ảnh cũ; video mẫu 15s. [DUYỆT]

### [ ] S02 – Phong cách Mosaic
- Cần trước: T19
- Xong khi: lưới 2x2 / 3x3 ảnh xuất hiện lệch thời gian; video mẫu 15s. [DUYỆT]

### [ ] S03 – Thêm film look (instant, disposable90s, sepia, vhs, bleach)
- Cần trước: T13
- Xong khi: khung so sánh trong PR. [DUYỆT]

### [ ] S04 – Transition overlay tự viết (light leak, film burn flash)
- Cần trước: T12
- Xong khi: 2 transition mới, thủ tục hoàn toàn, không dùng video ngoài.

### [ ] S05 – Tùy chọn 25fps
- Cần trước: T10
- Xong khi: chỉ đổi hằng số FPS thành tùy chọn của dự án, ffprobe ra 25fps. Cần ghi quyết định vào DECISIONS.md trước.

---

## Ghi chú phát sinh

(Coder và reviewer ghi lỗi hoặc ý tưởng ngoài phạm vi vào đây, một dòng mỗi mục, kèm mã việc liên quan.)
