import type { SlideAsset } from '@shared/types';

/** One folder in the photo tray tree (Explorer-like). */
export interface PhotoFolderNode {
  /** Normalised full folder path ("/" separators), used as a stable key. */
  key: string;
  /** Label shown in the tray (may join several single-child folders: "2024/Cuoi"). */
  label: string;
  depth: number;
  /** Photos directly inside this folder, in tray order (listed after sub-folders). */
  photos: SlideAsset[];
  children: PhotoFolderNode[];
  /** All photo ids inside this folder and its sub-folders, in tray order. */
  allPhotoIds: string[];
}

export const SAMPLE_FOLDER_KEY = '__samples__';

function splitDir(originalPath: string): string[] {
  const norm = originalPath.replace(/\\/g, '/');
  const cut = norm.lastIndexOf('/');
  if (cut <= 0) return [];
  return norm.slice(0, cut).split('/').filter((seg) => seg.length > 0);
}

interface MutableNode {
  name: string;
  segments: string[];
  photos: SlideAsset[];
  children: Map<string, MutableNode>;
}

function makeNode(name: string, segments: string[]): MutableNode {
  return { name, segments, photos: [], children: new Map() };
}

/**
 * Groups tray photos by their folder on disk. The shared parent folder of every
 * photo becomes the top node; folders that only contain one sub-folder and no
 * photos are merged into one label so the tree stays shallow.
 */
export function buildPhotoTree(photos: SlideAsset[]): PhotoFolderNode[] {
  if (photos.length === 0) return [];

  const withDirs = photos.map((p) => ({ photo: p, dir: splitDir(p.originalPath) }));
  const real = withDirs.filter((x) => x.dir.length > 0);
  const loose = withDirs.filter((x) => x.dir.length === 0).map((x) => x.photo);

  // Longest common folder prefix of all real photos (case-insensitive, Windows paths).
  let common: string[] = real[0]?.dir.slice() ?? [];
  for (const { dir } of real) {
    let i = 0;
    while (i < common.length && i < dir.length && common[i].toLowerCase() === dir[i].toLowerCase()) i++;
    common = common.slice(0, i);
  }
  // Keep the deepest shared folder itself as the visible root (not its parent).
  const rootSegments = common.length > 0 ? common.slice(0, -1) : [];

  const top = makeNode('', rootSegments);
  for (const { photo, dir } of real) {
    let node = top;
    for (let i = rootSegments.length; i < dir.length; i++) {
      const seg = dir[i];
      const k = seg.toLowerCase();
      let child = node.children.get(k);
      if (!child) {
        child = makeNode(seg, dir.slice(0, i + 1));
        node.children.set(k, child);
      }
      node = child;
    }
    node.photos.push(photo);
  }

  const finalize = (n: MutableNode, depth: number): PhotoFolderNode => {
    let label = n.name;
    let cur = n;
    // Merge chains like "D:" → "Photos" → "2024" when they hold no photos directly.
    while (cur.photos.length === 0 && cur.children.size === 1) {
      const only = [...cur.children.values()][0];
      label = `${label}/${only.name}`;
      cur = only;
    }
    const children = [...cur.children.values()].map((c) => finalize(c, depth + 1));
    // Explorer order: sub-folders first, then the folder's own photos.
    const allPhotoIds = [...children.flatMap((c) => c.allPhotoIds), ...cur.photos.map((p) => p.id)];
    return {
      key: cur.segments.join('/').toLowerCase(),
      label,
      depth,
      photos: cur.photos,
      children,
      allPhotoIds,
    };
  };

  const roots = [...top.children.values()].map((c) => finalize(c, 0));
  if (top.photos.length > 0) {
    // Photos sitting directly in a drive root, e.g. "D:/a.jpg"
    roots.unshift({
      key: rootSegments.join('/').toLowerCase() || '/',
      label: rootSegments.join('/') || '/',
      depth: 0,
      photos: top.photos,
      children: [],
      allPhotoIds: top.photos.map((p) => p.id),
    });
  }
  if (loose.length > 0) {
    roots.push({
      key: SAMPLE_FOLDER_KEY,
      label: 'Ảnh mẫu / không rõ thư mục',
      depth: 0,
      photos: loose,
      children: [],
      allPhotoIds: loose.map((p) => p.id),
    });
  }

  // Keep tray order between sibling folders: the folder holding the earliest photo comes first.
  const order = new Map(photos.map((p, i) => [p.id, i]));
  const firstIdx = (n: PhotoFolderNode) =>
    n.allPhotoIds.reduce((min, id) => Math.min(min, order.get(id) ?? 0), Infinity);
  const sortRec = (nodes: PhotoFolderNode[]): PhotoFolderNode[] =>
    nodes
      .map((n) => ({ ...n, children: sortRec(n.children) }))
      .sort((a, b) => firstIdx(a) - firstIdx(b));
  return sortRec(roots);
}

export type TrayRow =
  | { kind: 'folder'; node: PhotoFolderNode; collapsed: boolean }
  | { kind: 'photos'; photos: SlideAsset[]; depth: number };

/** Flattens the tree into virtual-list rows: folder headers and rows of `cols` thumbnails. */
export function flattenPhotoTree(
  roots: PhotoFolderNode[],
  collapsed: ReadonlySet<string>,
  cols: number
): TrayRow[] {
  const rows: TrayRow[] = [];
  const perRow = Math.max(1, cols);
  const visit = (n: PhotoFolderNode) => {
    const isCollapsed = collapsed.has(n.key);
    rows.push({ kind: 'folder', node: n, collapsed: isCollapsed });
    if (isCollapsed) return;
    n.children.forEach(visit);
    for (let i = 0; i < n.photos.length; i += perRow) {
      rows.push({ kind: 'photos', photos: n.photos.slice(i, i + perRow), depth: n.depth });
    }
  };
  roots.forEach(visit);
  return rows;
}
