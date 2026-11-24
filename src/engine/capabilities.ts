import type {
  EngineCapabilities,
  GpuTier,
  OutputAspectId,
  PreviewQuality,
  Resolution,
} from '@shared/types';

const SOFTWARE_RENDERER_PATTERNS = [
  /swiftshader/i,
  /llvmpipe/i,
  /microsoft basic render/i,
  /software/i,
];

const DISCRETE_GPU_PATTERNS = [
  /nvidia/i,
  /geforce/i,
  /rtx\s?\d/i,
  /gtx\s?\d/i,
  /quadro/i,
  /radeon\s+rx/i,
  /radeon\s+pro/i,
  /intel.*arc/i,
];

const INTEGRATED_GPU_PATTERNS = [
  /intel.*(uhd|hd|iris)/i,
  /amd\s+radeon(\(tm\))?\s+(graphics|vega)/i,
  /radeon\s+vega/i,
];

export function classifyGpuRenderer(rendererInfo: string): GpuTier {
  if (!rendererInfo.trim()) return 'unknown';
  if (SOFTWARE_RENDERER_PATTERNS.some((re) => re.test(rendererInfo))) return 'software';
  if (DISCRETE_GPU_PATTERNS.some((re) => re.test(rendererInfo))) return 'discrete';
  if (INTEGRATED_GPU_PATTERNS.some((re) => re.test(rendererInfo))) return 'integrated';
  return 'unknown';
}

export function getExportResolution(aspect: OutputAspectId = '16:9'): Resolution {
  if (aspect === '9:16') return { width: 1080, height: 1920 };
  if (aspect === '1:1') return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 };
}

export function resolvePreviewResolution(
  quality: PreviewQuality,
  capabilities: EngineCapabilities | null,
  aspect: OutputAspectId = '16:9'
): Resolution {
  const full = getExportResolution(aspect);
  const scale = (f: number): Resolution => ({
    width: Math.max(2, Math.round((full.width * f) / 2) * 2),
    height: Math.max(2, Math.round((full.height * f) / 2) * 2),
  });

  if (quality === 'full') return full;
  if (quality === 'half') return scale(0.5);

  // 'auto': adapt to GPU tier & half-float support
  if (!capabilities) return scale(2 / 3);
  if (!capabilities.halfFloatRenderTarget || capabilities.gpuTier === 'software') {
    return scale(0.5);
  }
  if (capabilities.gpuTier === 'integrated') {
    return scale(2 / 3);
  }
  return full;
}
