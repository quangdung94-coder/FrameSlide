import { useRef } from 'react';
import { clampTextOffset } from '@engine/textAnimation';
import type { TextOffset } from '@shared/types';
import { useAppStore } from '../store/useAppStore';

/**
 * Transparent layer over the preview: drag anywhere to move the text. With per-scene captions
 * the selected scene gets its own position; otherwise the project's text position changes.
 */
export function TextDragOverlay({ onClose }: { onClose: () => void }) {
  const drag = useRef<{ x: number; y: number; base: TextOffset; w: number; h: number } | null>(null);
  const perScene = useAppStore((s) => s.renderParams.textOverlay.timing === 'per-scene');

  const currentOffset = (): TextOffset => {
    const s = useAppStore.getState();
    const scene = s.scenes.find((sc) => sc.id === s.activeSceneId);
    const own = perScene ? scene?.captionOffset : undefined;
    return clampTextOffset(own ?? s.renderParams.textOverlay.offset);
  };

  const apply = (offset: TextOffset) => {
    const s = useAppStore.getState();
    if (perScene && s.activeSceneId) s.setSceneCaptionOffset(s.activeSceneId, offset);
    else s.updateTextOverlay({ offset: clampTextOffset(offset) });
  };

  return (
    <div
      className="absolute inset-0 z-30 cursor-move touch-none bg-amber-400/5 outline-2 -outline-offset-2 outline-amber-400/70 outline-dashed"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.setPointerCapture(e.pointerId);
        useAppStore.getState().pushUndoPoint();
        drag.current = { x: e.clientX, y: e.clientY, base: currentOffset(), w: r.width, h: r.height };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        apply({ x: d.base.x + (e.clientX - d.x) / d.w, y: d.base.y + (e.clientY - d.y) / d.h });
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="pointer-events-auto absolute top-2.5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md bg-black/85 px-3 py-1.5 text-xs text-amber-200 shadow-lg">
        <span>
          Kéo để đổi vị trí chữ{perScene ? ' (riêng scene này)' : ''}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => apply({ x: 0, y: 0 })}
          className="h-7 rounded border border-zinc-600 px-2 hover:border-amber-400"
        >
          ⟲ Về chỗ cũ
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="h-7 rounded bg-amber-500 px-2 font-semibold text-zinc-950 hover:bg-amber-400"
        >
          Xong
        </button>
      </div>
    </div>
  );
}
