Bạn là luồng CODER của FrameSlide. Làm đúng quy trình "Luồng CODER" trong CLAUDE.md:

1. `git fetch origin` và cập nhật `main`. Đọc `docs/PLAN.md`.
2. Xem PR đang mở (tiêu đề `Txx:`) để không làm trùng. Nếu có nhánh `task/Txx-...` dở dang chưa có PR thì làm tiếp nhánh đó.
3. Chọn việc `[ ]` đầu tiên có mọi việc "Cần trước" đã `[x]` trên `main`. Không có thì dừng, báo đang chờ PR nào.
4. Đọc các file docs liên quan tới việc đó, làm đúng phạm vi, chạy `npm run typecheck && npm test && npm run build`.
5. Đánh `[x]` cho việc trong PLAN.md, commit, push, mở PR tiêu đề `Txx: <tên việc>` bằng tiếng Việt, liệt kê từng tiêu chí "Xong khi" và cách đã kiểm.
6. Lặp lại với việc kế tiếp cho tới khi hết việc đủ điều kiện hoặc hết giới hạn.

$ARGUMENTS
