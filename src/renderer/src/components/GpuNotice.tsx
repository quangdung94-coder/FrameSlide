import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { gpuNoticeFor } from './gpuNoticeInfo';

const STORAGE_KEY = 'frameslide.gpuNotice.dismissed';

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const TONE = {
  error: 'border-red-500/60 bg-red-950/90 text-red-100',
  warn: 'border-amber-400/60 bg-amber-950/90 text-amber-100',
  info: 'border-sky-500/50 bg-zinc-900/95 text-zinc-100',
} as const;

/** First-run graphics check (Bước 6): a friendly banner, shown once per kind of problem. */
export function GpuNotice() {
  const caps = useAppStore((s) => s.engineCapabilities);
  const [dismissed, setDismissed] = useState(readDismissed);
  const notice = gpuNoticeFor(caps);
  if (!notice || dismissed === notice.key) return null;

  const close = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, notice.key);
    } catch {
      /* private mode: just hide it for now */
    }
    setDismissed(notice.key);
  };

  return (
    <div
      role="alert"
      className={`fixed top-14 left-1/2 z-50 flex w-[min(560px,calc(100vw-32px))] -translate-x-1/2 items-start gap-3 rounded-lg border px-3 py-2.5 text-xs shadow-xl ${TONE[notice.level]}`}
    >
      <span className="text-base leading-none">{notice.level === 'error' ? '⛔' : notice.level === 'warn' ? '⚠️' : 'ℹ️'}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{notice.title}</div>
        <div className="mt-0.5 opacity-90">{notice.text}</div>
        {caps?.rendererInfo && <div className="mt-1 truncate font-mono text-2xs opacity-60">{caps.rendererInfo}</div>}
      </div>
      <button
        type="button"
        onClick={close}
        className="shrink-0 rounded bg-white/10 px-2 py-1 font-medium hover:bg-white/20"
      >
        Đã hiểu
      </button>
    </div>
  );
}
