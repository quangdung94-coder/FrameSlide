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

  it('scene shader evaluates each scene from a single call site (keeps Windows D3D compile fast)', () => {
    // Each extra evalA/evalB call inlines the whole multi-photo scene sampler again; with
    // ~50 call sites the Windows shader compiler froze the app on start-up.
    const count = (name: string) =>
      (SCENE_TRANSITION_FRAGMENT_SHADER.match(new RegExp(`\\b${name}\\(`, 'g')) ?? []).length;
    expect(count('evalA')).toBe(2); // definition + one call
    expect(count('evalB')).toBe(2);
    expect(count('sampleScene')).toBe(3); // definition + evalA + evalB
  });
});
