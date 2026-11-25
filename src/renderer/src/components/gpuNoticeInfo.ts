import type { EngineCapabilities } from '@shared/types';

export interface GpuNoticeInfo {
  /** Remembered when dismissed, so the same warning is not shown again on this computer. */
  key: string;
  level: 'error' | 'warn' | 'info';
  title: string;
  text: string;
}

/** Bước 6: a plain-language warning the first time the app runs on a weak or unsupported graphics setup. */
export function gpuNoticeFor(caps: EngineCapabilities | null): GpuNoticeInfo | null {
  if (!caps) return null;
  if (!caps.webgl2) {
    return {
      key: 'no-webgl2',
      level: 'error',
      title: 'Máy chưa chạy được đồ họa WebGL2',
      text: 'FrameSlide cần card màn hình hỗ trợ WebGL2 để xem trước và xuất video. Anh cập nhật driver card màn hình (NVIDIA / AMD / Intel) rồi mở lại app.',
    };
  }
  if (caps.gpuTier === 'software') {
    return {
      key: 'software',
      level: 'warn',
      title: 'Đang vẽ bằng CPU, chưa dùng card màn hình',
      text: 'Xem trước sẽ giật và xuất video chậm. Thường do driver card màn hình cũ hoặc đang chạy qua Remote Desktop. Cập nhật driver rồi mở lại app.',
    };
  }
  if (!caps.halfFloatRenderTarget) {
    return {
      key: 'no-half-float',
      level: 'info',
      title: 'Card màn hình không hỗ trợ màu 16-bit',
      text: 'App tự chuyển sang 8-bit. Video vẫn xuất được, chỉ là vùng chuyển màu mịn (trời, da) có thể hơi gợn.',
    };
  }
  if (caps.gpuTier === 'integrated') {
    return {
      key: 'integrated',
      level: 'info',
      title: 'Máy đang dùng card đồ họa tích hợp',
      text: 'Nếu xem trước bị giật, để "Chất lượng xem trước" ở Tự động hoặc Thấp. Video xuất ra vẫn đủ 1080p, chỉ lâu hơn.',
    };
  }
  return null;
}
