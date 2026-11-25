import { describe, expect, it } from 'vitest';
import { OPTICAL_PASS_FRAGMENT_SHADER } from './opticalPassShader';
import {
  FULLSCREEN_VERTEX_SHADER,
  SCENE_TRANSITION_FRAGMENT_SHADER,
} from './sceneTransitionShader';
import { SUPER8_LOOK_FRAGMENT_SHADER } from './super8LookShader';

// Words that are keywords / reserved in GLSL ES 3.00 (WebGL2). Three.js compiles every
// ShaderMaterial as `#version 300 es`, so naming a variable or parameter like this makes
// the whole shader fail to compile (the preview & export then show no photos at all).
const RESERVED = [
  'layout', 'input', 'output', 'sample', 'filter', 'smooth', 'flat', 'centroid',
  'common', 'partition', 'active', 'superp', 'buffer', 'shared', 'resource',
  'patch', 'subroutine', 'noperspective', 'inline', 'noinline', 'packed',
];

const TYPES = '(?:float|int|uint|bool|vec[234]|ivec[234]|uvec[234]|bvec[234]|mat[234]|sampler2D)';
const declaresReserved = new RegExp(`\\b${TYPES}\\s+(${RESERVED.join('|')})\\b`);

describe('GLSL ES 3.00 shader sources', () => {
  const sources: Record<string, string> = {
    vertex: FULLSCREEN_VERTEX_SHADER,
    sceneTransition: SCENE_TRANSITION_FRAGMENT_SHADER,
    opticalPass: OPTICAL_PASS_FRAGMENT_SHADER,
    super8Look: SUPER8_LOOK_FRAGMENT_SHADER,
  };

  for (const [name, src] of Object.entries(sources)) {
    it(`${name} does not use GLSL reserved words as names`, () => {
      const match = src.match(declaresReserved);
      expect(match?.[0] ?? null).toBeNull();
    });
  }

  it('scene shader keeps heavy functions to a single call site (keeps Windows D3D compile fast)', () => {
    // Windows compiles WebGL through D3D, which inlines every call. Each extra call of the
    // scene sampler / card drawer / photo read multiplies compile time: ~50 scene calls froze
    // the app outright, and 2 scene calls x 10 cards still took ~15 s on an RTX 3060.
    // Now: 1 scene call, 1 card call (cards are drawn in a loop) -> ~1 s.
    const count = (name: string) =>
      (SCENE_TRANSITION_FRAGMENT_SHADER.match(new RegExp(`\\b${name}\\(`, 'g')) ?? []).length;
    expect(count('sampleScene')).toBe(2); // definition + one call in main()
    expect(count('compositeCard')).toBe(2); // definition + one call in the card loop
    expect(count('sampleBlurredSlot')).toBe(2);
    expect(count('fetchSlot')).toBe(2); // definition + samplePhotoSlot
    expect(count('evalA')).toBe(0);
    expect(count('evalB')).toBe(0);
    // texture reads: 8 inside fetchSlot (photo slots) + 2 pre-blurred backgrounds (D29, read once)
    expect((SCENE_TRANSITION_FRAGMENT_SHADER.match(/\btextureLod\(/g) ?? []).length).toBe(10);
    expect((SCENE_TRANSITION_FRAGMENT_SHADER.match(/\btextureLod\(uBgTex[AB]/g) ?? []).length).toBe(2);
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).not.toMatch(/\btexture2D\(/);
  });

  it('blur loop bound comes from the uBlurTaps uniform that the engine sets to 9', async () => {
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).toMatch(/uniform int uBlurTaps;/);
    const { readFileSync } = await import('fs');
    const engineSrc = readFileSync(new URL('../FrameSlideEngine.ts', import.meta.url), 'utf8');
    expect(engineSrc).toMatch(/uBlurTaps:\s*\{\s*value:\s*9\s*\}/);
  });

  it('scene shader reads the motion style per scene (A and B can use different templates)', () => {
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).toContain('uniform int uMotionStyleB;');
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).toContain('scene == 0 ? uMotionStyle : uMotionStyleB');
  });

  it('scene shader applies the per-photo colour tweaks inside the single photo read', () => {
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).toContain('uniform vec4 uAdjB3;');
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).toContain('vec4 slotAdj(int slot)');
  });

  it('scene shader has per-scene frame style (corner, shadow, border, feather) in the single card call', () => {
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).toContain('uniform vec4 uCardStyleB;');
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).toContain('float roundedMaskAA(');
  });

  it('scene shader has staggered entry per scene without extra card calls', () => {
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).toContain('uniform vec4 uStaggerA;');
    expect(SCENE_TRANSITION_FRAGMENT_SHADER).toContain('uniform int uStaggerStyleB;');
    expect(SCENE_TRANSITION_FRAGMENT_SHADER.match(/col = compositeCard\(/g)?.length).toBe(1);
  });
});
