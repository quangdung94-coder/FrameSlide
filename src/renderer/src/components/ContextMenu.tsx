import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  /** Right-aligned shortcut hint, e.g. "Ctrl+D". */
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Draws a ✓ in front (used for "current choice"). */
  checked?: boolean;
  /** Thin divider line instead of an item. */
  separator?: boolean;
}

interface OpenState {
  x: number;
  y: number;
  items: MenuItem[];
}

function MenuView({ state, onClose }: { state: OpenState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: Math.max(4, Math.min(state.x, window.innerWidth - rect.width - 4)),
      y: Math.max(4, Math.min(state.y, window.innerHeight - rect.height - 4)),
    });
  }, [state]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    window.addEventListener('wheel', onClose, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[100] max-h-[calc(100vh-8px)] min-w-[250px] overflow-y-auto rounded-lg border border-zinc-700 bg-[#18181f] py-1.5 text-sm shadow-2xl"
    >
      {state.items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="my-1 h-px bg-zinc-800" />
        ) : (
          <button
            key={`${item.label}-${i}`}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onClick?.();
            }}
            className={`flex h-9 w-full items-center gap-2 px-3.5 text-left disabled:opacity-35 ${
              item.danger
                ? 'text-red-300 hover:bg-red-500/20'
                : 'text-zinc-200 hover:bg-zinc-800 hover:text-amber-300'
            }`}
          >
            <span className="w-3 shrink-0 text-amber-400">{item.checked ? '✓' : ''}</span>
            <span className="flex-1 truncate">{item.label}</span>
            {item.hint && <span className="shrink-0 font-mono text-zinc-500">{item.hint}</span>}
          </button>
        )
      )}
    </div>
  );
}

/**
 * Right-click / "⋯" menus. Usage:
 *   const { menu, openAt } = useContextMenu();
 *   <div onContextMenu={(e) => openAt(e, items)} /> ... {menu}
 */
export function useContextMenu(): {
  menu: ReactNode;
  openAt: (
    where: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void },
    items: MenuItem[]
  ) => void;
  close: () => void;
} {
  const [state, setState] = useState<OpenState | null>(null);
  const close = useCallback(() => setState(null), []);
  const openAt = useCallback<ReturnType<typeof useContextMenu>['openAt']>((where, items) => {
    where.preventDefault?.();
    where.stopPropagation?.();
    setState({ x: where.clientX, y: where.clientY, items });
  }, []);
  return { menu: state ? <MenuView state={state} onClose={close} /> : null, openAt, close };
}
