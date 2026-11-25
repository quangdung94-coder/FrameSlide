import { useEffect, useRef } from 'react';
import { SCENE_SETTING_PARTS } from '@engine/sceneSettings';
import { useAppStore } from '../store/useAppStore';
import { classifyKeyTarget } from './keyTarget';
import { applyShuttleKey, type ShuttleKey } from '@engine/playback';

export interface KeyboardShortcutOptions {
  /** Editing shortcuts are ignored while a render is running. */
  isExporting: boolean;
  totalFrames: number;
  /** Esc: close whatever overlay / mode is open. `inInput` = focus is in a text field. */
  onEscape: (inInput: boolean) => void;
  onSave: () => void;
  onToggleFullscreen: () => void;
  onOpenExport: () => void;
  onNotice: (msg: string) => void;
}

const SCENE_LAYOUTS = ['single', 'diptych', 'triptych', 'mosaic4'] as const;

function keyTargetKind(target: EventTarget | null) {
  const el = target as (HTMLElement & { type?: string }) | null;
  return classifyKeyTarget(el);
}

/** Global keyboard shortcuts of the editor (the list shown in the "?" dialog: ShortcutsModal.SHORTCUTS). */
export function useKeyboardShortcuts(options: KeyboardShortcutOptions): void {
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    let prevCompareBeforeHold: 'normal' | 'before' | 'split' | null = null;
    // K held down: J / L step one frame instead of shuttling (Premiere / Resolve behaviour).
    let kHeld = false;

    const onKeyDown = (e: KeyboardEvent) => {
      const o = optsRef.current;
      const targetKind = keyTargetKind(e.target);
      // `inInput` = typing in a text field; Esc / Ctrl+Z / Ctrl+Y keep their text-field meaning there.
      const inInput = targetKind === 'typing';
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const plain = !ctrl && !e.altKey;

      if (e.key === 'Escape') {
        o.onEscape(inInput);
        return;
      }

      if (ctrl && !e.shiftKey && key === 'z') {
        if (inInput) return;
        e.preventDefault();
        useAppStore.getState().undo();
        return;
      }
      if (ctrl && (key === 'y' || (e.shiftKey && key === 'z'))) {
        if (inInput) return;
        e.preventDefault();
        useAppStore.getState().redo();
        return;
      }
      if (ctrl && key === 's') {
        e.preventDefault();
        o.onSave();
        return;
      }

      // Everything below edits / navigates and never fires from text fields or during export.
      if (inInput || o.isExporting) return;
      const s = useAppStore.getState();

      // Transport keys work even when a slider, dropdown or button has focus (e.g. right after
      // dragging the scrubber). preventDefault also stops Space from clicking a focused button.
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        if (s.isPlaying) s.setIsPlaying(false);
        else s.setTransport({ isPlaying: true, direction: 1, rate: s.playbackRate });
        return;
      }
      if (plain && !e.shiftKey && (key === 'j' || key === 'k' || key === 'l')) {
        e.preventDefault();
        if (key === 'k') kHeld = true;
        if (e.repeat) return;
        if (kHeld && key !== 'k') {
          s.setIsPlaying(false);
          const last = Math.max(0, o.totalFrames - 1);
          s.setFrameIndex(Math.max(0, Math.min(last, s.frameIndex + (key === 'l' ? 1 : -1))));
          return;
        }
        const next = applyShuttleKey(
          { isPlaying: s.isPlaying, direction: s.playDirection, rate: s.playbackRate },
          key as ShuttleKey
        );
        s.setTransport(next);
        return;
      }
      if (plain && key === 'f') {
        e.preventDefault();
        o.onToggleFullscreen();
        return;
      }

      // Plain keys would clash with a focused control's own keys (arrows move a slider, letters and
      // digits pick in a dropdown), so they only run when no control has focus. Ctrl combos
      // (Ctrl+E, Ctrl+D, …) never clash and always work.
      if (targetKind === 'control' && !ctrl) return;

      if (plain && !e.shiftKey && (key === 'i' || key === 'o')) {
        // In / Out at the playhead (Premiere / Resolve keys).
        e.preventDefault();
        if (key === 'i') s.setMarkIn(s.frameIndex);
        else s.setMarkOut(s.frameIndex);
      } else if (e.altKey && !ctrl && key === 'x') {
        e.preventDefault();
        s.clearMarks();
      } else if (e.key === '\\' && !e.repeat) {
        e.preventDefault();
        prevCompareBeforeHold = s.compareMode;
        s.setCompareMode('before');
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey && s.scenes.length > 0) {
          const curIdx = Math.max(0, s.scenes.findIndex((sc) => sc.id === s.activeSceneId));
          const nextIdx =
            e.key === 'ArrowLeft' ? Math.max(0, curIdx - 1) : Math.min(s.scenes.length - 1, curIdx + 1);
          s.selectSceneAndSeek(s.scenes[nextIdx].id, 0);
        } else {
          s.setIsPlaying(false);
          const delta = e.key === 'ArrowLeft' ? -1 : 1;
          s.setFrameIndex(Math.max(0, Math.min(Math.max(0, o.totalFrames - 1), s.frameIndex + delta)));
        }
      } else if (e.key === 'Delete') {
        if (s.activeSceneId && s.scenes.length > 1) s.removeScene(s.activeSceneId);
      } else if (ctrl && !e.shiftKey && key === 'd') {
        e.preventDefault();
        if (s.activeSceneId) s.duplicateScene(s.activeSceneId);
      } else if (ctrl && !e.shiftKey && key === 'n') {
        e.preventDefault();
        const at = s.scenes.findIndex((sc) => sc.id === s.activeSceneId);
        s.insertSceneAt('single', at < 0 ? s.scenes.length : at + 1);
      } else if (ctrl && e.shiftKey && key === 'c') {
        e.preventDefault();
        if (s.activeSceneId && s.copySceneSettings(s.activeSceneId)) {
          o.onNotice('Đã sao chép thiết lập scene. Chọn scene khác rồi Ctrl+Shift+V để dán.');
        }
      } else if (ctrl && e.shiftKey && key === 'v') {
        e.preventDefault();
        if (s.activeSceneId && s.pasteSceneSettings(s.activeSceneId, SCENE_SETTING_PARTS.map((p) => p.id))) {
          o.onNotice('Đã dán thiết lập vào scene đang chọn.');
        }
      } else if (ctrl && !e.shiftKey && key === 'e') {
        // Opens the export dialog; never starts a render by accident.
        e.preventDefault();
        o.onOpenExport();
      } else if (plain && (e.key === 'Home' || e.key === 'End')) {
        e.preventDefault();
        s.setIsPlaying(false);
        s.setFrameIndex(e.key === 'Home' ? 0 : Math.max(0, o.totalFrames - 1));
      } else if (plain && !e.shiftKey && ['1', '2', '3', '4'].includes(e.key)) {
        if (s.activeSceneId) s.setSceneLayout(s.activeSceneId, SCENE_LAYOUTS[Number(e.key) - 1]);
      } else if (plain && !e.shiftKey && key === 't') {
        if (s.activeSceneId) {
          window.dispatchEvent(
            new CustomEvent('frameslide:open-transition', { detail: { sceneId: s.activeSceneId } })
          );
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // A focused button / checkbox acts on Space key-up; Space belongs to playback instead.
      if (e.code === 'Space' && keyTargetKind(e.target) === 'control') e.preventDefault();
      if (e.key.toLowerCase() === 'k') kHeld = false;
      if (e.key === '\\' && prevCompareBeforeHold !== null) {
        useAppStore.getState().setCompareMode(prevCompareBeforeHold);
        prevCompareBeforeHold = null;
      }
    };

    const onBlur = () => {
      kHeld = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
