# FrameSlide – hướng dẫn cho Claude

FrameSlide là app Windows làm **B-roll slideshow ảnh** (không tiếng) để chèn vào phim cưới, sự kiện, year end party. Nhẹ như ProShow, đẹp gần template After Effects: Ken Burns / camera 2.5D, transition GPU, chữ tiếng Việt, và film look xưa. **Mọi tính năng đều là tùy chọn** người dùng bật/tắt (film look bật sẵn mặc định). Xuất **1920x1080, 30fps** ra MP4 / ProRes 422 HQ / DNxHR HQ.

Chủ dự án nói tiếng Việt. **Luôn trả lời, viết PR và commit message bằng tiếng Việt.** Tên biến, hàm, file trong code dùng tiếng Anh.

## Đọc gì trước khi làm

| File | Khi nào đọc |
|---|---|
| `docs/PLAN.md` | **Luôn đọc đầu tiên.** Danh sách việc, trạng thái, tiêu chí xong. |
| `docs/SPEC.md` | Phạm vi, cái gì làm và **không làm**. |
| `docs/ARCHITECTURE.md` | Cấu trúc thư mục, luồng dựng hình, luồng xuất video. |
| `docs/TEMPLATE_FORMAT.md` | Khi đụng tới file dự án, phong cách, kiểu dữ liệu. |
| `docs/EFFECTS.md` | Khi làm transition, chuyển động, film look, chữ. |
| `docs/DECISIONS.md` | Trước khi đề xuất đổi công nghệ hay phạm vi. Cái đã bỏ thì không đề xuất lại. |
| `docs/ASSETS.md` | Khi thêm bất kỳ shader, font, LUT, texture, thư viện nào từ ngoài. |

## Công nghệ (đã chốt, xem DECISIONS.md)

- Electron + electron-vite, TypeScript strict, React cho UI.
- Three.js (WebGL2) để dựng hình. Shader GLSL ES 3.0.
- FFmpeg đóng gói sẵn (`ffmpeg-static`) để mã hóa video, chạy ở main process.
- `sharp` để tạo ảnh làm việc (proxy) khi nhập. `zod` để kiểm tra JSON dự án.
- Vitest cho test.

**Không tự thêm thư viện** ngoài danh sách trong `docs/ARCHITECTURE.md` mục "Thư viện được phép". Cần thêm thì ghi lý do vào PR và DECISIONS.md, để reviewer duyệt.

## Lệnh

```bash
npm install          # cài
npm run dev          # chạy app ở chế độ phát triển
npm run typecheck    # kiểm tra kiểu TypeScript
npm test             # chạy Vitest một lần
npm run build        # build production (chưa đóng gói installer)
```

Trước khi báo xong một việc: `npm run typecheck && npm test && npm run build` phải qua hết.

## Quy tắc code

- Hằng số đầu ra nằm một chỗ: `src/shared/constants.ts` (`WIDTH=1920`, `HEIGHT=1080`, `FPS=30`). Không hard-code ở chỗ khác.
- `src/engine/` là code thuần (TypeScript + three), **không import Electron, Node hay React**. Phải test được trong Vitest.
- Dựng hình là **hàm của thời gian**: `renderFrame(project, frameIndex)` cho cùng kết quả mỗi lần gọi. Mọi ngẫu nhiên (grain, bụi, rung khung) dùng PRNG có seed theo `project.look.seed` và `frameIndex`. Không dùng `Math.random()` hay `Date.now()` trong engine.
- Xem trước và xuất video dùng **chung** code dựng hình. Không viết hai bản.
- **Mọi tính năng là tùy chọn**: film look, chuyển động, transition, chữ, chia khung đều tắt được. Tắt thì engine bỏ qua pass đó (không tốn GPU). Film look **bật sẵn** khi tạo dự án mới.
- Không có audio ở bất cứ đâu. FFmpeg luôn chạy với `-an`.
- Giải phóng texture/render target khi không dùng (`dispose()`). Không giữ ảnh gốc độ phân giải đầy trên GPU.
- Chữ hiển thị trong UI viết bằng tiếng Việt có dấu.
- File mới cần test nếu có logic (tính thời lượng, easing, parse JSON, dựng lệnh FFmpeg...). Shader thì test bằng render thử ra pixel khi làm được.

## Quy trình làm việc: hai luồng

Dự án chạy bằng hai luồng Claude tách biệt. Mỗi phiên có thể bị ngắt bất cứ lúc nào (hết giới hạn), nên **mọi trạng thái nằm trên GitHub và trong `docs/PLAN.md`**, không nằm trong trí nhớ phiên.

### Luồng CODER (làm việc mới)

1. `git fetch` rồi đứng trên `main` mới nhất. Đọc `docs/PLAN.md`.
2. Xem các PR đang mở. PR có tiêu đề bắt đầu bằng mã việc (ví dụ `T05:`) nghĩa là việc đó đang làm, **không làm trùng**.
3. Chọn việc `[ ]` đầu tiên theo thứ tự trong PLAN.md mà mọi việc ở cột "Cần trước" đã là `[x]` trên `main`. Nếu không còn việc nào đủ điều kiện, dừng và báo đang chờ PR nào được merge.
4. Tạo nhánh `task/T05-ten-ngan` từ `main` (nếu môi trường bắt buộc tên nhánh khác thì dùng tên đó).
5. Chỉ làm đúng phạm vi việc đó. Thấy lỗi hay ý tưởng ngoài phạm vi thì ghi vào mục "Ghi chú phát sinh" cuối PLAN.md, không tự làm.
6. Chạy typecheck, test, build. Sửa tới khi qua.
7. Trong cùng PR, đổi `[ ]` của việc đó thành `[x]` trong PLAN.md.
8. Mở PR: tiêu đề `T05: <tên việc>`, thân PR liệt kê từng tiêu chí xong và cách đã kiểm tra, kèm ảnh chụp nếu là việc hình ảnh.
9. Sang việc tiếp theo (quay lại bước 1). Mỗi PR chỉ một việc.

Nếu phiên trước bị ngắt giữa chừng: nhánh `task/Txx-...` đã có commit nhưng chưa có PR thì tiếp tục trên nhánh đó.

### Luồng REVIEWER (duyệt, sửa, merge)

1. Lấy các PR đang mở có tiêu đề `Txx:`, làm từ PR cũ nhất.
2. Checkout nhánh PR, chạy `npm ci && npm run typecheck && npm test && npm run build`.
3. Đối chiếu từng tiêu chí xong trong PLAN.md. Soát lỗi: đúng hằng số 1080p30, không `Math.random`, có `dispose`, không thêm thư viện lạ, film look không tắt được, không có audio.
4. Có lỗi nhỏ thì **sửa thẳng trên nhánh PR**, commit rõ "Reviewer: sửa ...". Lỗi lớn hoặc sai hướng thì ghi nhận xét và để PR mở.
5. Qua hết thì squash merge vào `main`. Nếu xung đột ở PLAN.md, giữ mọi dấu `[x]` của cả hai phía.
6. Không bao giờ merge PR mà test đỏ. Không xóa hay tắt test để cho qua.

### Điểm duyệt của chủ dự án

Việc có ghi **[DUYỆT]** trong PLAN.md cần chủ dự án xem bằng mắt. Reviewer vẫn merge được nếu kỹ thuật đúng, nhưng ghi rõ trong PR "chờ anh duyệt hình" và không coi phong cách đó là chốt.

## Không được làm

- Không làm nhạc, beat sync, 4K, khung dọc, mở file .aep, installer (để sau). Xem SPEC.md.
- Không sao chép template hay tài nguyên Motion Array, không sao chép look của Resolve/Retrograde, không dùng tên thương hiệu phim (Kodak, Fuji...) làm tên look.
- Không commit ảnh cá nhân, file video xuất ra, hay `node_modules`.
- Không đổi công nghệ đã chốt mà không có quyết định mới trong DECISIONS.md.
