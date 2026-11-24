import { describe, expect, it } from 'vitest';
import { classifyGpuRenderer, getExportResolution, resolvePreviewResolution } from './capabilities';
import type { EngineCapabilities } from '@shared/types';

describe('GPU classification & auto preview resolution', () => {
  it('classifies discrete, integrated, and software renderers', () => {
    expect(classifyGpuRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)')).toBe('discrete');
    expect(classifyGpuRenderer('ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11)')).toBe('discrete');
    expect(classifyGpuRenderer('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)')).toBe('integrated');
    expect(classifyGpuRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))')).toBe('software');
    expect(classifyGpuRenderer('')).toBe('unknown');
  });

  it('picks safe preview resolution based on quality mode and GPU tier', () => {
    const discreteCaps: EngineCapabilities = {
      webgl2: true,
      halfFloatRenderTarget: true,
      rendererInfo: 'NVIDIA GeForce RTX 4070',
      maxTextureSize: 16384,
      gpuTier: 'discrete',
    };
    const integratedCaps: EngineCapabilities = {
      ...discreteCaps,
      rendererInfo: 'Intel Iris Xe Graphics',
      gpuTier: 'integrated',
    };
    const softwareCaps: EngineCapabilities = {
      ...discreteCaps,
      halfFloatRenderTarget: false,
      rendererInfo: 'SwiftShader',
      gpuTier: 'software',
    };

    expect(resolvePreviewResolution('full', integratedCaps)).toEqual({ width: 1920, height: 1080 });
    expect(resolvePreviewResolution('half', discreteCaps)).toEqual({ width: 960, height: 540 });
    expect(resolvePreviewResolution('auto', discreteCaps)).toEqual({ width: 1920, height: 1080 });
    expect(resolvePreviewResolution('auto', integratedCaps)).toEqual({ width: 1280, height: 720 });
    expect(resolvePreviewResolution('auto', softwareCaps)).toEqual({ width: 960, height: 540 });
    expect(getExportResolution('9:16')).toEqual({ width: 1080, height: 1920 });
    expect(getExportResolution('1:1')).toEqual({ width: 1080, height: 1080 });
    expect(resolvePreviewResolution('half', discreteCaps, '9:16')).toEqual({ width: 540, height: 960 });
  });
});
