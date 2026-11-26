import type {
  CustomLutInfo,
  RenderParams,
  SceneItem,
  SlideAsset,
  WorkspaceData,
} from '@shared/types';
import { mergeRenderParams, takeSnapshot, type HistorySnapshot } from './storeHelpers';

export interface WorkspaceTab {
  id: string;
  name: string;
  sourceFolder?: string;
  isSampleOnly?: boolean;
  exportedInSession?: boolean;
  slides: SlideAsset[];
  scenes: SceneItem[];
  activeSceneId: string | null;
  renderParams: RenderParams;
  customLut: CustomLutInfo | null;
  markIn: number | null;
  markOut: number | null;
  frameIndex: number;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

export interface ActiveWorkspaceFields {
  slides: SlideAsset[];
  scenes: SceneItem[];
  activeSceneId: string | null;
  renderParams: RenderParams;
  customLut: CustomLutInfo | null;
  markIn: number | null;
  markOut: number | null;
  frameIndex: number;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

export function cloneRenderParams(rp: RenderParams): RenderParams {
  return {
    ...rp,
    backgroundOptions: rp.backgroundOptions ? { ...rp.backgroundOptions } : undefined,
    super8: { ...rp.super8 },
    textOverlay: {
      ...rp.textOverlay,
      offset: rp.textOverlay.offset ? { ...rp.textOverlay.offset } : undefined,
      look: rp.textOverlay.look ? { ...rp.textOverlay.look } : undefined,
    },
  };
}

export function cloneSlides(slides: SlideAsset[]): SlideAsset[] {
  return slides.map((s) => ({
    ...s,
    focalPoint: { ...s.focalPoint },
    adjust: s.adjust ? { ...s.adjust } : undefined,
    transform: s.transform ? { ...s.transform } : undefined,
    transformEnd: s.transformEnd ? { ...s.transformEnd } : undefined,
  }));
}

export function cloneScenes(scenes: SceneItem[]): SceneItem[] {
  return scenes.map((sc) => ({
    ...sc,
    slots: [...sc.slots],
    stagger: sc.stagger ? { ...sc.stagger } : undefined,
    cardStyle: sc.cardStyle ? { ...sc.cardStyle } : undefined,
    slotFrames: sc.slotFrames?.map((f) => (f ? { ...f } : null)),
    captionTiming: sc.captionTiming ? { ...sc.captionTiming } : undefined,
    captionOffset: sc.captionOffset ? { ...sc.captionOffset } : undefined,
    text: sc.text
      ? {
          ...sc.text,
          look: sc.text.look ? { ...sc.text.look } : undefined,
        }
      : undefined,
    background: sc.background ? { ...sc.background } : undefined,
  }));
}

export function cloneCustomLut(lut: CustomLutInfo | null): CustomLutInfo | null {
  return lut ? { ...lut } : null;
}

export function makeWorkspaceId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function syncActiveWorkspace(
  workspaces: WorkspaceTab[],
  activeWorkspaceId: string,
  fields: ActiveWorkspaceFields
): WorkspaceTab[] {
  const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
  if (idx < 0) return workspaces;
  const current = workspaces[idx];
  const updated: WorkspaceTab = {
    ...current,
    slides: fields.slides,
    scenes: fields.scenes,
    activeSceneId: fields.activeSceneId,
    renderParams: fields.renderParams,
    customLut: fields.customLut,
    markIn: fields.markIn,
    markOut: fields.markOut,
    frameIndex: fields.frameIndex,
    past: fields.past,
    future: fields.future,
  };
  return workspaces.map((w, i) => (i === idx ? updated : w));
}

export function workspaceFieldsFor(ws: WorkspaceTab): ActiveWorkspaceFields {
  return {
    slides: ws.slides,
    scenes: ws.scenes,
    activeSceneId: ws.activeSceneId ?? ws.scenes[0]?.id ?? null,
    renderParams: ws.renderParams,
    customLut: ws.customLut,
    markIn: ws.markIn,
    markOut: ws.markOut,
    frameIndex: ws.frameIndex,
    past: ws.past,
    future: ws.future,
  };
}

export function toWorkspaceData(ws: WorkspaceTab): WorkspaceData {
  return {
    id: ws.id,
    name: ws.name,
    ...(ws.sourceFolder ? { sourceFolder: ws.sourceFolder } : {}),
    slides: ws.slides,
    scenes: ws.scenes,
    renderParams: ws.renderParams,
    customLutPath: ws.customLut?.filePath ?? null,
    ...(ws.markIn !== null ? { markIn: ws.markIn } : {}),
    ...(ws.markOut !== null ? { markOut: ws.markOut } : {}),
  };
}

export function fromWorkspaceData(
  data: WorkspaceData,
  defaultParams: RenderParams
): WorkspaceTab {
  const merged = mergeRenderParams(defaultParams, data.renderParams);
  const scenes = data.scenes ?? [];
  return {
    id: data.id || makeWorkspaceId(),
    name: data.name || 'Dự án',
    sourceFolder: data.sourceFolder,
    isSampleOnly: false,
    exportedInSession: false,
    slides: data.slides ?? [],
    scenes,
    activeSceneId: scenes[0]?.id ?? null,
    renderParams: merged,
    customLut: data.customLutPath
      ? {
          name: data.customLutPath.split(/[\\/]/).pop() ?? 'LUT',
          filePath: data.customLutPath,
          size: 0,
        }
      : null,
    markIn: typeof data.markIn === 'number' ? data.markIn : null,
    markOut: typeof data.markOut === 'number' ? data.markOut : null,
    frameIndex: 0,
    past: [],
    future: [],
  };
}

export function cloneHistorySnapshots(list: HistorySnapshot[]): HistorySnapshot[] {
  return list.map((snap) => takeSnapshot(snap));
}
