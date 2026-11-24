import { describe, expect, it } from 'vitest';
import type { SlideAsset } from '@shared/types';
import {
  autoFillScenesWithPhotos,
  buildScenesFromPhotos,
  createEmptyScene,
  resizeSceneSlots,
} from './sceneBuilder';

function mockPhoto(id: string, orientation: 'landscape' | 'portrait'): SlideAsset {
  return {
    id,
    name: `${id}.jpg`,
    originalPath: '',
    proxyUrl: `mock://${id}`,
    thumbUrl: `mock://${id}_t`,
    width: orientation === 'portrait' ? 1600 : 2400,
    height: orientation === 'portrait' ? 2400 : 1600,
    orientation,
    takenAtMs: 0,
    focalPoint: { x: 0.5, y: orientation === 'portrait' ? 0.36 : 0.5 },
  };
}

describe('sceneBuilder', () => {
  it('pairs consecutive portraits into diptych scenes automatically', () => {
    const photos = [
      mockPhoto('L1', 'landscape'),
      mockPhoto('P1', 'portrait'),
      mockPhoto('P2', 'portrait'),
      mockPhoto('L2', 'landscape'),
    ];
    const scenes = buildScenesFromPhotos({ photos, portraitMode: 'smart-pairing' });
    expect(scenes).toHaveLength(3);
    expect(scenes[0].layout).toBe('single');
    expect(scenes[1].layout).toBe('diptych');
    expect(scenes[1].slots).toEqual(['P1', 'P2']);
    expect(scenes[2].layout).toBe('single');
  });

  it('builds multi-slot scenes according to motion template pattern and preserves photos on resize', () => {
    const photos = [
      mockPhoto('A', 'landscape'),
      mockPhoto('B', 'landscape'),
      mockPhoto('C', 'landscape'),
      mockPhoto('D', 'landscape'),
    ];
    const scenes = buildScenesFromPhotos({
      photos,
      portraitMode: 'smart-pairing',
      motionTemplate: 'minimal-mosaic',
    });
    expect(scenes).toHaveLength(1);
    expect(scenes[0].layout).toBe('mosaic4');
    expect(scenes[0].slots).toEqual(['A', 'B', 'C', 'D']);

    const resizedDown = resizeSceneSlots(scenes[0], 'diptych');
    expect(resizedDown.slots).toEqual(['A', 'B']);

    const empty = [createEmptyScene('triptych')];
    const filled = autoFillScenesWithPhotos(empty, photos);
    expect(filled[0].slots).toEqual(['A', 'B', 'C']);
  });
});
