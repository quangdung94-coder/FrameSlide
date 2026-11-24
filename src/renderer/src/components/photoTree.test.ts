import { describe, expect, it } from 'vitest';
import type { SlideAsset } from '@shared/types';
import { buildPhotoTree, flattenPhotoTree, SAMPLE_FOLDER_KEY } from './photoTree';

function photo(id: string, originalPath: string): SlideAsset {
  return {
    id,
    name: id,
    originalPath,
    proxyUrl: '',
    thumbUrl: '',
    width: 100,
    height: 100,
    orientation: 'square',
    takenAtMs: 0,
    focalPoint: { x: 0.5, y: 0.5 },
  };
}

describe('buildPhotoTree', () => {
  it('uses the shared folder as root and nests sub-folders (Windows paths)', () => {
    const tree = buildPhotoTree([
      photo('a', 'D:\\Cuoi\\Le\\a.jpg'),
      photo('b', 'D:\\Cuoi\\Le\\b.jpg'),
      photo('c', 'D:\\Cuoi\\Tiec\\c.jpg'),
      photo('d', 'D:\\Cuoi\\d.jpg'),
    ]);
    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root.label).toBe('Cuoi');
    expect(root.photos.map((p) => p.id)).toEqual(['d']);
    expect(root.children.map((c) => c.label)).toEqual(['Le', 'Tiec']);
    expect(root.children[0].depth).toBe(1);
    expect(root.allPhotoIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('merges empty single-child chains and keeps unrelated drives apart', () => {
    const tree = buildPhotoTree([
      photo('a', 'D:/Anh/2024/Cuoi/a.jpg'),
      photo('b', 'E:/Su kien/b.jpg'),
    ]);
    expect(tree.map((n) => n.label)).toEqual(['D:/Anh/2024/Cuoi', 'E:/Su kien']);
  });

  it('puts photos without a folder (samples) in their own group', () => {
    const tree = buildPhotoTree([photo('s1', ''), photo('a', '/home/u/pics/a.jpg')]);
    expect(tree.map((n) => n.key)).toEqual([SAMPLE_FOLDER_KEY, 'home/u/pics']);
    expect(tree[1].label).toBe('pics');
  });

  it('flattens into folder headers and rows of N thumbnails, honouring collapsed folders', () => {
    const tree = buildPhotoTree([
      photo('a', 'D:/X/A/a.jpg'),
      photo('b', 'D:/X/A/b.jpg'),
      photo('c', 'D:/X/A/c.jpg'),
      photo('d', 'D:/X/B/d.jpg'),
    ]);
    const rows = flattenPhotoTree(tree, new Set(), 2);
    expect(rows.map((r) => (r.kind === 'folder' ? `F:${r.node.label}` : r.photos.length))).toEqual([
      'F:X',
      'F:A',
      2,
      1,
      'F:B',
      1,
    ]);
    const aKey = tree[0].children[0].key;
    const collapsedRows = flattenPhotoTree(tree, new Set([aKey]), 2);
    expect(collapsedRows).toHaveLength(4);
  });
});
