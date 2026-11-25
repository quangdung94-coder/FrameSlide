import { useEffect, useState, type RefObject } from 'react';
import { FrameSlideEngine } from '@engine/FrameSlideEngine';
import { resolvePreviewResolution } from '@engine/capabilities';
import { computeProjectDurationSec, getTotalFrames } from '@engine/timeline';
import { computePlaybackFrame, playbackStartFrame } from '@engine/playback';
import { useAppStore } from '../store/useAppStore';

interface Options {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Filled with the engine once the canvas is mounted (shared with export / LUT code). */
  engineRef: { current: FrameSlideEngine | null };
  isExporting: boolean;
  previewSize: { width: number; height: number };
  effectiveDurationSec: number;
}

/**
 * Owns the preview engine: creates it on the canvas, uploads photos/scenes to the GPU,
 * re-renders the still frame when settings change and runs the playback loop.
 */
export function usePreviewEngine({ canvasRef, engineRef, isExporting, previewSize, effectiveDurationSec }: Options) {
  const [contextLost, setContextLost] = useState(false);
  const [liveFps, setLiveFps] = useState<number | null>(null);
  const slides = useAppStore((s) => s.slides);
  const scenes = useAppStore((s) => s.scenes);
  const renderParams = useAppStore((s) => s.renderParams);
  const fps = useAppStore((s) => s.fps);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playbackRate = useAppStore((s) => s.playbackRate);
  const playDirection = useAppStore((s) => s.playDirection);
  const loopPlayback = useAppStore((s) => s.loopPlayback);
  const compareMode = useAppStore((s) => s.compareMode);
  const setEngineCapabilities = useAppStore((s) => s.setEngineCapabilities);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialState = useAppStore.getState();
    const initialSize = resolvePreviewResolution(
      initialState.previewQuality,
      initialState.engineCapabilities,
      initialState.renderParams.outputAspect
    );

    const engine = new FrameSlideEngine({
      canvas,
      width: initialSize.width,
      height: initialSize.height,
      onContextLost: () => setContextLost(true),
      onShadersReady: () => {
        const s = useAppStore.getState();
        engineRef.current?.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);
      },
      onContextRestored: () => {
        setContextLost(false);
        const s = useAppStore.getState();
        engine.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);
      },
    });

    engineRef.current = engine;
    const caps = engine.getCapabilities();
    setEngineCapabilities(caps);

    const adaptedSize = resolvePreviewResolution(
      initialState.previewQuality,
      caps,
      initialState.renderParams.outputAspect
    );
    engine.resize(adaptedSize.width, adaptedSize.height);
    engine.renderFrame(
      initialState.frameIndex,
      initialState.fps,
      initialState.renderParams,
      initialState.compareMode
    );

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [setEngineCapabilities]);

  // Sync photos + SceneTrack to GPU
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    let cancelled = false;
    engine
      .setProjectMedia(slides, scenes, {
        portraitMode: renderParams.portraitMode,
        motionTemplate: renderParams.motionTemplate,
        defaultDurationSec: renderParams.defaultSlideDurationSec,
        defaultTransition: renderParams.transitionType,
      })
      .then(() => {
        if (cancelled) return;
        const s = useAppStore.getState();
        engine.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    slides,
    scenes,
    renderParams.portraitMode,
    renderParams.motionTemplate,
    renderParams.defaultSlideDurationSec,
    renderParams.transitionType,
  ]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || isExporting) return;
    engine.resize(previewSize.width, previewSize.height);
    const s = useAppStore.getState();
    engine.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);
  }, [previewSize.width, previewSize.height, isExporting]);

  useEffect(() => {
    if (isPlaying || isExporting) return;
    const s = useAppStore.getState();
    engineRef.current?.renderFrame(s.frameIndex, s.fps, s.renderParams, s.compareMode);

    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.isPlaying || isExporting) return;
      if (
        state.frameIndex !== prev.frameIndex ||
        state.renderParams !== prev.renderParams ||
        state.fps !== prev.fps ||
        state.compareMode !== prev.compareMode
      ) {
        const sceneIdx = engineRef.current?.renderFrame(
          state.frameIndex,
          state.fps,
          state.renderParams,
          state.compareMode
        );
        if (sceneIdx !== undefined && state.frameIndex !== prev.frameIndex) {
          const sc = state.scenes[sceneIdx];
          if (sc) state.setActiveSceneSilent(sc.id);
        }
      }
    });
    return unsub;
  }, [isPlaying, isExporting, renderParams, fps, compareMode]);

  useEffect(() => {
    if (!isPlaying || isExporting) {
      setLiveFps(null);
      return;
    }

    let rafId = 0;
    // Restarted whenever speed / direction / loop change, so it always continues from the frame on screen.
    const startWallMs = performance.now();
    const initial = useAppStore.getState();
    const startFrame = loopPlayback
      ? initial.frameIndex
      : playbackStartFrame(
          initial.frameIndex,
          playDirection,
          getTotalFrames(computeProjectDurationSec(initial.scenes, initial.renderParams), initial.fps)
        );
    let renderedCount = 0;
    let fpsWindowStart = startWallMs;

    const tick = (now: number) => {
      const s = useAppStore.getState();
      const effDur = computeProjectDurationSec(s.scenes, s.renderParams);
      const total = getTotalFrames(effDur, s.fps);
      const { frame: nextFrame, ended } = computePlaybackFrame({
        startFrame,
        elapsedSec: (now - startWallMs) / 1000,
        fps: s.fps,
        rate: playbackRate,
        direction: playDirection,
        totalFrames: total,
        loop: loopPlayback,
      });

      const sceneIdx = engineRef.current?.renderFrame(
        nextFrame,
        s.fps,
        s.renderParams,
        s.compareMode
      );
      s.setFrameIndex(nextFrame);
      if (sceneIdx !== undefined && s.scenes[sceneIdx]) {
        s.setActiveSceneSilent(s.scenes[sceneIdx].id);
      }

      renderedCount++;
      const windowMs = now - fpsWindowStart;
      if (windowMs >= 500) {
        setLiveFps(Math.round((renderedCount * 1000) / windowMs));
        renderedCount = 0;
        fpsWindowStart = now;
      }

      if (ended) {
        s.setIsPlaying(false);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isExporting, fps, effectiveDurationSec, playbackRate, playDirection, loopPlayback]);

  return { contextLost, liveFps };
}
