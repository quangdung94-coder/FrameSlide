import type { AppInfo } from '@shared/types';
import { useAppStore } from '../store/useAppStore';

interface Props {
  appInfo: AppInfo | null;
  previewSize: { width: number; height: number };
  liveFps: number | null;
  notice: string | null;
}

const okClass = (ok: boolean | undefined, warn = 'text-red-400') => (ok ? 'text-emerald-400' : warn);

/** Bottom status bar: GPU / FFmpeg checks, preview size, live FPS and the latest notice. */
export function StatusFooter({ appInfo, previewSize, liveFps, notice }: Props) {
  const caps = useAppStore((s) => s.engineCapabilities);
  const outputAspect = useAppStore((s) => s.renderParams.outputAspect);
  const fps = useAppStore((s) => s.fps);
  const showIntegratedWarning = caps?.gpuTier === 'integrated' || caps?.gpuTier === 'software';

  return (
    <footer className="flex items-center justify-between border-t border-zinc-800 bg-[#16161b] px-4 py-1.5 text-xs text-zinc-400">
      <div className="flex items-center gap-3 overflow-hidden">
        <span>
          WebGL2: <strong className={okClass(caps?.webgl2)}>{caps?.webgl2 ? 'OK' : 'Không hỗ trợ'}</strong>
        </span>
        <span>
          RGBA16F:{' '}
          <strong className={okClass(caps?.halfFloatRenderTarget, 'text-amber-400')}>
            {caps?.halfFloatRenderTarget ? 'OK' : 'Fallback 8-bit'}
          </strong>
        </span>
        <span>
          FFmpeg:{' '}
          <strong className={okClass(appInfo?.ffmpegAvailable, 'text-zinc-500')}>
            {appInfo ? (appInfo.ffmpegAvailable ? 'OK' : 'Không tìm thấy') : 'Web'}
          </strong>
        </span>
        {showIntegratedWarning && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
            {caps?.gpuTier === 'software' ? 'CPU Render' : 'Card tích hợp'}
          </span>
        )}
        <span>
          Xem trước:{' '}
          <strong className="text-zinc-200">
            {previewSize.width}×{previewSize.height} ({outputAspect}) • {fps} fps
          </strong>
        </span>
        {liveFps !== null && (
          <span>
            Live: <strong className={okClass(liveFps >= 28, 'text-amber-400')}>{liveFps} FPS</strong>
          </span>
        )}
        {notice && <span className="text-amber-300">• {notice}</span>}
      </div>

      <div className="shrink-0">
        {appInfo ? `v${appInfo.version} • Electron ${appInfo.electron}` : 'Browser Preview Mode'}
      </div>
    </footer>
  );
}
