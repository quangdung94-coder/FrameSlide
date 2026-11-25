import { describe, expect, it } from 'vitest';
import type { EngineCapabilities } from '@shared/types';
import { gpuNoticeFor } from './gpuNotice';

const base: EngineCapabilities = {
  webgl2: true,
  halfFloatRenderTarget: true,
  rendererInfo: 'NVIDIA GeForce RTX 3060',
  maxTextureSize: 16384,
  gpuTier: 'discrete',
};

describe('gpuNoticeFor', () => {
  it('says nothing on a normal graphics card', () => {
    expect(gpuNoticeFor(base)).toBeNull();
    expect(gpuNoticeFor(null)).toBeNull();
  });
  it('picks the most serious problem first', () => {
    expect(gpuNoticeFor({ ...base, webgl2: false, gpuTier: 'software' })?.key).toBe('no-webgl2');
    expect(gpuNoticeFor({ ...base, gpuTier: 'software', halfFloatRenderTarget: false })?.key).toBe('software');
    expect(gpuNoticeFor({ ...base, gpuTier: 'integrated', halfFloatRenderTarget: false })?.key).toBe('no-half-float');
    expect(gpuNoticeFor({ ...base, gpuTier: 'integrated' })?.level).toBe('info');
  });
});
