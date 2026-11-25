import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_OVERLAY, type SceneItem, type TextOverlayConfig } from '@shared/types';
import { resolveSceneText, sceneTextIsPerScene, textStyleOnly } from './sceneText';

const scene = (extra: Partial<SceneItem> = {}): SceneItem => ({
  id: 's1',
  layout: 'single',
  durationSec: 3,
  transitionType: 'crossfade' as SceneItem['transitionType'],
  slots: ['p1'],
  ...extra,
});

const project: TextOverlayConfig = { ...DEFAULT_TEXT_OVERLAY, style: 'editorial-serif', timing: 'always', title: 'Dự án' };

describe('resolveSceneText', () => {
  it('follows the project by default', () => {
    const r = resolveSceneText(project, scene());
    expect(r.config).toBe(project);
    expect(r.hasWords).toBe(true);
    expect(r.titleOverride).toBeUndefined();
  });

  it('project per-scene captions use the scene caption and hide empty ones', () => {
    const p = { ...project, timing: 'per-scene' as const };
    expect(resolveSceneText(p, scene({ caption: ' Chào ' })).titleOverride).toBe('Chào');
    expect(resolveSceneText(p, scene()).hasWords).toBe(false);
  });

  it('"off" hides the text on that scene only', () => {
    const r = resolveSceneText(project, scene({ text: { mode: 'off' } }));
    expect(r.config.style).toBe('none');
    expect(r.hasWords).toBe(false);
  });

  it('own text uses its style and words even when the project text is off', () => {
    const off = { ...project, style: 'none' as const };
    const r = resolveSceneText(off, scene({ text: { mode: 'own', title: 'Lễ vu quy', animation: 'typewriter' } }));
    expect(r.config.style).toBe('minimal-fade');
    expect(r.config.title).toBe('Lễ vu quy');
    expect(r.config.subtitle).toBe('');
    expect(r.config.animation).toBe('typewriter');
    expect(r.config.timing).toBe('per-scene');
    expect(r.hasWords).toBe(true);
  });

  it('own text with no words draws nothing (except a date stamp)', () => {
    expect(resolveSceneText(project, scene({ text: { mode: 'own' } })).hasWords).toBe(false);
    expect(resolveSceneText(project, scene({ text: { mode: 'own', style: 'date-stamp-90s' } })).hasWords).toBe(true);
  });
});

describe('sceneTextIsPerScene', () => {
  it('is true for own text and for project per-scene captions, not for "off"', () => {
    expect(sceneTextIsPerScene(project, scene({ text: { mode: 'own' } }))).toBe(true);
    expect(sceneTextIsPerScene({ ...project, timing: 'per-scene' }, scene())).toBe(true);
    expect(sceneTextIsPerScene({ ...project, timing: 'per-scene' }, scene({ text: { mode: 'off' } }))).toBe(false);
    expect(sceneTextIsPerScene(project, scene())).toBe(false);
  });
});

describe('textStyleOnly', () => {
  it('carries the style but keeps the target words', () => {
    const out = textStyleOnly(
      { mode: 'own', style: 'lower-third', animation: 'slide-up', title: 'Nguồn', subtitle: 'A' },
      { mode: 'own', title: 'Đích' }
    );
    expect(out).toEqual({ mode: 'own', style: 'lower-third', animation: 'slide-up', title: 'Đích' });
  });

  it('no source = follow the project; "off" stays off', () => {
    expect(textStyleOnly(undefined, { mode: 'own', title: 'x' })).toBeUndefined();
    expect(textStyleOnly({ mode: 'off' }, { mode: 'own', title: 'x' })).toEqual({ mode: 'off' });
  });
});

describe('copy / paste and Scene Style carry the text look, not the words', () => {
  it('pasting "Chữ" copies the own style and keeps the target title', async () => {
    const { applySceneSettings, copySceneSettings } = await import('./sceneSettings');
    const src = scene({ text: { mode: 'own', style: 'lower-third', title: 'Nguồn' } });
    const dst = scene({ id: 's2', text: { mode: 'own', title: 'Đích' } });
    const out = applySceneSettings(dst, copySceneSettings(src), ['caption']);
    expect(out.text).toEqual({ mode: 'own', style: 'lower-third', title: 'Đích' });
    // Pasting from a scene that follows the project removes the own text.
    expect('text' in applySceneSettings(dst, copySceneSettings(scene()), ['caption'])).toBe(false);
  });

  it('a saved Scene Style never stores words and applies the look', async () => {
    const { applySceneStyle, sceneStyleFromScene } = await import('./sceneStyles');
    const style = sceneStyleFromScene(scene({ text: { mode: 'own', style: 'editorial-serif', title: 'Riêng' } }), 'A', 'a');
    expect(style.settings.text).toEqual({ mode: 'own', style: 'editorial-serif' });
    const out = applySceneStyle(scene({ id: 's3', caption: 'x' }), style);
    expect(out.text).toEqual({ mode: 'own', style: 'editorial-serif' });
  });
});
