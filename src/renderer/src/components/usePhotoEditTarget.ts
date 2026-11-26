import { useEffect, useState } from 'react';
import { getExportResolution } from '@engine/capabilities';
import { MOTION_STYLE_CODE_MAP } from '@engine/presets/motionTemplates';
import { normalizePhotoTransform } from '@engine/photoTransform';
import { getEffectiveSlotFrameRect, hasCustomSingleFrame, resolveCardFitMode } from '@engine/slotFrame';
import { useAppStore } from '../store/useAppStore';

/**
 * Shared by the photo/frame editor and the crop tool: which slot of the active scene is being edited,
 * where the preview picture sits inside the overlay (object-contain) and where that slot's card
 * frame is on screen (matching `sampleScene()` in GLSL 1:1).
 */
export function usePhotoEditTarget(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  rootRef: React.RefObject<HTMLDivElement | null>
) {
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const scenes = useAppStore((s) => s.scenes);
  const slides = useAppStore((s) => s.slides);
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const activeSlotIndex = useAppStore((s) => s.activeSlotIndex);
  const renderParams = useAppStore((s) => s.renderParams);
  const setPhotoTransformStart = useAppStore((s) => s.setPhotoTransform);
  const setPhotoTransformEnd = useAppStore((s) => s.setPhotoTransformEnd);
  const keyframeEditPhase = useAppStore((s) => s.keyframeEditPhase);

  const scene = scenes.find((sc) => sc.id === activeSceneId) ?? scenes[0];
  const slotIdx = scene ? Math.min(activeSlotIndex, scene.slots.length - 1) : 0;
  const photoId = scene?.slots[slotIdx] ?? null;
  const photo = photoId ? slides.find((p) => p.id === photoId) : undefined;
  // With keyframes on, the editor changes either the Start or the End pose of the photo.
  const editingEnd = keyframeEditPhase === 'end' && Boolean(photo?.transformEnd);
  const setPhotoTransform = editingEnd ? setPhotoTransformEnd : setPhotoTransformStart;
  const xf = normalizePhotoTransform(editingEnd ? photo?.transformEnd : photo?.transform);

  // Track where the canvas image really sits inside the preview box (object-contain).
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const measure = () => {
      const cw = root.clientWidth;
      const ch = root.clientHeight;
      const iw = canvas.width || cw;
      const ih = canvas.height || ch;
      const k = Math.min(cw / iw, ch / ih);
      const w = iw * k;
      const h = ih * k;
      setBox({ left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef, rootRef]);

  const out = getExportResolution(renderParams.outputAspect);
  const canvasAspect = out.width / out.height;
  const motionStyle = MOTION_STYLE_CODE_MAP[scene?.motionTemplate ?? renderParams.motionTemplate] ?? 0;
  const fitMode = resolveCardFitMode(scene, renderParams);

  const photoAspectFor = (idx: number) => {
    const pid = scene?.slots[idx];
    const ph = pid ? slides.find((p) => p.id === pid) : undefined;
    const quarter = Math.abs(Math.round((ph?.rotationDeg ?? 0) / 90)) % 2 === 1;
    return ph ? (quarter ? ph.height / Math.max(1, ph.width) : ph.width / Math.max(1, ph.height)) : undefined;
  };

  const forceFrame = hasCustomSingleFrame(scene);
  const forceTilt3d = scene?.motionDirection === 'tilt-3d';

  /** Effective slot frame of slot `idx` in 0..1 preview units (includes fit mode, group scale/gap, and manual override). */
  const rectFor = (idx: number) =>
    getEffectiveSlotFrameRect({
      layout: scene?.layout ?? 'single',
      slotIdx: idx,
      canvasAspect,
      motionStyle,
      photoAspect: photoAspectFor(idx),
      portraitMode: renderParams.portraitMode,
      forceFrame,
      forceTilt3d,
      fitMode,
      frameScale: scene?.frameScale,
      frameGap: scene?.frameGap,
      override: scene?.slotFrames?.[idx],
    });

  /** Base slot frame of slot `idx` before manual per-slot override (used to compute relative resize scale). */
  const baseRectFor = (idx: number) =>
    getEffectiveSlotFrameRect({
      layout: scene?.layout ?? 'single',
      slotIdx: idx,
      canvasAspect,
      motionStyle,
      photoAspect: photoAspectFor(idx),
      portraitMode: renderParams.portraitMode,
      forceFrame,
      forceTilt3d,
      fitMode,
      frameScale: scene?.frameScale,
      frameGap: scene?.frameGap,
      override: null,
    });

  const frame = rectFor(slotIdx);
  /** The edited slot's frame in overlay pixels. */
  const fx = box.left + frame.x * box.width;
  const fy = box.top + frame.y * box.height;
  const fw = frame.w * box.width;
  const fh = frame.h * box.height;

  return {
    box,
    scene,
    slotIdx,
    photo,
    editingEnd,
    setPhotoTransform,
    xf,
    rectFor,
    baseRectFor,
    fx,
    fy,
    fw,
    fh,
  };
}
