import * as THREE from 'three';
import {
  DEFAULT_SUPER8_PARAMS,
  DEFAULT_TEXT_OVERLAY,
  type AspectMaskId,
  type SceneBackground,
  type CompareMode,
  type EngineCapabilities,
  type FrameBorderStyle,
  type MotionDirection,
  type MotionTemplateId,
  type PortraitMode,
  type RenderParams,
  type SceneItem,
  type SceneLayoutId,
  type SlideAsset,
  type TransitionType,
} from '@shared/types';
import { BG_PATTERN_CODE, BG_STYLE_CODE, hexToLinearRgb, resolveSceneBackground } from './background';
import { classifyGpuRenderer } from './capabilities';
import { cardStyleToUniform } from './cardStyle';
import { STAGGER_STYLE_CODE, staggerAppear } from './stagger';
import { photoAdjustToUniform } from './photoAdjust';
import { resolvePhotoTransform } from './photoKeyframes';
import { createLutStripTexture, parseCubeLut } from './cubeLutParser';
import { MOTION_STYLE_CODE_MAP } from './presets/motionTemplates';
import { TRANSITION_CODE_MAP } from './presets/transitions';
import { buildScenesFromPhotos } from './sceneBuilder';
import { TextOverlayRenderer, typewriterCharCount } from './textOverlay';
import { resolveSceneText } from './sceneText';
import { BlurredBackgroundCache } from './BlurredBackgroundCache';
import { blurShaderParams, resolveBlurSettings } from './backgroundBlur';
import { clampTextOffset, computeTextAnim } from './textAnimation';
import { TextureWindowCache } from './TextureWindowCache';
import { computeProjectDurationSec, evaluateTimeline, projectDurationInput, resolveSlideDurations } from './timeline';
import {
  FULLSCREEN_VERTEX_SHADER,
  SCENE_TRANSITION_FRAGMENT_SHADER,
} from './shaders/sceneTransitionShader';
import { OPTICAL_PASS_FRAGMENT_SHADER } from './shaders/opticalPassShader';
import { SUPER8_LOOK_FRAGMENT_SHADER } from './shaders/super8LookShader';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  preserveDrawingBuffer?: boolean;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  /** Called once all shader programs finished compiling (first frame can be drawn). */
  onShadersReady?: () => void;
}

export interface AutoSceneBuildOptions {
  portraitMode?: PortraitMode;
  motionTemplate?: MotionTemplateId;
  defaultDurationSec?: number;
  defaultTransition?: TransitionType;
}

const LAYOUT_CODE: Record<SceneLayoutId, number> = {
  single: 0,
  diptych: 1,
  triptych: 2,
  mosaic4: 3,
};

const MOTION_DIR_CODE: Record<MotionDirection, number> = {
  auto: 0,
  'zoom-in': 1,
  'zoom-out': 2,
  'pan-left': 3,
  'pan-right': 4,
  'tilt-3d': 5,
  static: 6,
};


const BORDER_STYLE_CODE: Record<FrameBorderStyle, number> = {
  auto: 0,
  none: 1,
  thin: 2,
  polaroid: 3,
};

const ASPECT_MASK_CODE: Record<AspectMaskId, number> = {
  none: 0,
  '2.39': 1,
  '2.00': 2,
  '4:3': 3,
};

const COMPARE_MODE_CODE: Record<CompareMode, number> = {
  normal: 0,
  before: 1,
  split: 2,
};

function formatExifDateStamp(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "'26 11 24";
  const d = new Date(ms);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `'${yy} ${mm} ${dd}`;
}

/**
 * Pure WebGL2 3-Pass Linear (RGBA16F) Render Engine supporting:
 * - Scene-based multi-slot architecture (1/2/3/4 photos per Scene)
 * - Per-slot custom Focal Points across all layouts & card styles
 * - 5 Motion Template styles & 16 Transitions
 * - 12 Film Look presets + Clean Mode + custom .cube 3D LUT (with domain scaling)
 * - Sliding Window VRAM Cache (24 entries, active-window protected)
 */
export class FrameSlideEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly capabilities: EngineCapabilities;
  private readonly onContextLostCallback?: () => void;
  private readonly onContextRestoredCallback?: () => void;

  private readonly quadGeo: THREE.PlaneGeometry;
  private readonly orthoCam: THREE.OrthographicCamera;

  private readonly pass1Scene: THREE.Scene;
  private readonly pass1Mat: THREE.ShaderMaterial;

  private readonly pass2Scene: THREE.Scene;
  private readonly pass2Mat: THREE.ShaderMaterial;

  private readonly pass3Scene: THREE.Scene;
  private readonly pass3Mat: THREE.ShaderMaterial;

  private readonly fallbackTex: THREE.DataTexture;
  private readonly textureCache: TextureWindowCache;
  private readonly blurCache = new BlurredBackgroundCache(16);
  private readonly textRenderer: TextOverlayRenderer;

  private customLutTex: THREE.DataTexture | null = null;
  private customLutSize = 0;

  private targetA: THREE.WebGLRenderTarget;
  private targetB: THREE.WebGLRenderTarget;
  private outputTarget: THREE.WebGLRenderTarget | null = null;

  private photoMap = new Map<string, SlideAsset>();
  private scenes: SceneItem[] = [];
  private activePreloadCenter: number | null = null;
  private lastSceneIndex = 0;

  private width: number;
  private height: number;
  private contextLost = false;
  private disposed = false;
  private shadersReady = false;
  private readonly shadersReadyPromise: Promise<void>;

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.onContextLostCallback?.();
  };

  private readonly handleContextRestored = (): void => {
    this.contextLost = false;
    this.targetA.dispose();
    this.targetB.dispose();
    this.outputTarget?.dispose();
    this.outputTarget = null;
    this.targetA = this.createLinearTarget(this.width, this.height);
    this.targetB = this.createLinearTarget(this.width, this.height);
    this.pass2Mat.uniforms['uInputTex'].value = this.targetA.texture;
    this.pass3Mat.uniforms['uInputTex'].value = this.targetB.texture;

    // Re-upload all textures invalidated by GPU driver reset
    this.fallbackTex.needsUpdate = true;
    if (this.customLutTex) {
      this.customLutTex.needsUpdate = true;
    }
    this.textRenderer.invalidate();
    this.textureCache.clear();
    this.blurCache.clear();
    void this.preloadAroundSceneIndex(this.lastSceneIndex).then(() => {
      this.onContextRestoredCallback?.();
    });
  };

  constructor(options: EngineOptions) {
    this.canvas = options.canvas;
    this.width = Math.max(2, Math.floor(options.width ?? 1920));
    this.height = Math.max(2, Math.floor(options.height ?? 1080));
    this.onContextLostCallback = options.onContextLost;
    this.onContextRestoredCallback = options.onContextRestored;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.capabilities = this.detectCapabilities();
    this.targetA = this.createLinearTarget(this.width, this.height);
    this.targetB = this.createLinearTarget(this.width, this.height);

    this.fallbackTex = new THREE.DataTexture(new Uint8Array([22, 22, 27, 255]), 1, 1);
    this.fallbackTex.colorSpace = THREE.SRGBColorSpace;
    this.fallbackTex.needsUpdate = true;

    this.textureCache = new TextureWindowCache(24);
    this.textRenderer = new TextOverlayRenderer();

    this.quadGeo = new THREE.PlaneGeometry(2, 2);
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    this.pass1Mat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: SCENE_TRANSITION_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uTexA0: { value: this.fallbackTex },
        uTexA1: { value: this.fallbackTex },
        uTexA2: { value: this.fallbackTex },
        uTexA3: { value: this.fallbackTex },
        uSizeA0: { value: new THREE.Vector2(1920, 1080) },
        uSizeA1: { value: new THREE.Vector2(1920, 1080) },
        uSizeA2: { value: new THREE.Vector2(1920, 1080) },
        uSizeA3: { value: new THREE.Vector2(1920, 1080) },
        uFocalA0: { value: new THREE.Vector2(0.5, 0.5) },
        uFocalA1: { value: new THREE.Vector2(0.5, 0.5) },
        uFocalA2: { value: new THREE.Vector2(0.5, 0.5) },
        uFocalA3: { value: new THREE.Vector2(0.5, 0.5) },
        uRotA0: { value: 0 },
        uRotA1: { value: 0 },
        uRotA2: { value: 0 },
        uRotA3: { value: 0 },
        uExpA0: { value: 1 },
        uExpA1: { value: 1 },
        uExpA2: { value: 1 },
        uExpA3: { value: 1 },
        uCardStyleA: { value: new THREE.Vector4(0, 1, 1, 0) },
        uStaggerA: { value: new THREE.Vector4(1, 1, 1, 1) },
        uStaggerB: { value: new THREE.Vector4(1, 1, 1, 1) },
        uStaggerStyleA: { value: 0 },
        uStaggerStyleB: { value: 0 },
        uCardStyleB: { value: new THREE.Vector4(0, 1, 1, 0) },
        uAdjA0: { value: new THREE.Vector4(1, 1, 0, 1) },
        uAdjA1: { value: new THREE.Vector4(1, 1, 0, 1) },
        uAdjA2: { value: new THREE.Vector4(1, 1, 0, 1) },
        uAdjA3: { value: new THREE.Vector4(1, 1, 0, 1) },
        uAdjB0: { value: new THREE.Vector4(1, 1, 0, 1) },
        uAdjB1: { value: new THREE.Vector4(1, 1, 0, 1) },
        uAdjB2: { value: new THREE.Vector4(1, 1, 0, 1) },
        uAdjB3: { value: new THREE.Vector4(1, 1, 0, 1) },
        uXfA0: { value: new THREE.Vector4(0, 0, 1, 0) },
        uXfA1: { value: new THREE.Vector4(0, 0, 1, 0) },
        uXfA2: { value: new THREE.Vector4(0, 0, 1, 0) },
        uXfA3: { value: new THREE.Vector4(0, 0, 1, 0) },
        uLayoutA: { value: 0 },
        uMotionDirA: { value: 0 },

        uTexB0: { value: this.fallbackTex },
        uTexB1: { value: this.fallbackTex },
        uTexB2: { value: this.fallbackTex },
        uTexB3: { value: this.fallbackTex },
        uSizeB0: { value: new THREE.Vector2(1920, 1080) },
        uSizeB1: { value: new THREE.Vector2(1920, 1080) },
        uSizeB2: { value: new THREE.Vector2(1920, 1080) },
        uSizeB3: { value: new THREE.Vector2(1920, 1080) },
        uFocalB0: { value: new THREE.Vector2(0.5, 0.5) },
        uFocalB1: { value: new THREE.Vector2(0.5, 0.5) },
        uFocalB2: { value: new THREE.Vector2(0.5, 0.5) },
        uFocalB3: { value: new THREE.Vector2(0.5, 0.5) },
        uRotB0: { value: 0 },
        uRotB1: { value: 0 },
        uRotB2: { value: 0 },
        uRotB3: { value: 0 },
        uExpB0: { value: 1 },
        uExpB1: { value: 1 },
        uExpB2: { value: 1 },
        uExpB3: { value: 1 },
        uXfB0: { value: new THREE.Vector4(0, 0, 1, 0) },
        uXfB1: { value: new THREE.Vector4(0, 0, 1, 0) },
        uXfB2: { value: new THREE.Vector4(0, 0, 1, 0) },
        uXfB3: { value: new THREE.Vector4(0, 0, 1, 0) },
        uLayoutB: { value: 0 },
        uMotionDirB: { value: 0 },
        uMotionStyleB: { value: 0 },

        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uProgressA: { value: 0 },
        uProgressB: { value: 0 },
        uTransProgress: { value: 0 },
        uTransType: { value: 1 },
        uMotionStyle: { value: 0 },
        uMotionIntensity: { value: 1 },
        uBgStyleA: { value: 0 },
        uBgStyleB: { value: 0 },
        uBgCol1A: { value: new THREE.Vector3() },
        uBgCol2A: { value: new THREE.Vector3() },
        uBgCol1B: { value: new THREE.Vector3() },
        uBgCol2B: { value: new THREE.Vector3() },
        uBgAngleA: { value: 0 },
        uBgAngleB: { value: 0 },
        uBgPatternA: { value: 0 },
        uBgPatternB: { value: 0 },
        uBorderStyle: { value: 0 },
        uPortraitMode: { value: 0 },
        uSlideIndexA: { value: 0 },
        uSlideIndexB: { value: 0 },
        uBokeh: { value: 0 },
        uTimeSec: { value: 0 },
        // Always 9 (3x3 background blur). Passed as a uniform so Windows/D3D keeps the
        // blur as a real loop instead of unrolling it 9x (see sceneTransitionShader.ts).
        uBlurTaps: { value: 9 },
        uBgTexA: { value: null },
        uBgTexB: { value: null },
        uBgBlurA: { value: new THREE.Vector4(0, 0.24, 1.18, 0) },
        uBgBlurB: { value: new THREE.Vector4(0, 0.24, 1.18, 0) },
      },
    });
    this.pass1Scene = new THREE.Scene();
    this.pass1Scene.add(new THREE.Mesh(this.quadGeo, this.pass1Mat));

    this.pass2Mat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: OPTICAL_PASS_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uInputTex: { value: this.targetA.texture },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uHalation: { value: DEFAULT_SUPER8_PARAMS.halation },
        uBloom: { value: DEFAULT_SUPER8_PARAMS.bloom },
        uEnabled: { value: 1 },
      },
    });
    this.pass2Scene = new THREE.Scene();
    this.pass2Scene.add(new THREE.Mesh(this.quadGeo, this.pass2Mat));

    this.pass3Mat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: SUPER8_LOOK_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uInputTex: { value: this.targetB.texture },
        uLutTex: { value: this.fallbackTex },
        uTextTex: { value: this.textRenderer.texture },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uFrameIndex: { value: 0 },
        uDitherFrame: { value: 0 },
        uTimeSec: { value: 0 },
        uEnabled: { value: 1 },
        uIntensity: { value: DEFAULT_SUPER8_PARAMS.intensity },
        uGrain: { value: DEFAULT_SUPER8_PARAMS.grain },
        uGrainSize: { value: DEFAULT_SUPER8_PARAMS.grainSize },
        uGateWeave: { value: DEFAULT_SUPER8_PARAMS.gateWeave },
        uFlicker: { value: DEFAULT_SUPER8_PARAMS.flicker },
        uVignette: { value: DEFAULT_SUPER8_PARAMS.vignette },
        uRoundedCorners: { value: DEFAULT_SUPER8_PARAMS.roundedCorners },
        uWarmShift: { value: DEFAULT_SUPER8_PARAMS.warmShift },
        uFade: { value: DEFAULT_SUPER8_PARAMS.fade },
        uContrast: { value: DEFAULT_SUPER8_PARAMS.contrast },
        uSaturation: { value: DEFAULT_SUPER8_PARAMS.saturation },
        uSepia: { value: DEFAULT_SUPER8_PARAMS.sepia },
        uScanlines: { value: DEFAULT_SUPER8_PARAMS.scanlines },
        uChromaBleed: { value: DEFAULT_SUPER8_PARAMS.chromaBleed },
        uDustScratches: { value: DEFAULT_SUPER8_PARAMS.dustScratches },
        uAmbientLeak: { value: DEFAULT_SUPER8_PARAMS.ambientLeak },
        uAspectMask: { value: 0 },
        uSprockets: { value: 0 },
        uHasLut: { value: 0 },
        uLutSize: { value: 0 },
        uLutIntensity: { value: 1 },
        uLutDomainMin: { value: new THREE.Vector3(0, 0, 0) },
        uLutDomainMax: { value: new THREE.Vector3(1, 1, 1) },
        uHasText: { value: 0 },
        uTextAlpha: { value: 1 },
        uTextOffset: { value: new THREE.Vector2(0, 0) },
        uVideoFade: { value: 1 },
        uCompareMode: { value: 0 },
      },
    });
    this.pass3Scene = new THREE.Scene();
    this.pass3Scene.add(new THREE.Mesh(this.quadGeo, this.pass3Mat));

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    this.shadersReadyPromise = this.compileShadersAsync().then(() => {
      if (this.disposed) return;
      this.shadersReady = true;
      options.onShadersReady?.();
    });
  }

  /**
   * Compiles all passes in the background (KHR_parallel_shader_compile) so the first
   * cold compile on Windows/D3D (can take 10–20 s) does not freeze the whole UI.
   * Each pass is compiled with the same render target it will draw into, so Three.js
   * reuses exactly these programs at render time.
   */
  private async compileShadersAsync(): Promise<void> {
    try {
      const prevTarget = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(this.targetA);
      const p1 = this.renderer.compileAsync(this.pass1Scene, this.orthoCam);
      this.renderer.setRenderTarget(this.targetB);
      const p2 = this.renderer.compileAsync(this.pass2Scene, this.orthoCam);
      this.renderer.setRenderTarget(null);
      const p3 = this.renderer.compileAsync(this.pass3Scene, this.orthoCam);
      this.renderer.setRenderTarget(prevTarget);
      await Promise.all([p1, p2, p3]);
    } catch {
      // Fall back to the normal (synchronous) compile on first render
    }
  }

  /** Resolves once shader programs are compiled; await before exporting frames. */
  public whenReady(): Promise<void> {
    return this.shadersReadyPromise;
  }

  public isReady(): boolean {
    return this.shadersReady;
  }

  private detectCapabilities(): EngineCapabilities {
    const gl = this.renderer.getContext();
    const isWebGL2 =
      typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererInfo = debugExt
      ? String(gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));

    const halfFloatRenderTarget = isWebGL2
      ? Boolean(
          gl.getExtension('EXT_color_buffer_float') ||
            gl.getExtension('EXT_color_buffer_half_float')
        )
      : Boolean(gl.getExtension('EXT_color_buffer_half_float'));

    return {
      webgl2: isWebGL2,
      halfFloatRenderTarget,
      rendererInfo,
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
      gpuTier: classifyGpuRenderer(rendererInfo),
    };
  }

  private createLinearTarget(width: number, height: number): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(width, height, {
      type: this.capabilities.halfFloatRenderTarget
        ? THREE.HalfFloatType
        : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  private ensureOutputTarget(): THREE.WebGLRenderTarget {
    if (!this.outputTarget) {
      this.outputTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        colorSpace: THREE.NoColorSpace,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
      });
    } else if (
      this.outputTarget.width !== this.width ||
      this.outputTarget.height !== this.height
    ) {
      this.outputTarget.setSize(this.width, this.height);
    }
    return this.outputTarget;
  }

  public getCapabilities(): EngineCapabilities {
    return this.capabilities;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  public getScenes(): SceneItem[] {
    return this.scenes;
  }

  public setCustomCubeLut(cubeContent: string | null): { title: string; size: number } | null {
    if (this.customLutTex) {
      this.customLutTex.dispose();
      this.customLutTex = null;
      this.customLutSize = 0;
    }

    if (!cubeContent) {
      this.pass3Mat.uniforms['uLutTex'].value = this.fallbackTex;
      this.pass3Mat.uniforms['uHasLut'].value = 0;
      this.pass3Mat.uniforms['uLutSize'].value = 0;
      (this.pass3Mat.uniforms['uLutDomainMin'].value as THREE.Vector3).set(0, 0, 0);
      (this.pass3Mat.uniforms['uLutDomainMax'].value as THREE.Vector3).set(1, 1, 1);
      return null;
    }

    const parsed = parseCubeLut(cubeContent);
    this.customLutTex = createLutStripTexture(parsed);
    this.customLutSize = parsed.size;
    this.pass3Mat.uniforms['uLutTex'].value = this.customLutTex;
    this.pass3Mat.uniforms['uHasLut'].value = 1;
    this.pass3Mat.uniforms['uLutSize'].value = parsed.size;
    (this.pass3Mat.uniforms['uLutDomainMin'].value as THREE.Vector3).set(
      parsed.domainMin[0],
      parsed.domainMin[1],
      parsed.domainMin[2]
    );
    (this.pass3Mat.uniforms['uLutDomainMax'].value as THREE.Vector3).set(
      parsed.domainMax[0],
      parsed.domainMax[1],
      parsed.domainMax[2]
    );
    return { title: parsed.title, size: parsed.size };
  }

  public async setProjectMedia(
    photos: SlideAsset[],
    scenes: SceneItem[],
    fallbackOptions: AutoSceneBuildOptions = {}
  ): Promise<void> {
    if (this.disposed) return;
    this.photoMap = new Map(photos.map((p) => [p.id, p]));
    this.scenes =
      scenes.length > 0
        ? scenes
        : buildScenesFromPhotos({
            photos,
            portraitMode: fallbackOptions.portraitMode ?? 'smart-pairing',
            motionTemplate: fallbackOptions.motionTemplate,
            defaultDurationSec: fallbackOptions.defaultDurationSec,
            defaultTransition: fallbackOptions.defaultTransition,
          });
    await this.preloadAroundSceneIndex(0);
  }

  private collectSceneUrls(indices: number[]): string[] {
    const urls: string[] = [];
    for (const idx of indices) {
      const sc = this.scenes[idx];
      if (!sc) continue;
      for (const pid of sc.slots) {
        if (!pid) continue;
        const asset = this.photoMap.get(pid);
        if (asset) urls.push(asset.proxyUrl);
      }
    }
    return urls;
  }

  public async preloadAroundSceneIndex(centerIndex: number): Promise<void> {
    if (this.disposed || this.scenes.length === 0) return;
    if (this.activePreloadCenter === centerIndex) return;
    this.activePreloadCenter = centerIndex;

    try {
      // Order priority: current & next scene last so they are freshest in LRU
      const windowIndices = [
        centerIndex - 1,
        centerIndex + 2,
        centerIndex + 1,
        centerIndex,
      ].filter((i) => i >= 0 && i < this.scenes.length);

      const urls = this.collectSceneUrls(windowIndices);
      await this.textureCache.preloadWindow(urls, new Set(urls));
    } finally {
      if (this.activePreloadCenter === centerIndex) {
        this.activePreloadCenter = null;
      }
    }
  }

  public async ensureFrameTextures(
    frameIndex: number,
    fps: number,
    params: RenderParams
  ): Promise<void> {
    if (this.scenes.length === 0) return;

    const state = evaluateTimeline({
      frameIndex,
      fps,
      slideCount: this.scenes.length,
      transitionDurationSec: params.transitionDurationSec,
      transitionDurations: this.scenes.map((sc) => sc.transitionDurationSec),
      simulate18fps: params.super8.enabled && params.super8.simulate18fps,
      ...projectDurationInput(this.scenes, params),
    });

    const needed = [state.slideBIndex + 1, state.slideBIndex, state.slideAIndex].filter(
      (i) => i >= 0 && i < this.scenes.length
    );
    const urls = this.collectSceneUrls(needed);
    await this.textureCache.preloadWindow(urls, new Set(urls));
  }

  public resize(width: number, height: number): void {
    if (this.disposed || this.contextLost) return;
    const nextW = Math.max(2, Math.floor(width));
    const nextH = Math.max(2, Math.floor(height));
    if (nextW === this.width && nextH === this.height) return;

    this.width = nextW;
    this.height = nextH;
    this.renderer.setSize(this.width, this.height, false);
    this.targetA.setSize(this.width, this.height);
    this.targetB.setSize(this.width, this.height);
    this.outputTarget?.setSize(this.width, this.height);

    (this.pass1Mat.uniforms['uResolution'].value as THREE.Vector2).set(this.width, this.height);
    (this.pass2Mat.uniforms['uResolution'].value as THREE.Vector2).set(this.width, this.height);
    (this.pass3Mat.uniforms['uResolution'].value as THREE.Vector2).set(this.width, this.height);
  }

  private applyBackgroundUniforms(prefix: 'A' | 'B', bg: SceneBackground, scene?: SceneItem): void {
    const u = this.pass1Mat.uniforms;
    // "Ảnh mờ": small pre-blurred copy of the scene's first slot photo (the shader's slot0).
    const blur = resolveBlurSettings(bg);
    const sp = blurShaderParams(blur);
    let blurTex: THREE.Texture | null = null;
    if (bg.style === 'blur') {
      const pid = scene?.slots[0];
      const asset = pid ? this.photoMap.get(pid) : undefined;
      const src = asset ? this.textureCache.get(asset.proxyUrl) : null;
      if (asset && src) blurTex = this.blurCache.get(asset.proxyUrl, src.image, blur.kind, blur.amount);
    }
    u[`uBgTex${prefix}`].value = blurTex ?? this.fallbackTex;
    (u[`uBgBlur${prefix}`].value as THREE.Vector4).set(blurTex ? 1 : 0, sp.brightness, sp.zoom, sp.vignette);
    u[`uBgStyle${prefix}`].value = BG_STYLE_CODE[bg.style] ?? 0;
    (u[`uBgCol1${prefix}`].value as THREE.Vector3).set(...hexToLinearRgb(bg.color1));
    (u[`uBgCol2${prefix}`].value as THREE.Vector3).set(...hexToLinearRgb(bg.color2));
    u[`uBgAngle${prefix}`].value = ((bg.angleDeg ?? 0) * Math.PI) / 180;
    u[`uBgPattern${prefix}`].value = BG_PATTERN_CODE[bg.pattern] ?? 0;
  }

  /** While the user edits a photo's Start/End keyframe on the preview, show exactly that pose. */
  private keyframePreview: 'start' | 'end' | null = null;

  public setKeyframePreview(phase: 'start' | 'end' | null): void {
    this.keyframePreview = phase;
  }

  private bindSceneSlots(
    prefix: 'A' | 'B',
    scene: SceneItem | undefined,
    motionProgress: number,
    sceneTimeSec: number,
    keyframePreview: 'start' | 'end' | null
  ): boolean {
    let missingTex = false;
    const layoutCode = scene ? LAYOUT_CODE[scene.layout] : 0;
    this.pass1Mat.uniforms[`uLayout${prefix}`].value = layoutCode;
    (this.pass1Mat.uniforms[`uCardStyle${prefix}`].value as THREE.Vector4).set(
      ...cardStyleToUniform(scene?.cardStyle)
    );
    this.pass1Mat.uniforms[`uMotionDir${prefix}`].value =
      MOTION_DIR_CODE[scene?.motionDirection ?? 'auto'] ?? 0;
    // Photos entering one after another (2–4 photo scenes), driven by scene time.
    const stagger = scene?.stagger;
    (this.pass1Mat.uniforms[`uStagger${prefix}`].value as THREE.Vector4).set(
      ...staggerAppear(stagger, scene?.slots.length ?? 0, sceneTimeSec)
    );
    this.pass1Mat.uniforms[`uStaggerStyle${prefix}`].value = stagger ? STAGGER_STYLE_CODE[stagger.style] ?? 1 : 0;

    for (let k = 0; k < 4; k++) {
      const pid = scene?.slots[k] ?? null;
      const asset = pid ? this.photoMap.get(pid) : undefined;
      const tex = asset ? this.textureCache.get(asset.proxyUrl) : null;
      if (asset && !tex) missingTex = true;

      this.pass1Mat.uniforms[`uTex${prefix}${k}`].value = tex ?? this.fallbackTex;
      (this.pass1Mat.uniforms[`uSize${prefix}${k}`].value as THREE.Vector2).set(
        asset ? asset.width : this.width,
        asset ? asset.height : this.height
      );
      const defaultFocalY = asset && asset.orientation === 'portrait' ? 0.36 : 0.5;
      (this.pass1Mat.uniforms[`uFocal${prefix}${k}`].value as THREE.Vector2).set(
        asset ? asset.focalPoint.x : 0.5,
        asset ? asset.focalPoint.y : defaultFocalY
      );
      const rotDeg = asset?.rotationDeg ?? 0;
      this.pass1Mat.uniforms[`uRot${prefix}${k}`].value = Math.round(rotDeg / 90) % 4;
      const expStops = asset?.exposure ?? 0;
      this.pass1Mat.uniforms[`uExp${prefix}${k}`].value = Math.pow(2, expStops);
      (this.pass1Mat.uniforms[`uAdj${prefix}${k}`].value as THREE.Vector4).set(
        ...photoAdjustToUniform(asset?.adjust)
      );
      const xf = resolvePhotoTransform(asset, motionProgress, keyframePreview);
      // UI stores y down; the shader works with y up.
      (this.pass1Mat.uniforms[`uXf${prefix}${k}`].value as THREE.Vector4).set(
        xf.x,
        -xf.y,
        xf.scale,
        (-xf.rotationDeg * Math.PI) / 180
      );
    }
    return missingTex;
  }

  private renderPipeline(
    frameIndex: number,
    fps: number,
    params: RenderParams | undefined,
    finalTarget: THREE.WebGLRenderTarget | null,
    compareMode: CompareMode = 'normal'
  ): number {
    if (this.disposed || this.contextLost) return this.lastSceneIndex;
    // Shaders still compiling in the background: skip instead of forcing a blocking compile
    if (!this.shadersReady) return this.lastSceneIndex;

    const look = params?.super8 ?? DEFAULT_SUPER8_PARAMS;
    const portraitMode = params?.portraitMode ?? 'smart-pairing';

    const state = evaluateTimeline({
      frameIndex,
      fps,
      slideCount: this.scenes.length,
      transitionDurationSec: params?.transitionDurationSec ?? 0.9,
      transitionDurations: this.scenes.map((sc) => sc.transitionDurationSec),
      simulate18fps: look.enabled && look.simulate18fps,
      ...projectDurationInput(this.scenes, params),
    });

    this.lastSceneIndex = state.slideAIndex;
    const sceneA = this.scenes[state.slideAIndex];
    const sceneB = this.scenes[state.slideBIndex];

    // Pin keyframes to Start/End only for the on-screen preview while editing; never when exporting.
    const keyframePreview = finalTarget ? null : this.keyframePreview;
    const missingA = this.bindSceneSlots('A', sceneA, state.motionProgressA, state.sceneTimeA, keyframePreview);
    const missingB = this.bindSceneSlots('B', sceneB, state.motionProgressB, state.sceneTimeB, keyframePreview);
    if (missingA || missingB) {
      void this.preloadAroundSceneIndex(state.slideAIndex);
    }

    const activeTrans = sceneA?.transitionType ?? params?.transitionType ?? 'light-leak';
    const transCode = TRANSITION_CODE_MAP[activeTrans] ?? 0;
    const projectTemplate = params?.motionTemplate ?? 'ken-burns-classic';
    const motionCode = MOTION_STYLE_CODE_MAP[sceneA?.motionTemplate ?? projectTemplate] ?? 0;
    const motionCodeB = MOTION_STYLE_CODE_MAP[sceneB?.motionTemplate ?? projectTemplate] ?? 0;
    const timeSec = frameIndex / Math.max(1, fps);

    this.pass1Mat.uniforms['uProgressA'].value = state.motionProgressA;
    this.pass1Mat.uniforms['uProgressB'].value = state.motionProgressB;
    this.pass1Mat.uniforms['uTransProgress'].value = state.transitionProgress;
    this.pass1Mat.uniforms['uTransType'].value = transCode;
    this.pass1Mat.uniforms['uMotionStyle'].value = motionCode;
    this.pass1Mat.uniforms['uMotionStyleB'].value = motionCodeB;
    this.pass1Mat.uniforms['uMotionIntensity'].value = params?.motionIntensity ?? 1.0;
    this.applyBackgroundUniforms('A', resolveSceneBackground(params, sceneA), sceneA);
    this.applyBackgroundUniforms('B', resolveSceneBackground(params, sceneB), sceneB);
    this.pass1Mat.uniforms['uBorderStyle'].value =
      BORDER_STYLE_CODE[params?.frameBorderStyle ?? 'auto'] ?? 0;
    this.pass1Mat.uniforms['uPortraitMode'].value = portraitMode === 'safe-top-third' ? 1 : 0;
    this.pass1Mat.uniforms['uSlideIndexA'].value = state.slideAIndex;
    this.pass1Mat.uniforms['uSlideIndexB'].value = state.slideBIndex;
    // Scenes marked "no Film Look" fade the look out (and back in across a transition).
    const lookOffA = sceneA?.filmLookOff ? 1 : 0;
    const lookOffB = sceneB?.filmLookOff ? 1 : 0;
    const lookMix = 1 - (lookOffA + (lookOffB - lookOffA) * (state.isInTransition ? state.transitionProgress : 0));
    this.pass1Mat.uniforms['uBokeh'].value =
      compareMode === 'before' ? 0 : look.enabled ? (look.bokeh ?? 0) * lookMix : 0;
    this.pass1Mat.uniforms['uTimeSec'].value = timeSec;

    const lookActive = compareMode === 'before' ? 0 : look.enabled && look.intensity > 0.001 ? 1 : 0;
    this.pass2Mat.uniforms['uEnabled'].value = lookActive;
    this.pass2Mat.uniforms['uHalation'].value = look.halation * look.intensity * lookMix;
    this.pass2Mat.uniforms['uBloom'].value = look.bloom * look.intensity * lookMix;

    // Text Timing (always / intro / outro / per-scene) + entry animation + EXIF Auto Date Stamp
    // Each scene follows the project text, turns it off or has its own (Đợt 5.4a).
    const sceneText = resolveSceneText(params?.textOverlay ?? DEFAULT_TEXT_OVERLAY, sceneA);
    const textCfg = sceneText.config;
    const timing = textCfg.timing ?? 'always';
    const perScene = timing === 'per-scene';

    const firstPid = sceneA?.slots.find((id) => id !== null) ?? null;
    const firstPhoto = firstPid ? this.photoMap.get(firstPid) : undefined;
    const dateOverride =
      textCfg.autoExifDate && firstPhoto ? formatExifDateStamp(firstPhoto.takenAtMs) : undefined;
    const titleOverride = sceneText.titleOverride;

    const slotSec = resolveSlideDurations(this.scenes.length, projectDurationInput(this.scenes, params))[state.slideAIndex] ?? 0;
    const anim = computeTextAnim({
      animation: textCfg.animation,
      timing,
      sceneIndex: state.slideAIndex,
      sceneCount: this.scenes.length,
      sceneLocalSec: state.slideAProgress * slotSec,
      slotSec,
      timeSec: state.timeSec,
      captionTiming: perScene ? sceneA?.captionTiming : undefined,
      charCount: typewriterCharCount(
        textCfg,
        (titleOverride ?? textCfg.title).trim(),
        (dateOverride ?? textCfg.dateText).trim()
      ),
    });
    const textAlpha = anim.alpha;
    const offset = clampTextOffset(perScene && sceneA?.captionOffset ? sceneA.captionOffset : textCfg.offset);

    const hasText =
      textAlpha > 0.001 &&
      sceneText.hasWords &&
      this.textRenderer.update(textCfg, {
        width: this.width,
        height: this.height,
        titleOverride,
        dateOverride,
        revealChars: anim.revealChars,
      });

    // Video Fade In / Fade Out multiplier
    let videoFade = 1.0;
    const fadeInSec = params?.videoFadeInSec ?? 0;
    const fadeOutSec = params?.videoFadeOutSec ?? 0;
    if (fadeInSec > 0.01 && timeSec < fadeInSec) {
      videoFade = Math.min(videoFade, Math.max(0, timeSec / fadeInSec));
    }
    if (fadeOutSec > 0.01) {
      const effectiveTotalSec = computeProjectDurationSec(this.scenes, params);
      const remainingSec = effectiveTotalSec - timeSec;
      if (remainingSec < fadeOutSec) {
        videoFade = Math.min(videoFade, Math.max(0, remainingSec / fadeOutSec));
      }
    }

    this.pass3Mat.uniforms['uFrameIndex'].value = state.effectiveFrameIndex;
    this.pass3Mat.uniforms['uDitherFrame'].value = frameIndex;
    this.pass3Mat.uniforms['uTimeSec'].value = timeSec;
    this.pass3Mat.uniforms['uEnabled'].value = look.enabled && look.intensity > 0.001 ? 1 : 0;
    this.pass3Mat.uniforms['uIntensity'].value = look.intensity * lookMix;
    this.pass3Mat.uniforms['uGrain'].value = look.grain;
    this.pass3Mat.uniforms['uGrainSize'].value = look.grainSize;
    this.pass3Mat.uniforms['uGateWeave'].value = look.gateWeave;
    this.pass3Mat.uniforms['uFlicker'].value = look.flicker;
    this.pass3Mat.uniforms['uVignette'].value = look.vignette;
    this.pass3Mat.uniforms['uRoundedCorners'].value = look.roundedCorners;
    this.pass3Mat.uniforms['uWarmShift'].value = look.warmShift;
    this.pass3Mat.uniforms['uFade'].value = look.fade;
    this.pass3Mat.uniforms['uContrast'].value = look.contrast;
    this.pass3Mat.uniforms['uSaturation'].value = look.saturation;
    this.pass3Mat.uniforms['uSepia'].value = look.sepia;
    this.pass3Mat.uniforms['uScanlines'].value = look.scanlines;
    this.pass3Mat.uniforms['uChromaBleed'].value = look.chromaBleed;
    this.pass3Mat.uniforms['uDustScratches'].value = look.dustScratches ?? 0;
    this.pass3Mat.uniforms['uAmbientLeak'].value = look.ambientLeak ?? 0;
    this.pass3Mat.uniforms['uAspectMask'].value = ASPECT_MASK_CODE[look.aspectMask ?? 'none'] ?? 0;
    this.pass3Mat.uniforms['uSprockets'].value = look.sprockets ? 1 : 0;
    this.pass3Mat.uniforms['uLutIntensity'].value = (params?.lutIntensity ?? 1) * lookMix;
    this.pass3Mat.uniforms['uHasLut'].value = this.customLutTex ? 1 : 0;
    this.pass3Mat.uniforms['uLutSize'].value = this.customLutSize;
    this.pass3Mat.uniforms['uHasText'].value = hasText ? 1 : 0;
    this.pass3Mat.uniforms['uTextAlpha'].value = textAlpha;
    // UI offsets are y-down; texture coordinates are y-up.
    (this.pass3Mat.uniforms['uTextOffset'].value as THREE.Vector2).set(offset.x, -(offset.y + anim.slideY));
    this.pass3Mat.uniforms['uVideoFade'].value = videoFade;
    this.pass3Mat.uniforms['uCompareMode'].value = COMPARE_MODE_CODE[compareMode] ?? 0;

    this.renderer.setRenderTarget(this.targetA);
    this.renderer.render(this.pass1Scene, this.orthoCam);

    this.renderer.setRenderTarget(this.targetB);
    this.renderer.render(this.pass2Scene, this.orthoCam);

    this.renderer.setRenderTarget(finalTarget);
    this.renderer.render(this.pass3Scene, this.orthoCam);

    return state.slideAIndex;
  }

  /**
   * Renders frame to canvas and returns the active scene index for UI timeline highlighting.
   */
  public renderFrame(
    frameIndex: number,
    fps: number,
    params?: RenderParams,
    compareMode: CompareMode = 'normal'
  ): number {
    return this.renderPipeline(frameIndex, fps, params, null, compareMode);
  }

  public renderFrameToBuffer(
    frameIndex: number,
    fps: number,
    params: RenderParams | undefined,
    targetBuffer: Uint8Array
  ): void {
    if (this.disposed || this.contextLost) {
      throw new Error('WebGL context không khả dụng khi xuất video.');
    }
    const output = this.ensureOutputTarget();
    this.renderPipeline(frameIndex, fps, params, output, 'normal');
    this.renderer.readRenderTargetPixels(output, 0, 0, this.width, this.height, targetBuffer);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);

    // Three.js compileAsync() keeps polling the shader programs until they are ready.
    // Freeing them mid-compile makes that poll throw "Cannot read properties of
    // undefined (reading 'isReady')" (happens in dev: React StrictMode mounts the
    // engine twice). So release GPU resources only once the compile has settled
    // (or after 30 s, in case it never does, e.g. context lost).
    if (this.shadersReady) {
      this.releaseGpuResources();
    } else {
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 30_000));
      void Promise.race([this.shadersReadyPromise, timeout]).finally(() =>
        this.releaseGpuResources()
      );
    }
  }

  private releaseGpuResources(): void {
    this.textureCache.dispose();
    this.blurCache.clear();
    this.textRenderer.dispose();
    this.customLutTex?.dispose();
    this.fallbackTex.dispose();
    this.targetA.dispose();
    this.targetB.dispose();
    this.outputTarget?.dispose();
    this.quadGeo.dispose();
    this.pass1Mat.dispose();
    this.pass2Mat.dispose();
    this.pass3Mat.dispose();
    this.renderer.dispose();
  }
}
