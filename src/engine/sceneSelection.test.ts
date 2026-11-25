import { describe, expect, it } from 'vitest';
import { clickSceneSelection, pruneSceneSelection } from './sceneSelection';

const order = ['a', 'b', 'c', 'd', 'e'];
const none = { selected: [], anchor: null };

describe('clickSceneSelection', () => {
  it('plain click selects only that scene and sets the anchor', () => {
    expect(clickSceneSelection(order, { selected: ['a', 'b'], anchor: 'a' }, 'c', 'single')).toEqual({
      selected: ['c'],
      anchor: 'c',
    });
  });

  it('Shift + click selects the run from the anchor, both directions', () => {
    const s1 = clickSceneSelection(order, none, 'b', 'single');
    expect(clickSceneSelection(order, s1, 'd', 'range').selected).toEqual(['b', 'c', 'd']);
    const s2 = clickSceneSelection(order, { selected: ['d'], anchor: 'd' }, 'a', 'range');
    expect(s2).toEqual({ selected: ['a', 'b', 'c', 'd'], anchor: 'd' });
    // A second Shift + click re-spans from the same anchor.
    expect(clickSceneSelection(order, s2, 'e', 'range').selected).toEqual(['d', 'e']);
  });

  it('Ctrl + click adds or removes one scene, kept in timeline order', () => {
    const s = clickSceneSelection(order, { selected: ['d'], anchor: 'd' }, 'a', 'toggle');
    expect(s.selected).toEqual(['a', 'd']);
    expect(clickSceneSelection(order, s, 'd', 'toggle').selected).toEqual(['a']);
  });

  it('Shift without an anchor acts like a plain click; unknown ids change nothing', () => {
    expect(clickSceneSelection(order, none, 'c', 'range').selected).toEqual(['c']);
    expect(clickSceneSelection(order, none, 'zz', 'single')).toBe(none);
  });
});

describe('pruneSceneSelection', () => {
  it('drops deleted scenes and keeps order', () => {
    expect(pruneSceneSelection(['c', 'a'], ['a', 'b', 'c'])).toEqual(['c', 'a']);
  });
});
