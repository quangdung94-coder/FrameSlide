import { beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_RENDER_PARAMS, useAppStore } from './useAppStore';
import type { SlideAsset } from '@shared/types';

function makePhoto(id: string, orientation: 'landscape' | 'portrait' = 'landscape'): SlideAsset {
  return {
    id,
    name: `${id}.jpg`,
    originalPath: '',
    proxyUrl: `mock://${id}`,
    thumbUrl: `mock://${id}_t`,
    width: orientation === 'portrait' ? 1600 : 2400,
    height: orientation === 'portrait' ? 2400 : 1600,
    orientation,
    takenAtMs: 1000,
    focalPoint: { x: 0.5, y: 0.5 },
  };
}

describe('useAppStore scene & slot actions', () => {
  beforeEach(() => {
    useAppStore.setState({
      fps: 30,
      previewQuality: 'auto',
      frameIndex: 0,
      isPlaying: false,
      slides: [],
      scenes: [],
      activeSceneId: null,
      activeSlotIndex: 0,
      selectedPhotoId: null,
      renderParams: INITIAL_RENDER_PARAMS,
      past: [],
      future: [],
    });
  });

  it('swaps slots within the same scene and ignores self-drops', () => {
    const p1 = makePhoto('P1', 'portrait');
    const p2 = makePhoto('P2', 'portrait');
    useAppStore.getState().setSlides([p1, p2], false);

    const sc = useAppStore.getState().scenes[0];
    expect(sc.layout).toBe('diptych');
    expect(sc.slots).toEqual(['P1', 'P2']);

    // Self-drop should not push undo history
    useAppStore.getState().swapSceneSlots(sc.id, 0, sc.id, 0);
    expect(useAppStore.getState().past).toHaveLength(0);

    // Real swap within same scene
    useAppStore.getState().swapSceneSlots(sc.id, 0, sc.id, 1);
    expect(useAppStore.getState().scenes[0].slots).toEqual(['P2', 'P1']);
    expect(useAppStore.getState().past).toHaveLength(1);

    // Undo restores original order
    useAppStore.getState().undo();
    expect(useAppStore.getState().scenes[0].slots).toEqual(['P1', 'P2']);
  });

  it('migrates v1 project data (without scenes) cleanly to v2 scene track', () => {
    const p1 = makePhoto('L1', 'landscape');
    useAppStore.getState().loadProjectData(
      {
        version: 1,
        savedAt: '2026-11-24T00:00:00Z',
        fps: 24,
        slides: [p1],
        renderParams: INITIAL_RENDER_PARAMS,
        customLutPath: null,
      },
      'D:/test.frameslide'
    );

    const state = useAppStore.getState();
    expect(state.fps).toBe(24);
    expect(state.scenes).toHaveLength(1);
    expect(state.scenes[0].slots).toEqual(['L1']);
  });

  it('selects specific slot index on multi-photo scene click and clamps out-of-range index', () => {
    const p1 = makePhoto('P1', 'portrait');
    const p2 = makePhoto('P2', 'portrait');
    useAppStore.getState().setSlides([p1, p2], false);
    const sc = useAppStore.getState().scenes[0];

    useAppStore.getState().selectSceneAndSeek(sc.id, 1);
    expect(useAppStore.getState().activeSceneId).toBe(sc.id);
    expect(useAppStore.getState().activeSlotIndex).toBe(1);

    // Out-of-range clamps cleanly to last slot
    useAppStore.getState().selectSceneAndSeek(sc.id, 9);
    expect(useAppStore.getState().activeSlotIndex).toBe(1);
  });

  it('reorders scene cards by drag-drop, ignores self-drop, and supports undo', () => {
    const photos = [makePhoto('L1'), makePhoto('L2'), makePhoto('L3')];
    useAppStore.getState().setSlides(photos, false);
    const [s1, s2, s3] = useAppStore.getState().scenes;

    // Self-drop is a no-op
    useAppStore.getState().reorderScene(s1.id, s1.id);
    expect(useAppStore.getState().past).toHaveLength(0);

    // Move Scene 1 to Scene 3's position
    useAppStore.getState().reorderScene(s1.id, s3.id);
    expect(useAppStore.getState().scenes.map((s) => s.id)).toEqual([s2.id, s3.id, s1.id]);
    expect(useAppStore.getState().past).toHaveLength(1);

    useAppStore.getState().undo();
    expect(useAppStore.getState().scenes.map((s) => s.id)).toEqual([s1.id, s2.id, s3.id]);
  });

  it('randomizes transitions without consecutive duplicates and supports undo', () => {
    const photos = [
      makePhoto('L1'),
      makePhoto('L2'),
      makePhoto('L3'),
      makePhoto('L4'),
      makePhoto('L5'),
    ];
    useAppStore.getState().setSlides(photos, false);
    const before = useAppStore.getState().scenes.map((s) => s.transitionType);

    useAppStore.getState().randomizeSceneTransitions(20261124);
    const after = useAppStore.getState().scenes.map((s) => s.transitionType);
    for (let i = 1; i < after.length; i++) {
      expect(after[i]).not.toBe(after[i - 1]);
    }
    expect(useAppStore.getState().past).toHaveLength(1);

    useAppStore.getState().undo();
    expect(useAppStore.getState().scenes.map((s) => s.transitionType)).toEqual(before);
  });

  it('duplicates a scene, rotates/exposes a photo, and saves/applies user presets', () => {
    const p1 = makePhoto('L1');
    useAppStore.getState().setSlides([p1], false);
    const sc = useAppStore.getState().scenes[0];

    useAppStore.getState().setSceneMotionDirection(sc.id, 'tilt-3d');
    useAppStore.getState().setSceneCaption(sc.id, 'Đêm gala 2026');
    useAppStore.getState().duplicateScene(sc.id);
    expect(useAppStore.getState().scenes).toHaveLength(2);
    expect(useAppStore.getState().scenes[1].motionDirection).toBe('tilt-3d');
    expect(useAppStore.getState().scenes[1].caption).toBe('Đêm gala 2026');

    useAppStore.getState().rotatePhoto90('L1');
    useAppStore.getState().setPhotoExposure('L1', 0.5);
    expect(useAppStore.getState().slides[0].rotationDeg).toBe(90);
    expect(useAppStore.getState().slides[0].exposure).toBe(0.5);

    useAppStore.getState().setOutputAspect('9:16');
    useAppStore.getState().saveUserPreset('Reels 3D');
    const saved = useAppStore.getState().userPresets[0];
    expect(saved.name).toBe('Reels 3D');

    useAppStore.getState().setOutputAspect('16:9');
    useAppStore.getState().applyUserPreset(saved.id);
    expect(useAppStore.getState().renderParams.outputAspect).toBe('9:16');

    useAppStore.getState().deleteUserPreset(saved.id);
    expect(useAppStore.getState().userPresets.some((p) => p.id === saved.id)).toBe(false);
  });
});

describe('photo tray import (no auto timeline)', () => {
  beforeEach(() => {
    useAppStore.setState({
      slides: [],
      scenes: [],
      activeSceneId: null,
      selectedPhotoId: null,
      selectedPhotoIds: [],
      renderParams: INITIAL_RENDER_PARAMS,
      past: [],
      future: [],
    });
  });

  it('adds photos to the tray only, skipping duplicates, without creating scenes', () => {
    const st = useAppStore.getState();
    expect(st.addPhotosToBin([makePhoto('A'), makePhoto('B'), makePhoto('A')])).toBe(2);
    expect(useAppStore.getState().slides.map((p) => p.id)).toEqual(['A', 'B']);
    expect(useAppStore.getState().scenes).toHaveLength(0);
    expect(useAppStore.getState().addPhotosToBin([makePhoto('B')])).toBe(0);
    expect(useAppStore.getState().past).toHaveLength(1);
  });

  it('keeps existing scenes when more photos are imported', () => {
    useAppStore.getState().setSlides([makePhoto('A')], false);
    const before = useAppStore.getState().scenes;
    useAppStore.getState().addPhotosToBin([makePhoto('B'), makePhoto('C')]);
    expect(useAppStore.getState().scenes).toEqual(before);
    expect(useAppStore.getState().slides).toHaveLength(3);
  });

  it('appends scenes for selected photos in tray order and supports undo', () => {
    useAppStore.getState().addPhotosToBin([makePhoto('A'), makePhoto('B'), makePhoto('C')]);
    const added = useAppStore.getState().appendScenesForPhotos(['C', 'A']);
    expect(added).toBeGreaterThan(0);
    const used = useAppStore.getState().scenes.flatMap((sc) => sc.slots);
    expect(used).toEqual(['A', 'C']);
    expect(useAppStore.getState().activeSceneId).toBe(useAppStore.getState().scenes[0].id);
    useAppStore.getState().undo();
    expect(useAppStore.getState().scenes).toHaveLength(0);
    expect(useAppStore.getState().slides).toHaveLength(3);
    expect(useAppStore.getState().appendScenesForPhotos(['missing'])).toBe(0);
  });

  it('tracks multi-selection and clears removed photos from it', () => {
    useAppStore.getState().addPhotosToBin([makePhoto('A'), makePhoto('B')]);
    useAppStore.getState().setPhotoSelection(['A', 'B'], 'B');
    expect(useAppStore.getState().selectedPhotoId).toBe('B');
    useAppStore.getState().removePhoto('A');
    expect(useAppStore.getState().selectedPhotoIds).toEqual(['B']);
    useAppStore.getState().selectPhoto(null);
    expect(useAppStore.getState().selectedPhotoIds).toEqual([]);
  });
});

describe('timeline seeking', () => {
  beforeEach(() => {
    useAppStore.setState({
      fps: 30,
      frameIndex: 0,
      isPlaying: true,
      slides: [],
      scenes: [],
      activeSceneId: null,
      activeSlotIndex: 0,
      renderParams: { ...INITIAL_RENDER_PARAMS, durationMode: 'per-slide', handlesSec: 0 },
      past: [],
      future: [],
    });
  });

  it('jumps to a position inside a scene, clamped to that scene, and stops playback', () => {
    useAppStore.getState().setSlides([makePhoto('A'), makePhoto('B'), makePhoto('C')], false);
    const scenes = useAppStore.getState().scenes;
    for (const sc of scenes) useAppStore.getState().setSceneDuration(sc.id, 4);
    useAppStore.setState({ isPlaying: true });

    useAppStore.getState().seekToSceneFraction(scenes[1].id, 0.5);
    let st = useAppStore.getState();
    expect(st.frameIndex).toBe(30 * 6); // scene 2 starts at 4s, half of 4s → 6s
    expect(st.activeSceneId).toBe(scenes[1].id);
    expect(st.isPlaying).toBe(false);

    useAppStore.getState().seekToSceneFraction(scenes[1].id, 1.5);
    st = useAppStore.getState();
    expect(st.frameIndex).toBe(30 * 8 - 1); // last frame of scene 2, not scene 3

    useAppStore.getState().seekToSceneFraction(scenes[2].id, -1);
    expect(useAppStore.getState().frameIndex).toBe(30 * 8);
  });
});
