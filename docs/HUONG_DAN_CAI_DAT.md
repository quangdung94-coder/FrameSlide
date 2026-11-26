# Hướng dẫn cài đặt & sử dụng FrameSlide (Windows & macOS chip M)

## 1. Tải bản cài mới nhất
Vào trang **Releases**: https://github.com/quangdung94-coder/FrameSlide/releases → mở mục **"FrameSlide (bản mới nhất)"**.

| Hệ điều hành | File tải về | Ghi chú |
|---|---|---|
| **Windows 64-bit** | `FrameSlide-Setup-0.9.0.exe` | **Khuyên dùng.** Cài 1 lần, có icon trên Desktop & Start Menu, mở nhanh nhất. |
| **Windows 64-bit (không cài)** | `FrameSlide-Portable-0.9.0.exe` | Bấm đúp là chạy ngay, dễ chép USB gửi bạn bè (mở lần đầu chậm hơn vài giây). |
| **macOS chip M (M1/M2/M3/M4)** | `FrameSlide-0.9.0-arm64.dmg` | Dành cho máy Mac Apple Silicon (`arm64`). |

> **Không cần cài thêm Node.js hay FFmpeg.** App đã đóng gói sẵn FFmpeg bên trong để xuất H.264 / ProRes 422 / DNxHR HQ.

---

## 2. Hướng dẫn cài đặt

### Trên Windows
1. Bấm đúp `FrameSlide-Setup-0.9.0.exe`.
2. Nếu hiện bảng xanh **"Windows protected your PC"** (SmartScreen — do app cá nhân không ký số thương mại): bấm **More info** → **Run anyway**.
3. Chọn thư mục cài (để mặc định cũng được) → **Next** → **Install** → **Finish**.
4. Mở app từ biểu tượng **FrameSlide** ngoài Desktop.

### Trên macOS chip M (Apple Silicon)
1. Bấm đúp file `FrameSlide-0.9.0-arm64.dmg`.
2. Kéo biểu tượng **FrameSlide** thả vào thư mục **Applications**.
3. Lần đầu mở app, vì là phần mềm cá nhân không ký số Apple Developer nên macOS Gatekeeper thường chặn hoặc báo *"FrameSlide is damaged and can't be opened"*:
   - Mở ứng dụng **Terminal** (bấm `Cmd + Space`, gõ `Terminal`, nhấn Enter).
   - Dán đúng 1 dòng lệnh sau rồi nhấn **Enter**:
     ```bash
     xattr -cr /Applications/FrameSlide.app
     ```
   - Đóng Terminal và mở lại **FrameSlide** trong Applications là chạy bình thường.

---

## 3. Hướng dẫn sử dụng nhanh (7 bước làm slideshow)

### Bước 1: Nhập ảnh (1 thư mục hoặc nhiều thư mục cùng lúc)
- Bấm nút **+ Nhập** ở thanh trên cùng:
  - **Nhập 1 thư mục / chọn ảnh:** nạp ảnh vào tab dự án hiện tại.
  - **Nhập nhiều thư mục (nhiều dự án):** chọn nhiều thư mục con (ví dụ `01_DamCuoi`, `02_GiaDinh`, `03_DuLich`...), mỗi thư mục tự mở thành **1 Tab dự án riêng** ở thanh Tab phía trên.
- Ảnh gốc của khách **không bao giờ bị sửa hay xóa** — app chỉ tạo bản ảnh nhẹ (proxy) trong thư mục Cache để chạy mượt.

### Bước 2: Xem trước (Preview) & Thu phóng khung nhìn
- Khung giữa hiển thị video thực tế (WebGL2).
- Dùng nút **`-` / `+` / `Vừa`** (hoặc giữ **`Ctrl + cuộn chuột`**, trên Mac là `Cmd/Ctrl + cuộn chuột`) để phóng to/thu nhỏ khung Preview (`25% – 300%`).
- Nhấn **`F`** để xem toàn màn hình, **`Esc`** để thu lại.
- Giữ phím **`\`** để so sánh nhanh ảnh gốc trước và sau khi chỉnh màu (Before/After).

### Bước 3: Điều hướng bằng mũi tên Playhead & dải Scene
- Kéo **mũi tên Playhead (`▼`)** trên thanh thời gian để tua nhanh — app hiển thị rõ đang ở **Scene nào** (`S1`, `S2`,...) và tự cuộn dải Scene phía dưới theo vị trí Playhead.
- Trên từng thẻ Scene có vạch tiến độ dọc giúp dễ canh nhịp chuyển cảnh.
- Đổi bố cục Scene nhanh: bấm phím **`1` / `2` / `3` / `4`** (1 ảnh Full, 2 ảnh ghép đôi, 3 ảnh Filmstrip, 4 ảnh Mosaic) hoặc chọn ngay trên thẻ Scene.
- Chọn nhiều Scene cùng lúc: giữ **`Shift + Click`** (chọn dãy) hoặc **`Ctrl/Cmd + Click`** (chọn rời) để xóa hoặc chỉnh đồng loạt.

### Bước 4: Chỉnh khung ảnh kiểu Photoshop (kéo to/nhỏ, dịch chuyển)
- Bấm nút **Chỉnh** phía trên khung Preview (hoặc click trực tiếp vào ảnh trong khung):
  - **Kéo các góc:** phóng to/thu nhỏ giữ đúng tỷ lệ gốc.
  - **Giữ `Shift` + kéo góc/cạnh:** kéo co giãn tự do giống Photoshop.
  - **Kéo ở giữa ảnh:** di chuyển vị trí khung ảnh.
  - Có nút đặt lại về mặc định nếu muốn quay lại bố cục chuẩn.
- Ảnh dọc mặc định hiển thị trọn khung (**Vừa khung / Fit**), không bị cắt đầu/chân như kiểu phóng đầy.

### Bước 5: Chỉnh thời lượng video & áp dụng cho mọi Scene
- Ở bảng bên phải (tab **Template**):
  - **Chỉnh tổng thời lượng cả video:** nhập thẳng thời lượng mong muốn (ví dụ `01:30` hoặc `90s`, tối đa 10 phút) — app tự chia đều cho các Scene.
  - **Áp thời lượng cho tất cả Scene:** đặt số giây 1 Scene rồi bấm nút áp dụng toàn bộ để khỏi phải sửa tay từng Scene.

### Bước 6: Chọn phong cách, màu sắc, LUT & chữ
- **Template:** 7 kiểu chuyển động 2D / 2.5D / 3D (Ken Burns, Parallax, Polaroid, Filmstrip, Mosaic, 3D Floating...).
- **Nền sau ảnh:** Ảnh mờ (5 kiểu blur), màu trơn, gradient, giấy ảnh... chỉnh độ mờ / độ tối / phóng nền.
- **Look / LUT:** chọn preset màu phim có sẵn hoặc nạp file **3D LUT (`.cube`)** xuất từ DaVinci Resolve.
- **Chữ:** thêm tiêu đề / phụ đề với font tiếng Việt có sẵn.
- Mẹo làm nhiều dự án: bấm **Áp phong cách sang tất cả tab** để đồng bộ màu, nền, chuyển động cho cả loạt show chỉ với 1 click.

### Bước 7: Xuất video (hỗ trợ chạy nền khi thu nhỏ cửa sổ)
- Bấm **Xuất** (`Ctrl+E` / `Cmd+E`):
  - **Xuất 1 video:** xuất toàn bộ dự án đang mở (hoặc đoạn giữa `In` / `Out`).
  - **Tách từng Scene:** xuất riêng từng clip.
  - **Xuất hàng loạt nhiều dự án:** chọn nhiều Tab dự án để máy tự xuất nối tiếp vào cùng 1 thư mục.
- **Định dạng hỗ trợ:** MP4 (H.264), MOV (ProRes 422), MOV (DNxHR HQ) — chuẩn dựng phim cho DaVinci Resolve / Premiere.
- **Chạy nền thoải mái:** trong lúc xuất, anh có thể **thu nhỏ cửa sổ xuống Taskbar (Windows) hoặc Dock (macOS)** để làm việc khác — app vẫn chạy hết tốc độ và hiện thanh tiến độ ngay trên icon ở Taskbar/Dock.

---

## 4. Lưu & Mở lại dự án
- **Lưu thủ công (`Ctrl+S` / `Cmd+S`):** chọn thư mục muốn lưu (file `.frameslide`), nên lưu ngay trong thư mục cưới/sự kiện của khách.
- **Tự động lưu (Autosave):** app tự lưu ngầm phiên gần nhất và hỏi **Khôi phục** khi mở lại:
  - Windows: `%APPDATA%\frameslide\autosave.frameslide`
  - macOS: `~/Library/Application Support/frameslide/autosave.frameslide`

---

## 5. Phím tắt dựng phim thông dụng
*(Trên macOS, thay phím `Ctrl` bằng `Cmd ⌘`)*

| Phím tắt | Chức năng |
|---|---|
| `Space` | Phát / Tạm dừng |
| `L` / `J` / `K` | Phát tới / Phát lùi (bấm nhiều lần tăng 2× → 4×) / Dừng |
| `Giữ K + J / L` hoặc `← / →` | Lùi / Tiến từng 1 frame |
| `Shift + ← / →` | Nhảy sang Scene trước / Scene kế tiếp |
| `I` / `O` / `Alt + X` | Đặt điểm vào (In) / điểm ra (Out) / Xóa In-Out |
| `1` / `2` / `3` / `4` | Đổi bố cục Scene sang 1 / 2 / 3 / 4 ảnh |
| `T` | Mở bảng chọn chuyển cảnh cho Scene |
| `Giữ \` | Xem nhanh ảnh gốc (Before / After) |
| `F` / `Esc` | Toàn màn hình Preview / Thoát |
| `Ctrl + D` / `Ctrl + N` | Nhân bản Scene / Thêm Scene trống |
| `Ctrl + Shift + C / V` | Sao chép / Dán thiết lập giữa các Scene |
| `Delete` | Xóa Scene đang chọn |
| `Ctrl + Z` / `Ctrl + Y` | Hoàn tác / Làm lại |
| `Ctrl + S` / `Ctrl + E` | Lưu dự án / Mở hộp thoại Xuất video |
