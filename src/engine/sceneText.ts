import type { SceneItem, SceneTextOverride, TextOverlayConfig } from '@shared/types';

/** What the engine draws for one scene: the text config plus the words for per-scene captions. */
export interface ResolvedSceneText {
  config: TextOverlayConfig;
  /** Words replacing `config.title` (project per-scene captions). */
  titleOverride?: string;
  /** False when there is nothing to draw on this scene (empty caption, text turned off…). */
  hasWords: boolean;
}

export const DEFAULT_OWN_TEXT_STYLE = 'minimal-fade' as const;

/**
 * Text for one scene (Đợt 5.4a, revises D23): a scene follows the project text, turns it off, or
 * has its own style / animation / words shown during the scene. Own text uses the scene's
 * caption timing and position, like a per-scene caption.
 */
export function resolveSceneText(project: TextOverlayConfig, scene: SceneItem | null | undefined): ResolvedSceneText {
  const own = scene?.text;
  if (own?.mode === 'off') {
    return { config: { ...project, style: 'none' }, hasWords: false };
  }
  if (own?.mode === 'own') {
    const config: TextOverlayConfig = {
      ...project,
      style: own.style ?? DEFAULT_OWN_TEXT_STYLE,
      animation: own.animation ?? project.animation,
      title: own.title ?? '',
      subtitle: own.subtitle ?? '',
      timing: 'per-scene',
    };
    const hasWords =
      config.style === 'date-stamp-90s' || Boolean(config.title.trim()) || Boolean(config.subtitle.trim());
    return { config, hasWords };
  }
  if (project.timing === 'per-scene') {
    const titleOverride = scene?.caption?.trim() ?? '';
    return {
      config: project,
      titleOverride,
      hasWords: project.style !== 'none' && (Boolean(titleOverride) || project.style === 'date-stamp-90s'),
    };
  }
  return { config: project, hasWords: project.style !== 'none' };
}

/** True when this scene shows text with its own timing and position (per-scene caption or own text). */
export function sceneTextIsPerScene(project: TextOverlayConfig, scene: SceneItem | null | undefined): boolean {
  if (scene?.text?.mode === 'own') return true;
  return scene?.text?.mode !== 'off' && project.timing === 'per-scene';
}

/**
 * The look of a scene's text without its words, for copy/paste and Scene Style: the target keeps
 * its own title and subtitle (D24: styles never carry the words).
 */
export function textStyleOnly(
  source: SceneTextOverride | undefined,
  target: SceneTextOverride | undefined
): SceneTextOverride | undefined {
  if (!source) return undefined;
  const out: SceneTextOverride = { mode: source.mode };
  if (source.mode === 'own') {
    if (source.style) out.style = source.style;
    if (source.animation) out.animation = source.animation;
    if (target?.title) out.title = target.title;
    if (target?.subtitle) out.subtitle = target.subtitle;
  }
  return out;
}
