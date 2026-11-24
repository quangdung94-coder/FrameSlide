import { useRef } from 'react';

interface SplitterProps {
  /** 'col' = vertical bar dragged left/right; 'row' = horizontal bar dragged up/down. */
  direction: 'col' | 'row';
  /** Called while dragging with the total pointer movement (px) since the drag started. */
  onDrag: (deltaPx: number) => void;
  onDragStart?: () => void;
  onDoubleClick?: () => void;
  title?: string;
}

export function Splitter({ direction, onDrag, onDragStart, onDoubleClick, title }: SplitterProps) {
  const startRef = useRef<number | null>(null);
  const isCol = direction === 'col';
  return (
    <div
      role="separator"
      aria-orientation={isCol ? 'vertical' : 'horizontal'}
      title={title ?? 'Kéo để đổi kích thước • Bấm đúp để về mặc định'}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        startRef.current = isCol ? e.clientX : e.clientY;
        onDragStart?.();
      }}
      onPointerMove={(e) => {
        if (startRef.current === null) return;
        onDrag((isCol ? e.clientX : e.clientY) - startRef.current);
      }}
      onPointerUp={() => {
        startRef.current = null;
      }}
      onPointerCancel={() => {
        startRef.current = null;
      }}
      onDoubleClick={onDoubleClick}
      className={`group relative z-30 shrink-0 select-none ${
        isCol ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'
      }`}
    >
      <div
        className={`absolute bg-zinc-800 transition-colors group-hover:bg-amber-400/70 group-active:bg-amber-400 ${
          isCol ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2'
        }`}
      />
    </div>
  );
}
