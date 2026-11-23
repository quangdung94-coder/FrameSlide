Bạn là luồng REVIEWER của FrameSlide. Làm đúng quy trình "Luồng REVIEWER" trong CLAUDE.md:

1. Liệt kê PR đang mở có tiêu đề `Txx:`, làm từ cũ nhất.
2. Checkout nhánh PR, chạy `npm ci && npm run typecheck && npm test && npm run build`.
3. Đối chiếu tiêu chí "Xong khi" của việc trong `docs/PLAN.md` và danh sách soát lỗi trong CLAUDE.md (1080p30 từ constants, không Math.random/Date.now trong engine, có dispose, không thư viện lạ, mọi tính năng tắt được (D19) và film look bật sẵn ở dự án mới, không audio, ASSETS.md đủ).
4. Lỗi nhỏ: sửa trên nhánh PR, commit "Reviewer: sửa ...". Lỗi lớn: nhận xét bằng tiếng Việt, để PR mở, sang PR kế.
5. Xanh hết: squash merge vào `main`. Xung đột PLAN.md thì giữ mọi `[x]`.
6. Không bao giờ merge khi test đỏ, không tắt test.

$ARGUMENTS
