# SPEC – FrameSlide

Bản 23/11/2026. Báo cáo gốc (Notion): "Slideshow App – Báo cáo khả thi & Kế hoạch".

## 1. Mục tiêu

App Windows làm clip B-roll từ ảnh tĩnh, có cảm giác kỷ niệm, phim xưa. Editor phim cưới, sự kiện, year end party dùng clip này để chèn vào phim chính trong DaVinci Resolve hoặc Premiere.

- Nhẹ và nhanh hơn After Effects: dựng hình trên GPU, xem trước thời gian thực.
- Đẹp hơn ProShow: camera 2.5D, transition shader, film look nhiều lớp.

## 2. Người dùng

Editor video sự kiện (chủ dự án là người dùng đầu tiên). Có máy Windows 10/11 64-bit, thường có card rời. Biết dựng phim, cần ra B-roll nhanh từ vài chục tới vài trăm ảnh.

## 3. Chuẩn đầu ra (cố định)

- **1920x1080, 30fps, progressive, vuông điểm ảnh.** Không có lựa chọn độ phân giải khác trong bản 1.
- **Không có audio track.**
- Định dạng:
  - MP4 H.264 chất lượng cao (yuv420p, CRF ~16 bằng libx264; dùng `h264_nvenc` nếu có NVIDIA).
  - MOV ProRes 422 HQ (`prores_ks` profile 3, yuv422p10le).
  - MOV DNxHR HQ (`dnxhd -profile:v dnxhr_hq`, yuv422p).
- Film look bật sẵn mặc định nhưng người dùng tắt được (xem mục 4a).

## 4. Tính năng bản 1 (MVP, hạn thứ Tư 25/11/2026)

1. **Nhập ảnh:** kéo thả file hoặc thư mục (JPG, PNG, HEIC nếu `sharp` đọc được). Tự xoay theo EXIF, sắp theo ngày chụp, tạo ảnh làm việc cạnh dài 3200px và thumbnail.
2. **Danh sách slide** kiểu ProShow: kéo thả đổi thứ tự, mỗi slide có thời lượng, chuyển động, transition sang slide kế, chữ.
3. **Chuyển động:** Ken Burns (khung đầu, khung cuối, easing) và 4 preset camera 2.5D (dolly vào, dolly ra, lướt ngang, nghiêng nhẹ). Không bao giờ lộ viền đen.
4. **Transition:** 10 transition chọn lọc từ GL Transitions (danh sách ở EFFECTS.md), chỉnh thời lượng.
5. **Film look:** 5 look (EFFECTS.md), bật/tắt, thanh trượt độ mạnh 0–100%, đổi seed. Trong look, từng thành phần (grain, bụi/xước, rung khung, nhấp nháy, light leak, vignette, viền) cũng bật/tắt riêng được.
6. **Chữ tiếng Việt:** tiêu đề/chú thích, 3–4 font có đủ dấu, 4 kiểu hiệu ứng chữ.
7. **Phong cách (Quick Create):** chọn ảnh + phong cách → app tự dựng slideshow. MVP có 2 phong cách: "Kỷ niệm" (memory) và "Phim xưa" (film).
8. **Độ dài cố định:** 10, 15, 20, 30 giây hoặc tự nhập. App tự chia thời lượng cho các slide.
9. **Xuất hàng loạt:** chia một thư mục ảnh thành N clip, mỗi clip một độ dài, cùng hoặc khác phong cách, xuất lần lượt.
10. **Xem trước** thời gian thực, chế độ Tự động / Nửa / Đầy đủ độ phân giải.
11. **Chia khung trong một cảnh:** một slide có thể chứa 2 ảnh (chia đôi dọc hoặc ngang) hoặc 4 ảnh (lưới 2x2). Mỗi ô có Ken Burns riêng, khe hở giữa các ô chỉnh được (mặc định 8px, màu đen hoặc trắng kem). Film look áp lên cả khung hình sau khi ghép.
12. **Lưu / mở dự án** (`.fslide`, JSON), tự lưu, hoàn tác/làm lại.

## 4a. Nguyên tắc tùy chọn

Mọi tính năng ở mục 4 là **tùy chọn**, người dùng quyết định có dùng hay không, cho cả dự án và cho từng slide:

| Tính năng | Mặc định dự án mới | Tắt thì |
|---|---|---|
| Film look | Bật (Phim gia đình 8mm, 60%) | Hình sạch, không pass hậu kỳ nào |
| Chuyển động | Ken Burns | `none`: ảnh đứng yên, fit-cover |
| Transition | Fade 1s | `cut`: cắt thẳng, độ dài transition = 0 |
| Chữ | Không có | – |
| Chia khung | 1 ô | – |

Phong cách (Quick Create) chỉ là bộ giá trị mặc định; dựng xong người dùng vẫn tắt/sửa được từng thứ.

## 5. Làm nếu kịp (stretch, sau MVP)

- Phong cách Polaroid (khung trắng, bóng đổ, ảnh bay vào) và Mosaic (lưới 3x3 trở lên, các ô xuất hiện lệch thời gian).
- Thêm film look: phim dương bản 60–70, instant, máy dùng một lần 90s, sepia, máy chiếu, VHS, bleach bypass.
- Transition bằng overlay light leak / film burn tự làm bằng shader.
- Tùy chọn 25fps.

## 6. Bản 2 (không làm bây giờ)

Trình tạo template có keyframe, mosaic tự xếp hàng trăm ảnh, polaroid treo dây có vật lý, gallery 3D, sách lật trang, chèn video clip, nhập Lottie / video có alpha, khung 9:16, nhận diện khuôn mặt, phục hồi ảnh bằng AI, **installer .exe** và tự cập nhật.

## 7. Không làm (đã quyết, xem DECISIONS.md)

- Nhạc, nhập audio, khớp nhịp.
- 4K hay bất kỳ độ phân giải nào khác 1080p trong bản 1.
- Mở file After Effects (.aep, .mogrt), dùng plugin AE.
- Xuất không có film look.
- Sao chép template / tài nguyên của Motion Array hay look của Resolve, Retrograde.

## 8. Tiêu chí "xong" chung cho mọi tính năng

- Chạy được trong `npm run dev`, không lỗi console.
- `npm run typecheck && npm test && npm run build` qua.
- Logic có test. Việc hình ảnh có ảnh chụp trong PR.
- Không làm tụt xem trước dưới 30fps ở chế độ Tự động trên máy có card rời tầm GTX 1660 với 1 slide + transition + look.
- Video xuất ra kiểm bằng `ffprobe`: 1920x1080, 30fps, đúng số khung hình, không có stream audio.

## 9. Yêu cầu máy

- Tối thiểu: Windows 10 64-bit, CPU 4 nhân, RAM 8GB, iGPU Iris Xe / Vega.
- Khuyến nghị: CPU 6–8 nhân, RAM 16GB, card rời 6GB VRAM (GTX 1660 / RTX 2060 trở lên).
