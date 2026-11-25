import { useEffect, useState, type CSSProperties } from 'react';
import type { FilmLookParams, SceneLayoutId } from '@shared/types';
import { LAYOUT_PREVIEW_CELLS, lookPreviewStyle } from '@engine/presetPreview';
import { useAppStore } from '../../store/useAppStore';

/** Fallback "photos" when the tray is empty: warm gradients that read as a wedding scene. */
const FALLBACK_BG = [
  'linear-gradient(135deg,#d9a06b,#6b3e2e)',
  'linear-gradient(135deg,#9fb4c7,#3c4a5c)',
  'linear-gradient(135deg,#e3c7a1,#8a5a3c)',
  'linear-gradient(135deg,#b88aa0,#4a2f3d)',
];

/** SVG fractal noise used as the grain layer. */
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='96' height='96' filter='url(%23n)'/%3E%3C/svg%3E\")";

function usePreviewPhotos(): string[] {
  const slides = useAppStore((s) => s.slides);
  return slides.slice(0, 4).map((p) => p.thumbUrl);
}

function photoStyle(urls: string[], i: number): CSSProperties {
  const url = urls.length ? urls[i % urls.length] : null;
  return url
    ? { backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: FALLBACK_BG[i % FALLBACK_BG.length] };
}

interface FrameProps {
  hovered: boolean;
  children: React.ReactNode;
}

const Frame = ({ hovered, children }: FrameProps) => (
  <div
    className={`relative aspect-video w-full overflow-hidden rounded-sm bg-zinc-950 ${hovered ? '' : 'opacity-90'}`}
    aria-hidden
  >
    {children}
  </div>
);

/** Template tile preview: while hovered it steps through the template's layout pattern with a slow zoom. */
export function TemplateThumb({ layouts, hovered }: { layouts: SceneLayoutId[]; hovered: boolean }) {
  const urls = usePreviewPhotos();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!hovered) {
      setStep(0);
      return;
    }
    const t = window.setInterval(() => setStep((s) => s + 1), 1100);
    return () => window.clearInterval(t);
  }, [hovered]);

  const layout = layouts[step % layouts.length] ?? 'single';
  let photoIdx = step;
  return (
    <Frame hovered={hovered}>
      {LAYOUT_PREVIEW_CELLS[layout].map(([x, y, w, h], i) => (
        <div
          key={`${step}-${i}`}
          className="absolute overflow-hidden rounded-[2px]"
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
        >
          <div className={`h-full w-full ${hovered ? 'fs-kenburns' : ''}`} style={photoStyle(urls, photoIdx++)} />
        </div>
      ))}
    </Frame>
  );
}

/** Film Look tile preview: CSS approximation of colour, vignette, grain, flicker and weave. */
export function LookThumb({ look, hovered }: { look: FilmLookParams; hovered: boolean }) {
  const urls = usePreviewPhotos();
  const s = lookPreviewStyle(look);
  return (
    <Frame hovered={hovered}>
      <div className={`absolute inset-0 ${hovered && s.weave ? 'fs-weave' : ''}`}>
        <div className="absolute inset-0" style={{ ...photoStyle(urls, 0), filter: s.filter }} />
        {s.fade > 0 && <div className="absolute inset-0" style={{ background: '#5a5048', opacity: s.fade, mixBlendMode: 'lighten' }} />}
        {s.glow > 0 && (
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(circle at 100% 0%, #ff7a3c 0%, transparent 55%)', opacity: s.glow, mixBlendMode: 'screen' }}
          />
        )}
        {s.vignette > 0 && (
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${s.vignette}) 100%)` }}
          />
        )}
        {s.grain > 0 && (
          <div
            className={`absolute inset-0 ${hovered ? 'fs-grain' : ''}`}
            style={{ backgroundImage: GRAIN_URL, opacity: s.grain, mixBlendMode: 'overlay' }}
          />
        )}
        {hovered && s.flicker && <div className="fs-flicker absolute inset-0 bg-white" />}
      </div>
    </Frame>
  );
}
