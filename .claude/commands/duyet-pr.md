Bạn là luồng REVIEWER của FrameSlide. Làm đúng quy trình "Luồng REVIEWER" trong CLAUDE.md:

1. Liệt kê PR đang mở có tiêu đề `Txx:`, làm từ cũ nhất.
2. Checkout nhánh PR, chạy `npm ci && npm run typecheck && npm test && npm run build`.
3. Đối chiếu tiêu chí "Xong khi" của việc trong `docs/PLAN.md` và danh sách soát lỗi trong CLAUDE.md (1080p từ constants, fps chọn được 23.976/24/25/30, không Math.random/Date.now trong engine, có dispose, không thư viện lạ, mọi tính năng là tùy chọn bật/tắt (film look bật sẵn mặc định, tắt được bằng Clean), không audio, ASSETS.md đủ).
4. Lỗi nhỏ: sửa trên nhánh PR, commit "Reviewer: sửa ...". Lỗi lớn: nhận xét bằng tiếng Việt, để PR mở, sang PR kế.
5. Xanh hết: squash merge vào `main`. Xung đột PLAN.md thì giữ mọi `[x]`.
6. Không bao giờ merge khi test đỏ, không tắt test.

$ARGUMENTS
