export type SupportedFps = 23.976 | 24 | 25 | 30;

export type ExportCodec = 'h264' | 'prores422' | 'dnxhr_hq';

export type PreviewQuality = 'auto' | 'half' | 'full';

export type PortraitMode = 'smart-pairing' | 'matte-framed' | 'safe-top-third';

export type SceneLayoutId = 'single' | 'diptych' | 'triptych' | 'mosaic4';

export type MotionTemplateId =
  | 'ken-burns-classic'
  | 'parallax-25d'
  | 'polaroid-memories'
  | 'filmstrip-roll'
  | 'minimal-mosaic'
  | 'gallery-3d'
  | 'wall-3d';

export type MotionDirection =
  | 'auto'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'tilt-3d'
  | 'static';

export type BackgroundStyle =
  | 'blur'
  | 'black'
  | 'paper'
  | 'studio'
  | 'solid'
  | 'gradient'
  | 'pattern';

export type BackgroundPattern = 'dots' | 'stripes' | 'grid' | 'diamonds';

/** Colours/angle/pattern used by the 'solid', 'gradient' and 'pattern' background styles. */
export interface BackgroundOptions {
  /** sRGB hex, e.g. "#1a1410". Solid colour, gradient start, pattern base. */
  color1: string;
  /** sRGB hex. Gradient end, pattern ink. */
  color2: string;
  /** CSS-style gradient angle: 0 = bottom→top, 90 = left→right. */
  angleDeg: number;
  pattern: BackgroundPattern;
}

/** Per-scene background that replaces the project background for that scene only. */
export interface SceneBackground extends BackgroundOptions {
  style: BackgroundStyle;
}

export type FrameBorderStyle = 'auto' | 'none' | 'thin' | 'polaroid';

export type AspectMaskId = 'none' | '2.39' | '2.00' | '4:3';

export type OutputAspectId = '16:9' | '9:16' | '1:1';

export type TextTimingMode = 'always' | 'intro' | 'outro' | 'per-scene';

export type CompareMode = 'normal' | 'before' | 'split';

export type TransitionType =
  | 'film-dissolve'
  | 'dip-black'
  | 'dip-white'
  | 'dreamy-blur'
  | 'bloom-dissolve'
  | 'light-leak'
  | 'film-burn'
  | 'overexposure-flash'
  | 'filmstrip-push'
  | 'smooth-zoom-in'
  | 'smooth-zoom-out'
  | 'whip-pan-left'
  | 'whip-pan-right'
  | 'camera-shake-cut'
  | 'paper-slide'
  | 'page-curl'
  | 'flip-3d'
  | 'cube-3d'
  | 'dolly-3d'
  | 'page-turn-3d';

export type FilmLookId =
  | 'clean'
  | 'super8-family'
  | '16mm-doc'
  | '35mm-cinema'
  | 'slide-60s'
  | 'faded-70s'
  | 'instant-polaroid'
  | 'disposable-90s'
  | 'classic-bw'
  | 'sepia-vintage'
  | 'film-projector'
  | 'vhs-90s'
  | 'bleach-bypass';

export type DurationMode = 'fixed-total' | 'per-slide';

export type SortOrder = 'date-asc' | 'date-desc' | 'name-asc' | 'name-desc' | 'manual';

export type TextStyleId =
  | 'none'
  | 'date-stamp-90s'
  | 'minimal-fade'
  | 'editorial-serif'
  | 'filmstrip-label'
  | 'lower-third';

export type GpuTier = 'discrete' | 'integrated' | 'software' | 'unknown';

export type ImageOrientation = 'landscape' | 'portrait' | 'square';

export interface EngineCapabilities {
  webgl2: boolean;
  halfFloatRenderTarget: boolean;
  rendererInfo: string;
  maxTextureSize: number;
  gpuTier: GpuTier;
}

export interface Resolution {
  width: number;
  height: number;
}

export interface FocalPoint {
  x: number; // 0..1 (left -> right)
  y: number; // 0..1 (top -> bottom in UI coords)
}

/**
 * Offsets are fractions of the photo's frame (x right, y down; 0.1 = 10% of the frame),
 * scale 1 = fills the frame, rotation in degrees clockwise.
 */
export interface PhotoTransform {
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
}

/** How the move/zoom/rotate eases between a photo's Start and End keyframe. */
export type PhotoKeyframeEase = 'linear' | 'smooth' | 'ease-in' | 'ease-out';

/** Per-photo colour tweaks (all optional; missing = neutral). */
export interface PhotoAdjust {
  contrast?: number;   // 0.5..1.6, 1 = unchanged
  saturation?: number; // 0..2, 1 = unchanged
  warmth?: number;     // -1 (cool) .. +1 (warm), 0 = unchanged
  opacity?: number;    // 0..1, 1 = fully visible
}

export interface SlideAsset {
  id: string;
  name: string;
  originalPath: string;
  proxyUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  orientation: ImageOrientation;
  takenAtMs: number;
  focalPoint: FocalPoint;
  rotationDeg?: 0 | 90 | 180 | 270;
  exposure?: number; // -1..+1 stops
  /** Own contrast / saturation / warmth / opacity for this photo. */
  adjust?: PhotoAdjust;
  /** Move / scale / free rotation of the photo inside its frame (edited on the preview). */
  transform?: PhotoTransform;
  /** End keyframe: when set, the photo animates from `transform` (Start) to this over its scene. */
  transformEnd?: PhotoTransform;
  keyframeEase?: PhotoKeyframeEase;
  durationSec?: number;
  transitionType?: TransitionType;
}

/** Look of the photo frames in a scene (mostly visible with 2–4 photos or framed photos). */
export interface SceneCardStyle {
  corner?: number;  // 0..1  rounded corners (1 = pill / full circle-ish)
  shadow?: number;  // 0..2  drop shadow strength (1 = default)
  border?: number;  // 0..3  border width multiplier (1 = default, 0 = none)
  feather?: number; // 0..1  soft blurred edge (replaces the border)
}

/** How each photo of a 2–4 photo scene enters, one after another. */
export type StaggerStyle = 'fade' | 'slide' | 'zoom';

export interface SceneStagger {
  style: StaggerStyle;
  /** Seconds between one photo and the next starting to appear (default 0.35). */
  delaySec?: number;
  /** Seconds each photo takes to appear (default 0.6). */
  entrySec?: number;
}

export interface SceneItem {
  id: string;
  layout: SceneLayoutId;
  durationSec: number;
  transitionType: TransitionType;
  /** Photos of a 2–4 photo scene appear one after another (undefined = all at once). */
  stagger?: SceneStagger;
  /** Own frame look (rounded corners, shadow, border, soft edge) for this scene's photos. */
  cardStyle?: SceneCardStyle;
  /** True = this scene is shown without the Film Look and LUT (clean colours). */
  filmLookOff?: boolean;
  /** Own length (seconds) of the transition into the next scene (undefined = project setting). */
  transitionDurationSec?: number;
  motionDirection?: MotionDirection;
  /** Own Motion Template for this scene (undefined = follow the project's template). */
  motionTemplate?: MotionTemplateId;
  /** True = `motionTemplate` was picked by "Motion tự động", so a later auto run may replace it. */
  motionAuto?: boolean;
  caption?: string;
  /** When this scene's caption appears / disappears (per-scene captions only). */
  captionTiming?: CaptionTiming;
  /** Own caption position (per-scene captions only; otherwise the project's text position). */
  captionOffset?: TextOffset;
  /** Own background for this scene (otherwise the project background is used). */
  background?: SceneBackground;
  /** Photo IDs from `slides` (null = empty slot waiting for photo) */
  slots: (string | null)[];
}

export interface FilmLookParams {
  presetId: FilmLookId;
  enabled: boolean;
  intensity: number;       // 0..1
  halation: number;        // 0..1
  bloom: number;           // 0..1
  grain: number;           // 0..1
  grainSize: number;       // 0.8..2.5
  gateWeave: number;       // 0..1
  flicker: number;         // 0..1
  vignette: number;        // 0..1
  roundedCorners: number;  // 0..0.15
  warmShift: number;       // -1..1
  fade: number;            // 0..0.35
  contrast: number;        // 0.7..1.45
  saturation: number;      // 0..1.5 (0 = B&W)
  sepia: number;           // 0..1
  scanlines: number;       // 0..1 (VHS)
  chromaBleed: number;     // 0..1 (VHS)
  bokeh: number;           // 0..1 (floating warm bokeh/dust motes)
  dustScratches: number;   // 0..1 (vintage film dust & vertical scratches)
  ambientLeak: number;     // 0..1 (continuous gentle warm edge light leak)
  aspectMask: AspectMaskId;
  sprockets: boolean;      // Film projector edge sprocket holes
  simulate18fps: boolean;
}

/** Backwards-compatible alias */
export type Super8Params = FilmLookParams;

export const DEFAULT_SUPER8_PARAMS: FilmLookParams = {
  presetId: 'super8-family',
  enabled: true,
  intensity: 0.9,
  halation: 0.55,
  bloom: 0.28,
  grain: 0.36,
  grainSize: 1.5,
  gateWeave: 0.35,
  flicker: 0.18,
  vignette: 0.42,
  roundedCorners: 0.06,
  warmShift: 0.45,
  fade: 0.08,
  contrast: 1.06,
  saturation: 0.96,
  sepia: 0,
  scanlines: 0,
  chromaBleed: 0,
  bokeh: 0,
  dustScratches: 0.12,
  ambientLeak: 0,
  aspectMask: 'none',
  sprockets: false,
  simulate18fps: true,
};

/** How the text enters: fade (default), typewriter (letters one by one), slide up. */
export type TextAnimationId = 'fade' | 'typewriter' | 'slide-up';

/** Position offset of the text, as a fraction of the frame (x right, y down). */
export interface TextOffset {
  x: number;
  y: number;
}

/** When a scene's caption shows, in seconds from the start of the scene (missing = whole scene). */
export interface CaptionTiming {
  inSec?: number;
  outSec?: number;
}

export interface TextOverlayConfig {
  style: TextStyleId;
  /** Entry animation (missing = fade, the original behaviour). */
  animation?: TextAnimationId;
  /** Dragged position offset (missing = the style's own position). */
  offset?: TextOffset;
  title: string;
  subtitle: string;
  dateText: string;
  opacity: number; // 0..1
  timing: TextTimingMode;
  autoExifDate: boolean;
}

export const DEFAULT_TEXT_OVERLAY: TextOverlayConfig = {
  style: 'none',
  title: 'Kỷ niệm ngày chung đôi',
  subtitle: 'Hà Nội • Mùa thu',
  dateText: "'26 11 24",
  opacity: 0.92,
  timing: 'always',
  autoExifDate: false,
};

export interface CustomLutInfo {
  name: string;
  filePath: string;
  size: number;
}

export interface RenderParams {
  motionTemplate: MotionTemplateId;
  motionIntensity: number; // 0..1.5
  backgroundStyle: BackgroundStyle;
  /** Optional for older projects; DEFAULT_BACKGROUND_OPTIONS is used when missing. */
  backgroundOptions?: BackgroundOptions;
  frameBorderStyle: FrameBorderStyle;
  outputAspect: OutputAspectId;
  durationMode: DurationMode;
  totalDurationSec: number;
  defaultSlideDurationSec: number;
  handlesSec: number;
  videoFadeInSec: number;  // 0..1.5
  videoFadeOutSec: number; // 0..1.5
  transitionType: TransitionType;
  transitionDurationSec: number;
  portraitMode: PortraitMode;
  super8: FilmLookParams;
  lutIntensity: number;
  textOverlay: TextOverlayConfig;
}

export interface UserPreset {
  id: string;
  name: string;
  createdAt: string;
  renderParams: RenderParams;
}

export interface ProjectFileData {
  version: 1 | 2;
  savedAt: string;
  fps: SupportedFps;
  slides: SlideAsset[];
  scenes?: SceneItem[];
  renderParams: RenderParams;
  customLutPath: string | null;
  /** In / Out marks (frame index), Đợt 5.2c. Missing = not set. */
  markIn?: number | null;
  markOut?: number | null;
}

export interface FfmpegExportStartOptions {
  width: number;
  height: number;
  fps: number;
  codec: ExportCodec;
  defaultName: string;
}

export interface FfmpegExportStartDirectOptions {
  width: number;
  height: number;
  fps: number;
  codec: ExportCodec;
  filePath: string;
}

export interface FfmpegExportStartResult {
  canceled: boolean;
  jobId?: string;
  filePath?: string;
}

export interface FfmpegExportFinishResult {
  filePath: string;
  durationMs: number;
}

export interface SaveFileResult {
  canceled: boolean;
  filePath?: string;
}

export interface PickCubeLutResult {
  canceled: boolean;
  name?: string;
  filePath?: string;
  content?: string;
}

export interface OpenProjectResult {
  canceled: boolean;
  filePath?: string;
  data?: ProjectFileData;
}

export interface PickFolderResult {
  canceled: boolean;
  folderPath?: string;
}

export interface AppInfo {
  version: string;
  electron: string;
  platform: string;
  ffmpegAvailable: boolean;
}

export interface FrameSlideAPI {
  getAppInfo: () => Promise<AppInfo>;
  pickImages: () => Promise<SlideAsset[]>;
  pickFolderImages: () => Promise<SlideAsset[]>;
  importPaths: (paths: string[]) => Promise<SlideAsset[]>;
  rehydrateSlides: (slides: SlideAsset[]) => Promise<SlideAsset[]>;
  loadSampleImages: () => Promise<SlideAsset[]>;
  pickCubeLut: () => Promise<PickCubeLutResult>;
  readTextFile: (filePath: string) => Promise<string | null>;
  saveProject: (data: ProjectFileData, existingPath?: string | null) => Promise<SaveFileResult>;
  openProject: () => Promise<OpenProjectResult>;
  writeAutosave: (data: ProjectFileData) => Promise<void>;
  loadAutosave: () => Promise<ProjectFileData | null>;
  pickOutputFolder: () => Promise<PickFolderResult>;
  revealInFolder: (filePath: string) => Promise<void>;
  saveBinaryFile: (data: Uint8Array, defaultName: string) => Promise<SaveFileResult>;
  saveBinaryToPath: (data: Uint8Array, filePath: string) => Promise<void>;
  ffmpegExportStart: (opts: FfmpegExportStartOptions) => Promise<FfmpegExportStartResult>;
  ffmpegExportStartDirect: (opts: FfmpegExportStartDirectOptions) => Promise<{ jobId: string }>;
  ffmpegExportFrame: (jobId: string, rgbaData: Uint8Array) => Promise<void>;
  ffmpegExportFinish: (jobId: string) => Promise<FfmpegExportFinishResult>;
  ffmpegExportCancel: (jobId: string) => Promise<void>;
}
