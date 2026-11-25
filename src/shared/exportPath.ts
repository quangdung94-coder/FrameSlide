import type { ExportCodec } from './types';

/** File extension each export format writes. */
export function codecExtension(codec: ExportCodec): 'mp4' | 'mov' {
  return codec === 'h264' ? 'mp4' : 'mov';
}

const CODEC_TAG: Record<ExportCodec, string> = { h264: '', prores422: '_ProRes422', dnxhr_hq: '_DNxHR_HQ' };

/** Characters Windows does not allow in a file name, plus control characters. */
const BAD_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Makes text safe as a Windows file name (no extension); empty result = null. */
export function sanitizeFileStem(raw: string): string | null {
  const s = raw
    .replace(BAD_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (!s) return null;
  // CON, PRN, NUL, COM1… cannot be file names on Windows.
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) return `${s}_`;
  return s.slice(0, 120);
}

/** Last part of a path without its extension ("D:\\Cuoi\\Lan Anh.fsproj" → "Lan Anh"). */
export function pathStem(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const base = filePath.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return sanitizeFileStem(dot > 0 ? base.slice(0, dot) : base);
}

/** Suggested file name (no extension): project name (or "FrameSlide"), format, fps and part. */
export function defaultExportStem(opts: {
  projectFilePath?: string | null;
  codec: ExportCodec;
  fps: number;
  rangeSuffix?: string;
}): string {
  const base = pathStem(opts.projectFilePath) ?? 'FrameSlide';
  const fps = Number.isInteger(opts.fps) ? String(opts.fps) : opts.fps.toFixed(3);
  return `${base}_1080p_${fps}fps${CODEC_TAG[opts.codec]}${opts.rangeSuffix ?? ''}`;
}

/** Joins a folder and a file name with the folder's own separator. */
export function joinExportPath(folder: string, fileName: string): string {
  const sep = folder.includes('\\') ? '\\' : '/';
  return folder.endsWith(sep) ? `${folder}${fileName}` : `${folder}${sep}${fileName}`;
}

/** "name.mp4" → "name_2.mp4", "name_3.mp4"… the first name `exists` says is free. */
export function nextFreeFileName(fileName: string, exists: (name: string) => boolean, maxTries = 999): string {
  if (!exists(fileName)) return fileName;
  const dot = fileName.lastIndexOf('.');
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : '';
  for (let i = 2; i <= maxTries; i++) {
    const candidate = `${stem}_${i}${ext}`;
    if (!exists(candidate)) return candidate;
  }
  return `${stem}_${Date.now()}${ext}`;
}
