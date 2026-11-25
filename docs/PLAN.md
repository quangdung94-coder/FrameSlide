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
> Làm theo thứ tự. Mỗi mục một PR nhỏ: tự rà diff → sửa lỗi → typecheck + test + build + CI Windows đạt → gộp vào main. Mỗi tính năng mới là công tắc tùy chọn, film look bật sẵn, Full HD 30fps. Không đóng gói .exe. Đợt 4 được anh Dũng duyệt ngày 25/11/2026 (S7, S8, S9, U9); S10, S12, U10 để sau Bản 1. Nếu bị ngắt giữa chừng, tiếp tục từ mục `[ ]` đầu tiên.

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

### Dọn code trước Đợt 4 (anh Dũng yêu cầu 25/11/2026: refactor, module hóa, tăng reuse; không đổi hành vi)
- [x] Dọn 1 (PR #28): `engine/num.ts` (clamp, normalizeByLimits…) + `computeProjectDurationSec` dùng chung.
- [x] Dọn 2 (PR #29): `App.tsx` 2.327 → 503 dòng; tab Dự án ở `components/inspector/`, hộp thoại/thanh công cụ thành component riêng; hook `useExportJobs`, `useKeyboardShortcuts`, `usePreviewEngine`, `useProjectFiles`; `ui.tsx` có `SelectField`, `TextField`, `CheckField`, `Modal`.
- [x] Dọn 3 (PR #30): `engine/objectUtils.ts` (omitKeys, withOptional, mapById), `cloneScene` (nhân bản scene copy sâu mọi thiết lập), `store/storeHelpers.ts` (undo/redo, mergeRenderParams, preset).

### Đợt 4: Scene sống động hơn
- [x] 4.1 **S7:** ảnh trong scene 2–4 ảnh xuất hiện lần lượt (Mờ dần / Trượt lên / Phóng ra; độ trễ giữa các ảnh, thời gian hiện). (`SceneItem.stagger` + `src/engine/stagger.ts`; thời gian tính từ lúc scene bắt đầu hiện (`TimelineState.sceneTimeA/B`), nên preview và xuất khớp; uniform `uStaggerA/B`, không thêm điểm gọi `compositeCard`; đi theo phần "Chuyển động" khi sao chép/dán và khi nhân bản scene.)
- [x] 4.2 **S8:** chữ có chuyển động riêng (mờ vào, gõ máy chữ, trượt lên), kéo vị trí trên khung xem, thời điểm vào/ra trong scene. (`TextOverlayConfig.animation` + `offset`; `SceneItem.captionTiming` + `captionOffset` cho chú thích riêng từng scene; logic thuần `src/engine/textAnimation.ts`; gõ máy chữ vẽ lại chữ chỉ khi số ký tự đổi, cắt theo cả chữ cái nên dấu tiếng Việt không vỡ; vị trí kéo và trượt lên dời chữ trong shader (`uTextOffset`) nên không phải vẽ lại; tab Chữ có "Chuyển động khi chữ hiện ra" và nút "✥ Kéo chữ trên khung xem"; bảng Scene có "Chữ hiện từ giây / ẩn lúc giây". Mặc định "Mờ vào" giữ đúng cách hiện chữ cũ.)
- [x] 4.3 **S9:** Scene Style: lưu scene thành mẫu (bố cục + chuyển động + nền + chữ) áp cho scene khác; mẫu có sẵn Mở đầu, Kết thúc, Chân dung đôi, Lưới kỷ niệm.
- [x] 4.4 **U9:** Template & Look có hình xem trước khi rê chuột; lưới 2 cột.


---

## Bước 5d: Góp ý giao diện đợt 5 của anh Dũng (25/11/2026)
> Kế hoạch chi tiết: `research/ke-hoach-dot-5-gop-y-giao-dien.html` (thư mục dự án). Mỗi mục một PR nhỏ: tự rà diff → typecheck + test + build + CI Windows đạt → gộp. Mọi tính năng là tùy chọn, film look bật sẵn, Full HD 30fps. Không đóng gói .exe. Anh Dũng duyệt Đợt 5.1 ngày 25/11/2026; các đợt sau chờ anh chọn.

### Đợt 5.1: Phát và thời gian
- [x] 5.1a **Space phát ngay:** sau khi kéo playhead, Space vẫn phát/dừng. (Nguyên nhân: thanh tua là `<input type="range">`, phím tắt bỏ qua mọi ô INPUT/SELECT. Nay chỉ ô gõ chữ thật mới chặn phím tắt; thanh trượt, ô chọn, nút bấm vẫn cho Space và F; logic trong `hooks/keyTarget.ts`. Thả chuột khỏi thanh tua thì trả bàn phím về app.)
- [x] 5.1b **J/K/L, tốc độ, lặp:** J phát lùi, K dừng, L phát tới, bấm lại để tăng 2× → 4×; giữ K + J/L đi từng frame; ô tốc độ 0.25×–4×; nút lặp (bật sẵn như cũ; tắt thì phát hết clip sẽ dừng). Chỉ ảnh hưởng xem trước. (Logic thuần `engine/playback.ts`; `playbackRate`/`playDirection`/`loopPlayback` trong store, không lưu vào file dự án; file xuất vẫn render từng frame theo thứ tự.)
- [x] 5.1c **Thanh phát và thời gian:** nút ▶ tròn to, nút về đầu/cuối, thời gian một dòng (phút:giây:frame), scene đang phát, thước chia giây. (Biểu tượng nút là SVG nên không bị Windows đổi thành emoji; bấm vào đồng hồ để đổi phút:giây:frame ↔ phút:giây; thước tự chọn bước 1/2/5/10… giây, tối đa 12 nhãn; logic `engine/timecode.ts`.)

### Đợt 5.2: Làm nhanh nhiều scene (anh Dũng duyệt 25/11/2026)
- [x] 5.2a **Motion tự động:** nút "🎬 Motion tự động ▾" trên dải scene: Theo bố cục (đề xuất) / Xoay vòng / Ngẫu nhiên; không lặp cùng mẫu ở 2 scene liền nhau; giữ nguyên scene đã chọn tay; Ctrl+Z hoàn tác; có lệnh đưa scene tự động về "Theo dự án". (Logic thuần `engine/autoMotion.ts`; scene do máy chọn có `SceneItem.motionAuto`, chọn tay hoặc dán thiết lập thì bỏ cờ này. Kết quả ghi vào `motionTemplate` nên xem trước và xuất khớp.)
- [x] 5.2b **Dải scene:** Ctrl + lăn chuột để zoom; lăn chuột thường cuộn ngang; nút Ngang / Lưới / Vừa khung. (Lưu chế độ trên máy cùng bố cục, `useLayoutStore.sceneTrackMode`; "Vừa khung" chuyển sang Lưới và chọn zoom lớn nhất mà thấy hết scene (`components/sceneTrackFit.ts`); zoom nhỏ thì nút chuyển cảnh chỉ còn ⇄, thẻ không hẹp hơn 156px.)
- [x] 5.2c **In/Out:** phím I / O (hoặc nút In / Out trên thanh phát) đặt điểm vào/ra, Alt+X xóa; chuột phải thẻ scene "Đặt In / Out theo scene này"; vùng In–Out tô vàng trên thanh tua, lặp chỉ trong vùng khi playhead ở trong; hộp thoại Xuất chọn Toàn bộ clip / Đoạn In–Out / Scene đang chọn, tên file thêm `_00m06s-00m16s`. (Logic `engine/frameRange.ts`; exporter giữ số frame gốc nên hạt phim/bụi/rung khớp xem trước; In/Out lưu trong file dự án (`markIn`/`markOut`); Fade In/Out vẫn theo đầu/cuối cả clip; Batch Export luôn xuất toàn bộ.)

### Đợt 5.3: Giao diện gọn (anh Dũng duyệt 25/11/2026)
- [x] 5.3a **Đồng bộ font và cỡ chữ:** font đóng gói trong app (D26), thang cỡ chữ 11/12/13/15px, bỏ cỡ lạ 8/10px, ô số rộng hơn cho font số mới; chờ font tải xong mới vẽ chữ vào video.
- [x] 5.3b **Nút ⚙ Cài đặt:** thư mục cache, dung lượng, xóa cache (giữ ảnh của dự án đang mở); cỡ proxy 2560/2880/3200; mặc định dự án mới (fps, tỷ lệ, thời lượng scene, Film Look) và chu kỳ tự lưu. Đổi thư mục cache có hiệu lực ở lần mở app sau.
- [x] 5.3c **Thanh chỉnh ảnh ra ngoài khung xem:** dải công cụ cố định ngay trên khung xem, có số và tên ảnh, nút to hơn, độ sáng hiện số EV; khi chỉnh ảnh, các ô X/Y/Zoom/Xoay cũng nằm trên dải này nên không che hình nữa. Bấm lại "Chỉnh" hoặc "Xong" để thoát.
- [x] 5.3d **Crop có lưới kiểu Photoshop:** nút "⬚ Crop" trên dải công cụ; hiện cả ảnh (thu nhỏ khung xem để thấy phần tràn ra ngoài ô), vùng ngoài khung tối đi; khung crop khóa đúng tỷ lệ ô ảnh; kéo cạnh/góc để cắt, kéo bên trong để dời, kéo bên ngoài khung để xoay (Shift: bước 15°); lưới Một phần ba / Lưới / Đường chéo / Tỷ lệ vàng; "Làm thẳng" kéo một đường theo chân trời; Enter áp dụng, Esc hủy, Ctrl+Z hoàn tác. Kết quả ghi vào transform có sẵn (vị trí/zoom/xoay; theo tư thế Đầu/Cuối nếu có keyframe), nên xem trước và xuất không đổi gì. (Logic thuần trong `engine/photoTransform.ts`, test `photoCrop.test.ts`.)

### Đợt 5.4: Chữ và nền (anh Dũng duyệt 25/11/2026)
- [x] 5.4a **Chữ riêng từng scene:** bảng Scene › "Chữ của scene" chọn Theo dự án / Riêng / Tắt chữ. "Riêng" có kiểu chữ, chuyển động, tiêu đề, phụ đề riêng, hiện trong scene đó với thời điểm và vị trí riêng (kéo chữ được), kể cả khi chữ dự án đang tắt. Dán thiết lập "Chữ" và Scene Style mang theo kiểu chữ, không mang nội dung. (Logic `engine/sceneText.ts`, `SceneItem.text`; D27 sửa D23.)
- [x] 5.4b **Bảng chữ kiểu Premiere/CapCut:** nhóm "Font · cỡ · màu · viền · bóng" ở tab Chữ (cả dự án) và trong chữ "Riêng" của scene: 7 font tiếng Việt đóng gói (mỗi tên hiện bằng chính font đó), cỡ 40–250%, đậm/nghiêng, canh trái/giữa/phải, khoảng cách chữ, màu (ô màu, mã hex, 8 màu nhanh), viền + màu viền, bóng Theo kiểu/Không/Mềm/Đậm; mọi mục có "theo kiểu". (Logic `engine/textLook.ts`, `TextOverlayConfig.look`, `SceneTextOverride.look`; D28.)
- [x] 5.4c **Nền mờ:** nền "Ảnh mờ" có 5 kiểu (Mờ mịn, Mờ phóng, Mờ chuyển động, Kính mờ, Mờ tối viền), thanh Độ mờ, Độ tối, Phóng nền; áp cho cả dự án hoặc một scene. Mặc định giữ độ tối/phóng như cũ. (Bản mờ nhỏ tạo sẵn cho từng ảnh: `engine/backgroundBlur.ts`, `BlurredBackgroundCache.ts`; D29.)

### Đợt 6: Góp ý 25/11/2026 tối (anh Dũng duyệt làm theo thứ tự 3 → 2 → 1)
- [x] 6.3 **Mở app nhanh, không còn cửa sổ cmd:** "Mo FrameSlide (an).vbs" chạy ẩn bước kiểm tra (lấy bản mới, xem có cần cài thư viện / build lại không); nếu đã sẵn sàng thì mở thẳng bản đã build bằng Electron (không bật máy chủ dev). Chỉ khi có bản mới mới hiện cửa sổ tiến trình, build xong tự đóng. Commit đã build ghi ở `out/.build-commit`.
- [x] 6.2 **Chọn nhiều scene:** Shift + click chọn dải, Ctrl + click thêm/bớt; xóa nhiều scene một lần (Delete, chuột phải, nút trên dải scene); Ctrl+Z một lần lấy lại hết.
- [ ] 6.1 **Sắp lại hộp Xuất video:** "Lưu vào" (thư mục + tên file) lên đầu, chọn phần xuất, chọn định dạng, tùy chọn, một nút Xuất có tóm tắt; Batch là tab dùng chung thư mục.
