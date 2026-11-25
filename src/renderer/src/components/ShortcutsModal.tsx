import { Modal } from './ui';

/** Every keyboard shortcut, shown in the "?" help dialog. Keep in sync with useKeyboardShortcuts. */
export const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['Space', 'Phát / Tạm dừng'],
  ['L / J', 'Phát tới / Phát lùi (bấm lại để tăng 2× → 4×)'],
  ['K', 'Dừng'],
  ['Giữ K + J / L', 'Lùi / Tiến từng 1 frame'],
  ['I / O', 'Đặt điểm vào (In) / điểm ra (Out) tại playhead'],
  ['Alt + X', 'Xóa In / Out'],
  ['← / →', 'Lùi / Tiến từng 1 frame'],
  ['Shift + ← / →', 'Nhảy sang Scene trước / Scene kế tiếp'],
  ['Giữ phím \\', 'Xem nhanh ảnh gốc (Before / After)'],
  ['F / Esc', 'Phóng to / Thu nhỏ màn hình Preview'],
  ['Delete', 'Xóa Scene đang chọn'],
  ['Ctrl + D', 'Nhân bản Scene đang chọn'],
  ['Ctrl + N', 'Thêm Scene trống sau Scene đang chọn'],
  ['Ctrl + Shift + C / V', 'Sao chép / Dán thiết lập Scene'],
  ['1 / 2 / 3 / 4', 'Đổi bố cục Scene đang chọn: 1 / 2 / 3 / 4 ảnh'],
  ['T', 'Mở bảng chọn chuyển cảnh của Scene đang chọn'],
  ['Home / End', 'Về đầu / cuối clip'],
  ['Ctrl + E', 'Mở hộp thoại Xuất'],
  ['Ctrl + Z / Ctrl + Y', 'Hoàn tác / Làm lại'],
  ['Ctrl + S', 'Lưu dự án (.frameslide)'],
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Phím tắt dựng phim" onClose={onClose} ariaLabel="Phím tắt">
      <div className="space-y-1.5 text-zinc-300">
        {SHORTCUTS.map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between py-0.5">
            <kbd className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-xs text-amber-300">
              {key}
            </kbd>
            <span className="text-zinc-400">{desc}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
