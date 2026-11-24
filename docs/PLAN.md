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
- [x] 5. **Chỉnh ảnh trực tiếp trên khung giữa:** kéo đổi position, scale, rotation; tay nắm + ô số; nút đặt lại. (Nút "✥ Chỉnh ảnh" trên khung xem: kéo khung để di chuyển, tay nắm tròn để xoay, tay nắm vuông hoặc lăn chuột để phóng to; ô số X/Y/Zoom/Xoay; lưu theo từng ảnh trong `SlideAsset.transform`.)
- [x] 6. **Nền sau scene 2–4 ảnh:** nền trơn, gradient (nhiều mẫu, chỉnh màu và góc), ảnh mờ, họa tiết; áp cho một scene hoặc cả dự án. (8 mẫu gradient; 4 họa tiết chấm bi/sọc chéo/kẻ ô/quả trám; họa tiết tĩnh nên preview và export khớp nhau; cấu hình trong `src/engine/background.ts`.)
- [x] 7. **Thẻ scene nhiều ảnh:** ô nhỏ đúng kiểu chia khung (2 ảnh cạnh nhau, 4 ảnh lưới 2x2), số thứ tự, kéo thả đổi chỗ. (Khung mini theo đúng tỉ lệ xuất và vị trí ô thật trong shader — `src/engine/layoutGeometry.ts`.)
- [x] 8. **Nhập thư mục:** không tự thêm tất cả ảnh vào timeline; ảnh chỉ vào khay; thêm nút "Thêm ảnh đã chọn" và "Thêm cả thư mục". (Ảnh mẫu vẫn tự dựng timeline để thử nhanh; "Thêm cả thư mục" = mọi ảnh chưa dùng trong khay, sẽ tách theo từng thư mục ở mục 1.)

---

## Bước 5c: Nâng cấp UX/UI và Scene (căn cứ `research/bao-cao-ux-ui-va-scene.md`, 24/11/2026)
> Làm theo thứ tự. Mỗi mục một PR nhỏ: tự rà diff → sửa lỗi → typecheck + test + build + CI Windows đạt → gộp vào main. Mỗi tính năng mới là công tắc tùy chọn, film look bật sẵn, Full HD 30fps. Không làm Đợt 4 và không đóng gói .exe. Nếu bị ngắt giữa chừng, tiếp tục từ mục `[ ]` đầu tiên.

### Đợt 1: Dễ bấm, dễ hiểu
- [x] 1.1 **U3 + U2:** cỡ chữ/nút tối thiểu (chữ ≥12px, nút ≥28px, thanh trượt dày hơn, ô số gõ trực tiếp); nhóm thu gọn (accordion) có công tắc bật/tắt và nút ⟲ đặt lại, nhớ nhóm đang mở. (Component dùng chung `components/ui.tsx`: `Group`, `SliderRow` có ô số; chữ ≥12px; Look chia nhóm Màu / Ánh sáng / Hạt & Bụi / Rung & Nháy / Khung phim.)
- [x] 1.2 **U4 + U5:** thẻ scene gọn (nút ◀ ▶ ⧉ ✕ chuyển vào nút "⋯") và menu chuột phải cho thẻ scene, ô ảnh, khay ảnh. (`components/ContextMenu.tsx`; ô thời lượng rộng hơn; thêm `insertSceneAt`; nhân bản scene giữ cả nền riêng.)
- [x] 1.3 **U8:** phím tắt mới (Ctrl+D, Ctrl+Shift+C/V, Home/End, Ctrl+N, 1–4, T, Ctrl+E) + cập nhật bảng phím `?`. (`T` mở bảng chuyển cảnh của scene đang chọn; `Ctrl+E` mở bảng Xuất, không tự bắt đầu render.)
- [x] 1.4 **S1:** sao chép / dán thiết lập scene (chọn phần: bố cục, thời lượng, chuyển động, nền, chuyển cảnh, chữ; menu "Dán chỉ: …"). Logic thuần trong `src/engine/sceneSettings.ts`; bộ nhớ tạm không vào file dự án.

### Đợt 2: Bảng theo ngữ cảnh
- [x] 2.1 **U1:** bảng phải đổi theo lựa chọn (Dự án / Scene / Ảnh) + breadcrumb `Dự án › Scene 2 › Ảnh 1`. (`ScenePanel.tsx`, `PhotoPanel.tsx`; bấm thẻ scene → bảng Scene, bấm ảnh → bảng Ảnh, bấm breadcrumb để đổi; bảng Dự án giữ 4 tab; khi xuất thì tự về tab Xuất.)
- [x] 2.2 **U7 + U6:** thanh nổi trên khung xem khi chọn ảnh; thanh trên cùng chia 3 cụm, nút "Nhập" thả xuống, nút "Xuất" nổi bật mở hộp thoại Xuất. (Thanh nổi: Chỉnh / Tâm / 90° / ☀− / ☀+ / ⟲; nút "+ Nhập ▾" gồm Chọn ảnh, Chọn thư mục, Ảnh mẫu; tab Xuất đã chuyển thành hộp thoại, `Ctrl+E` hoặc bấm XUẤT; hộp thoại tự mở khi bắt đầu xuất.)

### Đợt 3: Scene mạnh hơn (học ProShow)
- [x] 3.1 **S2:** Motion Template riêng từng scene ("Theo dự án" là mặc định). (`SceneItem.motionTemplate`; shader có thêm `uMotionStyleB` để scene A và B khi chuyển cảnh dùng đúng template của mình; lưu trong file dự án, nhân bản và sao chép/dán theo phần "Chuyển động".)
- [x] 3.2 **S3:** Keyframe Đầu/Cuối cho từng ảnh (vị trí, zoom, xoay; làm mượt Đều/Êm/Tăng/Giảm tốc; Đổi chiều, Copy Đầu→Cuối), tính theo `frameIndex`. (`SlideAsset.transformEnd` + `keyframeEase`; logic thuần `src/engine/photoKeyframes.ts` dùng `motionProgress` của timeline nên preview và xuất khớp; bảng Ảnh › "Chuyển động Đầu → Cuối" có 2 khung nhỏ Đầu/Cuối, Đổi chiều, Đầu → Cuối, Nối với scene trước; khi chỉnh trên khung xem có tab Đầu/Cuối, preview ghim đúng tư thế đang chỉnh.)
- [x] 3.3 **S4 + S5 + S6** (làm thành 3 PR nhỏ):
  - [x] 3.3a **S6:** thời lượng chuyển cảnh riêng từng scene (`SceneItem.transitionDurationSec`, `evaluateTimeline` nhận `transitionDurations`; chưa làm "hướng" riêng vì các kiểu chuyển cảnh đã có sẵn bản trái/phải).
  - [x] 3.3b **S4:** chỉnh màu riêng từng ảnh (tương phản, bão hòa, ấm/lạnh, độ mờ) + công tắc "Bỏ qua Film Look cho scene này". (`SlideAsset.adjust` + `src/engine/photoAdjust.ts`, tính trong shader theo từng ô, không thêm điểm gọi hàm nặng; `SceneItem.filmLookOff` làm mờ dần Film Look/LUT, mượt khi chuyển cảnh; dán thiết lập có thêm phần "Film Look".)
  - [x] 3.3c **S5:** viền, bóng đổ, bo góc, làm mờ cạnh cho ô ảnh trong scene 2–4 ảnh. (`SceneItem.cardStyle` + `src/engine/cardStyle.ts`, uniform `uCardStyleA/B` trong `compositeCard`, không thêm điểm gọi hàm nặng; có trong sao chép/dán thiết lập (phần "Khung ảnh") và nhân đôi scene.)
