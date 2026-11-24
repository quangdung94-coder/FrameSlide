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

describe('scene backgrounds', () => {
  it('sets, clears and bulk-clears per-scene backgrounds with undo', () => {
    useAppStore.setState({ scenes: [], slides: [], past: [], future: [], renderParams: INITIAL_RENDER_PARAMS });
    useAppStore.getState().setSlides([makePhoto('A'), makePhoto('B')], false);
    const [s1] = useAppStore.getState().scenes;
    const bg = { style: 'solid' as const, color1: '#112233', color2: '#000000', angleDeg: 0, pattern: 'dots' as const };
    useAppStore.getState().setSceneBackground(s1.id, bg);
    expect(useAppStore.getState().scenes[0].background).toEqual(bg);
    useAppStore.getState().undo();
    expect(useAppStore.getState().scenes[0].background).toBeUndefined();
    useAppStore.getState().redo();
    useAppStore.getState().setSceneBackground(s1.id, null);
    expect('background' in useAppStore.getState().scenes[0]).toBe(false);
    useAppStore.getState().setSceneBackground(s1.id, bg);
    useAppStore.getState().clearAllSceneBackgrounds();
    expect(useAppStore.getState().scenes.some((sc) => sc.background)).toBe(false);
  });

  it('merges project background options', () => {
    useAppStore.getState().setBackgroundOptions({ angleDeg: 30 });
    const opts = useAppStore.getState().renderParams.backgroundOptions;
    expect(opts?.angleDeg).toBe(30);
    expect(opts?.color1).toMatch(/^#/);
  });
});

describe('photo transform editing', () => {
  it('stores a normalized transform, drops identity, and undoes a whole drag as one step', () => {
    useAppStore.setState({ scenes: [], slides: [], past: [], future: [], renderParams: INITIAL_RENDER_PARAMS });
    useAppStore.getState().setSlides([makePhoto('A')], false);
    useAppStore.getState().pushUndoPoint();
    useAppStore.getState().setPhotoTransform('A', { x: 0.1 }, false);
    useAppStore.getState().setPhotoTransform('A', { x: 0.2, scale: 1.5 }, false);
    expect(useAppStore.getState().slides[0].transform).toEqual({ x: 0.2, y: 0, scale: 1.5, rotationDeg: 0 });
    expect(useAppStore.getState().past).toHaveLength(1);
    useAppStore.getState().undo();
    expect(useAppStore.getState().slides[0].transform).toBeUndefined();
    useAppStore.getState().setPhotoTransform('A', { x: 0, y: 0, scale: 1, rotationDeg: 0 });
    expect('transform' in useAppStore.getState().slides[0]).toBe(false);
  });
});

describe('insertSceneAt & duplicateScene', () => {
  it('inserts an empty scene at the requested index and selects it', () => {
    useAppStore.setState({ scenes: [], slides: [], past: [], future: [], renderParams: INITIAL_RENDER_PARAMS });
    useAppStore.getState().addScene('single');
    useAppStore.getState().addScene('single');
    const [a, b] = useAppStore.getState().scenes.map((s) => s.id);
    useAppStore.getState().insertSceneAt('diptych', 1);
    const st = useAppStore.getState();
    expect(st.scenes.map((s) => s.id)[0]).toBe(a);
    expect(st.scenes[1].layout).toBe('diptych');
    expect(st.scenes[2].id).toBe(b);
    expect(st.activeSceneId).toBe(st.scenes[1].id);
    useAppStore.getState().insertSceneAt('single', 99); // clamps to the end
    expect(useAppStore.getState().scenes).toHaveLength(4);
    useAppStore.getState().undo();
    expect(useAppStore.getState().scenes).toHaveLength(3);
  });

  it('duplicates the scene background too', () => {
    useAppStore.setState({ scenes: [], slides: [], past: [], future: [], renderParams: INITIAL_RENDER_PARAMS });
    useAppStore.getState().addScene('diptych');
    const id = useAppStore.getState().scenes[0].id;
    useAppStore.getState().setSceneBackground(id, {
      style: 'solid',
      color1: '#112233',
      color2: '#000000',
      angleDeg: 0,
      pattern: 'dots',
    });
    useAppStore.getState().duplicateScene(id);
    expect(useAppStore.getState().scenes[1].background?.color1).toBe('#112233');
  });
});

describe('per-scene motion template', () => {
  it('sets, clears (follow project) and survives duplicate + copy/paste', () => {
    useAppStore.setState({ scenes: [], slides: [], past: [], future: [], renderParams: INITIAL_RENDER_PARAMS });
    useAppStore.getState().addScene('single');
    useAppStore.getState().addScene('single');
    const [a, b] = useAppStore.getState().scenes.map((s) => s.id);
    useAppStore.getState().setSceneMotionTemplate(a, 'polaroid-memories');
    expect(useAppStore.getState().scenes[0].motionTemplate).toBe('polaroid-memories');
    expect(useAppStore.getState().scenes[1].motionTemplate).toBeUndefined();

    useAppStore.getState().copySceneSettings(a);
    useAppStore.getState().pasteSceneSettings(b, ['motion']);
    expect(useAppStore.getState().scenes[1].motionTemplate).toBe('polaroid-memories');

    useAppStore.getState().duplicateScene(a);
    expect(useAppStore.getState().scenes[1].motionTemplate).toBe('polaroid-memories');

    useAppStore.getState().setSceneMotionTemplate(a, null);
    expect('motionTemplate' in useAppStore.getState().scenes[0]).toBe(false);
    useAppStore.getState().undo();
    expect(useAppStore.getState().scenes[0].motionTemplate).toBe('polaroid-memories');
  });
});

describe('photo Start/End keyframes', () => {
  const setup = () => {
    useAppStore.setState({ scenes: [], slides: [], past: [], future: [], renderParams: INITIAL_RENDER_PARAMS });
    useAppStore.getState().setSlides([makePhoto('A'), makePhoto('B')], false);
    useAppStore.getState().addScene('single');
    useAppStore.getState().addScene('single');
    const [s1, s2] = useAppStore.getState().scenes.map((s) => s.id);
    useAppStore.getState().assignPhotoToSlot(s1, 0, 'A');
    useAppStore.getState().assignPhotoToSlot(s2, 0, 'B');
    return { s1, s2 };
  };
  const photo = (id: string) => useAppStore.getState().slides.find((p) => p.id === id)!;

  it('enables with a push-in End, edits End, and disabling removes End + ease', () => {
    setup();
    useAppStore.getState().enablePhotoKeyframes('A');
    expect(photo('A').transformEnd?.scale).toBeCloseTo(1.12);
    expect(photo('A').keyframeEase).toBe('smooth');
    useAppStore.getState().setPhotoTransformEnd('A', { x: 0.2 }, false);
    expect(photo('A').transformEnd).toMatchObject({ x: 0.2, scale: 1.12 });
    useAppStore.getState().setPhotoTransformEnd('A', null);
    expect(photo('A').transformEnd).toBeUndefined();
    expect(photo('A').keyframeEase).toBeUndefined();
    useAppStore.getState().undo();
    expect(photo('A').transformEnd?.x).toBeCloseTo(0.2);
  });

  it('swaps Start/End, copies Start→End and End→Start', () => {
    setup();
    useAppStore.getState().setPhotoTransform('A', { x: 0.1, scale: 1.5 });
    useAppStore.getState().setPhotoTransformEnd('A', { x: -0.3, scale: 2 });
    useAppStore.getState().swapPhotoKeyframes('A');
    expect(photo('A').transform).toMatchObject({ x: -0.3, scale: 2 });
    expect(photo('A').transformEnd).toMatchObject({ x: 0.1, scale: 1.5 });
    useAppStore.getState().copyPhotoKeyframe('A', 'start');
    expect(photo('A').transformEnd).toEqual(photo('A').transform);
    useAppStore.getState().setPhotoTransformEnd('A', { x: 0.4, scale: 1 });
    useAppStore.getState().copyPhotoKeyframe('A', 'end');
    expect(photo('A').transform).toMatchObject({ x: 0.4, scale: 1 });
  });

  it("chains a scene's Start to the previous scene's End", () => {
    const { s1, s2 } = setup();
    useAppStore.getState().setPhotoTransformEnd('A', { x: 0.25, scale: 1.3 });
    expect(useAppStore.getState().chainPhotoKeyframeFromPrevious(s2, 0)).toBe(true);
    expect(photo('B').transform).toMatchObject({ x: 0.25, scale: 1.3 });
    expect(useAppStore.getState().chainPhotoKeyframeFromPrevious(s1, 0)).toBe(false); // first scene
  });
});

describe('per-scene transition duration', () => {
  it('sets, clamps, clears, duplicates and pastes with the transition part', () => {
    useAppStore.setState({ scenes: [], slides: [], past: [], future: [], renderParams: INITIAL_RENDER_PARAMS });
    useAppStore.getState().addScene('single');
    useAppStore.getState().addScene('single');
    const [a, b] = useAppStore.getState().scenes.map((s) => s.id);
    useAppStore.getState().setSceneTransitionDuration(a, 99);
    expect(useAppStore.getState().scenes[0].transitionDurationSec).toBe(2.5);
    useAppStore.getState().setSceneTransitionDuration(a, 1.4);
    useAppStore.getState().copySceneSettings(a);
    useAppStore.getState().pasteSceneSettings(b, ['transition']);
    expect(useAppStore.getState().scenes[1].transitionDurationSec).toBe(1.4);
    useAppStore.getState().duplicateScene(a);
    expect(useAppStore.getState().scenes[1].transitionDurationSec).toBe(1.4);
    useAppStore.getState().setSceneTransitionDuration(a, null);
    expect('transitionDurationSec' in useAppStore.getState().scenes[0]).toBe(false);
  });
});
