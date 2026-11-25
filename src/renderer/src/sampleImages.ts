import type { SlideAsset } from '@shared/types';

/** Generated SVG sample photos used when the app runs in a normal browser (no Electron). */
export function createBrowserFallbackSamples(): SlideAsset[] {
  const makeSvg = (w: number, h: number, bg1: string, bg2: string, accent: string, label: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${Math.round(w * 0.65)}" cy="${Math.round(h * 0.35)}" r="${Math.round(Math.min(w, h) * 0.14)}" fill="${accent}"/>
      <text x="50%" y="85%" fill="#ffffff" fill-opacity="0.7" font-family="sans-serif" font-size="48" text-anchor="middle">${label}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  return [
    {
      id: 'web-1',
      name: 'Sample_01_Ngang.jpg',
      originalPath: '',
      proxyUrl: makeSvg(1920, 1280, '#2a2038', '#c96f3c', '#fff7df', 'GOLDEN HOUR 16:9'),
      thumbUrl: makeSvg(320, 213, '#2a2038', '#c96f3c', '#fff7df', '01'),
      width: 1920,
      height: 1280,
      orientation: 'landscape',
      takenAtMs: 1700000001000,
      focalPoint: { x: 0.5, y: 0.5 },
    },
    {
      id: 'web-2',
      name: 'Sample_02_DocA.jpg',
      originalPath: '',
      proxyUrl: makeSvg(1280, 1920, '#2b362e', '#61503e', '#fff4d2', 'PORTRAIT A'),
      thumbUrl: makeSvg(213, 320, '#2b362e', '#61503e', '#fff4d2', '02'),
      width: 1280,
      height: 1920,
      orientation: 'portrait',
      takenAtMs: 1700000002000,
      focalPoint: { x: 0.5, y: 0.36 },
    },
    {
      id: 'web-3',
      name: 'Sample_03_DocB.jpg',
      originalPath: '',
      proxyUrl: makeSvg(1280, 1920, '#3c2f2f', '#7c5c4c', '#ffd599', 'PORTRAIT B'),
      thumbUrl: makeSvg(213, 320, '#3c2f2f', '#7c5c4c', '#ffd599', '03'),
      width: 1280,
      height: 1920,
      orientation: 'portrait',
      takenAtMs: 1700000003000,
      focalPoint: { x: 0.5, y: 0.36 },
    },
    {
      id: 'web-4',
      name: 'Sample_04_Ngang.jpg',
      originalPath: '',
      proxyUrl: makeSvg(1920, 1280, '#0f172a', '#24344d', '#ffd782', 'EVENING LIGHTS'),
      thumbUrl: makeSvg(320, 213, '#0f172a', '#24344d', '#ffd782', '04'),
      width: 1920,
      height: 1280,
      orientation: 'landscape',
      takenAtMs: 1700000004000,
      focalPoint: { x: 0.5, y: 0.5 },
    },
  ];
}
