# ARCHITECTURE – FrameSlide

## 1. Tổng quan

```
┌──────────────── Electron ─────────────────────────────────────────┐
│ Main process (Node)                Renderer process (Chromium)    │
│  - cửa sổ, menu, IPC               - UI React                     │
│  - đọc/ghi file, dự án             - engine (Three.js, WebGL2)    │
│  - sharp: proxy, thumbnail           renderFrame(project, frame)  │
│  - FFmpeg: nhận khung hình  ◄──────  đọc pixel từng khung khi xuất│
│    qua stdin, mã hóa video   IPC                                  │
└───────────────────────────────────────────────────────────────────┘
```

Nguyên tắc: **engine là hàm thuần của thời gian**. Xem trước gọi `renderFrame` theo đồng hồ thật; xuất video gọi lần lượt từ khung 0 tới khung cuối, không bao giờ bỏ khung.

## 2. Thư mục

```
src/
  shared/          kiểu dữ liệu, zod schema, constants.ts (1920, 1080, 30), tiện ích thời gian
  engine/          KHÔNG import electron/node/react
    timeline.ts    tính slide nào đang hiện ở khung n, tiến độ transition, giải độ dài cố định
    random.ts      PRNG có seed (mulberry32), hash(seed, frame)
    easing.ts
    motion/        kenburns.ts, camera25d.ts
    transitions/   registry.ts, glsl/*.glsl (bản port từ GL Transitions), wrapper
    looks/         pipeline.ts (chuỗi hậu kỳ), passes/*.glsl, presets.ts
    text/          rasterize chữ bằng canvas 2D → texture, animations.ts
    textures.ts    nạp/giải phóng texture theo cửa sổ thời gian
    renderer.ts    tạo WebGLRenderer, render target, renderFrame()
  main/            Electron main: index.ts, ipc.ts, import.ts (sharp), export.ts (ffmpeg), project-io.ts
  preload/         cầu IPC an toàn (contextBridge), có kiểu
  renderer/        UI React: PhotoBin, SlideList, Preview, Inspector, ExportDialog, BatchDialog
styles/            phong cách dựng sẵn (*.json) – xem TEMPLATE_FORMAT.md
assets/fonts/      font OFL có dấu tiếng Việt
assets/luts/       LUT tự làm (.cube) nếu dùng
tests/             test Vitest (engine, shared, main/ffmpeg-args)
docs/
```

## 3. Dữ liệu

- File dự án `.fslide` là JSON theo `TEMPLATE_FORMAT.md`, kiểm bằng zod khi mở. Đường dẫn ảnh lưu tuyệt đối kèm hash để tìm lại.
- Cache proxy: `%APPDATA%/FrameSlide/cache/<hash>/work.jpg` (cạnh dài 3200px) và `thumb.jpg` (320px). Ảnh gốc không bao giờ bị sửa.
- Tự lưu: ghi `.fslide.autosave` cạnh file dự án mỗi 30 giây khi có thay đổi.
- Hoàn tác: lưu lịch sử bản chụp state dự án (immutable), tối đa 100 bước.

## 4. Dựng hình (engine)

Mỗi khung `n` (thời điểm `t = n / 30`):

1. `timeline` trả về slide A (và slide B nếu đang trong transition) cùng `progress` 0..1.
2. Dựng **slide A** vào render target RT_A (1920x1080): mặt phẳng ảnh trong cảnh Three.js, camera theo motion (Ken Burns = camera trực giao + crop; 2.5D = camera phối cảnh dịch chuyển). Chữ của slide vẽ đè trong cùng cảnh.
3. Nếu có B: dựng vào RT_B, rồi chạy shader transition (A, B, progress) vào RT_MIX.
4. Chạy **chuỗi film look** trên RT_MIX → màn hình (xem trước) hoặc RT_OUT (xuất).
5. Xuất: `readPixels` RT_OUT (RGBA8) → gửi buffer qua IPC sang main → ghi vào stdin FFmpeg.

Định dạng render target: dùng `HalfFloatType` cho các bước trung gian để tránh sọc màu; dither ở pass cuối trước khi về 8-bit.

Chế độ xem trước: Đầy đủ (1920x1080), Nửa (960x540 rồi phóng), Tự động (đo thời gian khung, tụt dưới 30fps thì xuống Nửa). Xuất luôn đầy đủ.

Texture: chỉ giữ trên GPU ảnh của slide hiện tại, slide trước và 2 slide kế. Giải mã trước bằng `createImageBitmap` ngoài khung chuyển cảnh. Xử lý `webglcontextlost`: dựng lại toàn bộ tài nguyên từ project state.

## 5. Xuất video

Main process chạy FFmpeg (`ffmpeg-static`):

```
ffmpeg -y -f rawvideo -pix_fmt rgba -s 1920x1080 -r 30 -i pipe:0 -an \
  -vf vflip?  (chỉ nếu readPixels trả về lộn ngược; tốt hơn là lật trong shader)
  <tham số codec> out.ext
```

| Định dạng | Tham số |
|---|---|
| MP4 H.264 | `-c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart` hoặc `-c:v h264_nvenc -preset p6 -cq 16 -pix_fmt yuv420p` |
| ProRes 422 HQ | `-c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -vendor apl0` → `.mov` |
| DNxHR HQ | `-c:v dnxhd -profile:v dnxhr_hq -pix_fmt yuv422p` → `.mov` |

Tất cả có `-color_primaries bt709 -color_trc bt709 -colorspace bt709`. Hàm dựng mảng tham số là hàm thuần trong `src/main/ffmpeg-args.ts` để test được. Có nút hủy (kill process, xóa file dở). Phát hiện NVENC bằng cách chạy thử `-f lavfi -i nullsrc -t 0.1 -c:v h264_nvenc -f null -`.

Có back-pressure: renderer chỉ dựng khung tiếp khi main báo đã ghi xong khung trước (hoặc hàng đợi < 8 khung).

Xuất hàng loạt: hàng đợi job trong main, mỗi job là một project đã dựng sẵn, chạy tuần tự.

## 6. Thư viện được phép

Runtime: `electron`, `react`, `react-dom`, `three`, `zod`, `sharp`, `ffmpeg-static`, `gl-transitions` (chỉ để lấy shader lúc build hoặc copy vào repo).
Dev: `electron-vite`, `vite`, `typescript`, `@types/*`, `vitest`, `@vitejs/plugin-react`, `electron-builder` (khi làm installer, sau MVP).

Thêm thư viện khác phải có lý do trong PR và một dòng trong DECISIONS.md.

## 7. Bảo mật Electron

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` cho renderer. Mọi truy cập file/FFmpeg đi qua preload API có kiểu rõ ràng.
