import { describe, expect, it } from 'vitest';
import { mapById, omitKeys, withOptional } from './objectUtils';

describe('objectUtils', () => {
  it('omitKeys drops keys without touching the source', () => {
    const src = { a: 1, b: 2, c: 3 };
    expect(omitKeys(src, 'a', 'c')).toEqual({ b: 2 });
    expect(src).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('withOptional sets or removes a key', () => {
    const src: { a: number; b?: number } = { a: 1, b: 2 };
    expect(withOptional(src, 'b', 5)).toEqual({ a: 1, b: 5 });
    expect('b' in withOptional(src, 'b', undefined)).toBe(false);
    expect('b' in withOptional(src, 'b', null)).toBe(false);
  });

  it('mapById only maps the matching item', () => {
    const items = [{ id: 'x', v: 1 }, { id: 'y', v: 1 }];
    const out = mapById(items, 'y', (it) => ({ ...it, v: 2 }));
    expect(out).toEqual([{ id: 'x', v: 1 }, { id: 'y', v: 2 }]);
    expect(out[0]).toBe(items[0]);
  });
});
