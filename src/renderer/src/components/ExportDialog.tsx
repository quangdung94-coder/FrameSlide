import { useState } from 'react';
import type { AppInfo, ExportCodec } from '@shared/types';
import { codecExtension } from '@shared/exportPath';
import { currentExportRange, type ExportJobs } from '../hooks/useExportJobs';
import { rangeFrameCount, type ExportRangeMode } from '@engine/frameRange';
import { useAppStore } from '../store/useAppStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { Modal, SliderRow } from './ui';

const FORMATS: { codec: ExportCodec; label: string; hint: string; ffmpeg: boolean }[] = [
  { codec: 'h264', label: 'MP4 H.264', hint: 'File nhẹ, mở được ở mọi nơi. Hợp để gửi xem thử hoặc dựng nhanh.', ffmpeg: false },
  { codec: 'dnxhr_hq', label: 'DNxHR HQ', hint: '.mov chất lượng dựng phim, nặng. Hợp DaVinci Resolve trên Windows.', ffmpeg: true },
  { codec: 'prores422', label: 'ProRes 422', hint: '.mov chất lượng dựng phim, nặng. Hợp Premiere / Final Cut.', ffmpeg: true },
];

const SECTION = 'space-y-1.5';
const LABEL = 'text-xs font-semibold tracking-wide text-zinc-400 uppercase';

interface Props {
  jobs: ExportJobs;
  appInfo: AppInfo | null;
  exportSize: { width: number; height: number };
  effectiveDurationSec: number;
  onClose: () => void;
}

/**
 * Export dialog (Đợt 6.1), top to bottom in the order of the decisions: one clip or a batch, where
 * it goes (folder + name, shown before the render), which part, which format, options, then one
 * "Xuất" button with a summary. Progress and result below.
 */
export function ExportDialog({ jobs, appInfo, exportSize, effectiveDurationSec, onClose }: Props) {
  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const slides = useAppStore((s) => s.slides);
  const sceneCount = useAppStore((s) => s.scenes.length);
  const fadeIn = useAppStore((s) => s.renderParams.videoFadeInSec);
  const fadeOut = useAppStore((s) => s.renderParams.videoFadeOutSec);
  const setVideoFadeInSec = useAppStore((s) => s.setVideoFadeInSec);
  const setVideoFadeOutSec = useAppStore((s) => s.setVideoFadeOutSec);
  const codec = usePrefsStore((p) => p.exportCodec);
  const openAfter = usePrefsStore((p) => p.openFolderAfterExport);
  const setPrefs = usePrefsStore((p) => p.setPrefs);
  const { isExporting, progress, summary, statusMsg, error } = jobs;
  const fps = useAppStore((s) => s.fps);
  useAppStore((s) => s.projectFilePath);
  // Subscribed so the range labels follow new marks / scene selection while the dialog is open.
  useAppStore((s) => s.markIn);
  useAppStore((s) => s.markOut);
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const sceneNo = useAppStore((s) => s.scenes.findIndex((sc) => sc.id === activeSceneId) + 1);
  const rangeSec = (mode: ExportRangeMode) => {
    const { range } = currentExportRange(mode);
    return range ? rangeFrameCount(range) / fps : null;
  };
  const inoutSec = rangeSec('inout');
  const sceneSec = rangeSec('scene');
  const rangeOptions: { mode: ExportRangeMode; label: string; sec: number | null; hint: string }[] = [
    { mode: 'all', label: 'Toàn bộ clip', sec: effectiveDurationSec, hint: '' },
    { mode: 'inout', label: 'Đoạn In–Out', sec: inoutSec, hint: 'Chưa đặt: bấm I / O trên thanh phát' },
    { mode: 'scene', label: sceneNo > 0 ? `Scene ${sceneNo}` : 'Scene đang chọn', sec: sceneSec, hint: 'Chưa chọn scene' },
  ];
  const chosen = rangeOptions.find((o) => o.mode === jobs.rangeMode);
  // A mode with nothing to export (no marks, no scene) shows and exports the whole clip.
  const rangeMode: ExportRangeMode = chosen && chosen.sec !== null ? jobs.rangeMode : 'all';
  const exportSec = rangeOptions.find((o) => o.mode === rangeMode)?.sec ?? effectiveDurationSec;

  const hasApi = Boolean(window.frameSlideAPI);
  const ffmpegOk = hasApi && Boolean(appInfo?.ffmpegAvailable);
  const format = FORMATS.find((f) => f.codec === codec) ?? FORMATS[0];
  const formatBlocked = format.ffmpeg && !ffmpegOk;
  const ext = codecExtension(codec);
  const clipCount = Math.ceil(slides.length / Math.max(1, jobs.batchSlidesPerClip));
  const folder = jobs.outputFolder;
  const canExport =
    !isExporting &&
    !formatBlocked &&
    (tab === 'single' ? sceneCount > 0 && (folder || !hasApi) : hasApi && slides.length > 0 && Boolean(folder));

  return (
    <Modal
      title="Xuất video"
      ariaLabel="Xuất video"
      widthClass="max-w-lg"
      closeTitle="Đóng (Esc). Việc xuất đang chạy vẫn tiếp tục."
      onClose={onClose}
    >
      <div className="grid grid-cols-2 overflow-hidden rounded border border-zinc-700" role="tablist" aria-label="Kiểu xuất">
        {(
          [
            ['single', 'Một clip', `${exportSize.width}×${exportSize.height} • ${sceneCount} scene`],
            ['batch', 'Nhiều clip B-roll', `Chia ${slides.length} ảnh thành nhiều clip`],
          ] as const
        ).map(([id, label, sub]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            disabled={isExporting}
            onClick={() => setTab(id)}
            className={`flex flex-col items-center py-1.5 text-xs disabled:opacity-60 ${
              tab === id ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <span className="font-semibold">{label}</span>
            <span className={tab === id ? 'text-zinc-900' : 'text-zinc-500'}>{sub}</span>
          </button>
        ))}
      </div>

      <section className={SECTION}>
        <div className={LABEL}>1. Lưu vào</div>
        {hasApi ? (
          <div className="flex items-center gap-1.5">
            <div
              className="min-w-0 flex-1 truncate rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200"
              title={folder}
            >
              📁 {folder || 'Chưa chọn thư mục'}
            </div>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void jobs.pickFolder()}
              className="shrink-0 rounded border border-amber-400/70 bg-zinc-800 px-2 py-1.5 text-xs font-medium text-amber-200 hover:bg-zinc-700 disabled:opacity-40"
            >
              Đổi thư mục…
            </button>
            {folder && (
              <button
                type="button"
                title="Mở thư mục này"
                onClick={() => void window.frameSlideAPI?.openFolder(folder)}
                className="shrink-0 rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
              >
                Mở
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Bản xem trên trình duyệt: video tải về thư mục Tải xuống.</p>
        )}
        {tab === 'single' ? (
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="shrink-0">Tên file</span>
            <input
              type="text"
              value={jobs.fileStem}
              disabled={isExporting}
              placeholder={jobs.suggestedStem(codec)}
              onChange={(e) => jobs.setFileStem(e.target.value)}
              spellCheck={false}
              aria-label="Tên file video"
              className="h-8 min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 placeholder:text-zinc-500"
            />
            <span className="shrink-0 font-mono text-zinc-500">.{ext}</span>
          </label>
        ) : (
          <p className="text-xs text-zinc-500">
            Các clip đặt tên …_BRoll_01, _02… Trùng tên file cũ thì tự thêm _2, không ghi đè.
          </p>
        )}
      </section>

      {tab === 'single' ? (
        <section className={SECTION}>
          <div className={LABEL}>2. Xuất phần nào</div>
          <div className="grid grid-cols-3 overflow-hidden rounded border border-zinc-700" role="radiogroup" aria-label="Xuất phần nào">
            {rangeOptions.map((o) => {
              const on = rangeMode === o.mode;
              const off = o.sec === null || isExporting;
              return (
                <button
                  key={o.mode}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={off}
                  title={o.sec === null ? o.hint : undefined}
                  onClick={() => jobs.setRangeMode(o.mode)}
                  className={`flex flex-col items-center px-1 py-1.5 text-xs disabled:opacity-40 ${
                    on ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <span className="font-semibold">{o.label}</span>
                  <span className={on ? 'text-zinc-900' : 'text-zinc-500'}>{o.sec === null ? '—' : `${o.sec.toFixed(1)}s`}</span>
                </button>
              );
            })}
          </div>
          {rangeMode !== 'all' && (
            <p className="text-2xs text-zinc-500">
              Hạt phim, bụi, rung giữ đúng như khi xem trước. Fade In/Out vẫn tính theo đầu/cuối cả clip.
            </p>
          )}
        </section>
      ) : (
        <section className={SECTION}>
          <div className={LABEL}>2. Chia clip</div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Số ảnh mỗi clip
            <input
              type="number"
              min={1}
              max={30}
              value={jobs.batchSlidesPerClip}
              disabled={isExporting}
              onChange={(e) => jobs.setBatchSlidesPerClip(Math.max(1, Number(e.target.value)))}
              className="h-8 w-16 rounded border border-zinc-700 bg-zinc-900 px-2 text-zinc-100"
            />
            <span>
              → <strong className="text-zinc-200">{clipCount}</strong> clip từ {slides.length} ảnh
            </span>
          </label>
        </section>
      )}

      <section className={SECTION}>
        <div className={LABEL}>3. Định dạng</div>
        <div className="grid grid-cols-3 overflow-hidden rounded border border-zinc-700" role="radiogroup" aria-label="Định dạng">
          {FORMATS.map((f) => {
            const on = codec === f.codec;
            const off = isExporting || (f.ffmpeg && !ffmpegOk);
            return (
              <button
                key={f.codec}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={off}
                title={f.ffmpeg && !ffmpegOk ? 'Cần FFmpeg (có sẵn trong bản cài FrameSlide.exe)' : f.hint}
                onClick={() => setPrefs({ exportCodec: f.codec })}
                className={`flex flex-col items-center py-1.5 text-xs disabled:opacity-40 ${
                  on ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <span className="font-semibold">{f.label}</span>
                <span className={on ? 'text-zinc-900' : 'text-zinc-500'}>.{codecExtension(f.codec)}{f.ffmpeg ? ' • bt709' : ''}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500">
          {formatBlocked ? 'Định dạng này cần FFmpeg, máy này chưa có. Chọn MP4 hoặc dùng bản cài FrameSlide.exe.' : format.hint}
        </p>
      </section>

      <section className={SECTION}>
        <div className={LABEL}>4. Tùy chọn</div>
        <div className="grid grid-cols-2 gap-2">
          <SliderRow label="Fade In đầu (s)" value={fadeIn} min={0} max={1.5} step={0.1} disabled={isExporting} onChange={setVideoFadeInSec} />
          <SliderRow label="Fade Out cuối (s)" value={fadeOut} min={0} max={1.5} step={0.1} disabled={isExporting} onChange={setVideoFadeOutSec} />
        </div>
        {hasApi && (
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={openAfter}
              onChange={(e) => setPrefs({ openFolderAfterExport: e.target.checked })}
              className="accent-amber-400"
            />
            Mở thư mục khi xuất xong
          </label>
        )}
      </section>

      <div className="space-y-1.5 border-t border-zinc-800 pt-3">
        <p className="truncate text-xs text-zinc-400" title={folder}>
          {tab === 'single'
            ? `${exportSize.width}×${exportSize.height} • ${fps}fps • ${exportSec.toFixed(1)}s • ${format.label}`
            : `${clipCount} clip • ${exportSize.width}×${exportSize.height} • ${fps}fps • ${format.label}`}
          {folder ? ` → ${folder}` : ''}
        </p>
        <button
          type="button"
          onClick={() => void (tab === 'single' ? jobs.exportSingle() : jobs.exportBatch())}
          disabled={!canExport}
          className="w-full rounded bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
        >
          {isExporting ? 'Đang xuất…' : tab === 'single' ? `Xuất ${format.label}` : `Xuất ${clipCount} clip ${format.label}`}
        </button>
      </div>

      {progress && (
        <div className="space-y-1.5 rounded border border-zinc-700 bg-zinc-900 p-2.5">
          <div className="flex justify-between text-xs">
            <span>
              {progress.clipCount ? `Clip ${progress.clipIndex}/${progress.clipCount}` : 'Đang render 1080p...'}
            </span>
            <span className="font-mono">{progress.percent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-800">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              Frame {progress.currentFrame}/{progress.totalFrames}
            </span>
            <button onClick={jobs.cancel} className="text-red-400 hover:text-red-300">
              Hủy
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-2.5 text-xs text-emerald-200">
          <div className="font-semibold">
            Xuất xong {summary.clipCount ? `${summary.clipCount} clip ` : ''}({summary.codec.toUpperCase()})
          </div>
          <div className="mt-0.5 font-mono text-xs text-emerald-300">
            {summary.totalFrames} frames trong {(summary.durationMs / 1000).toFixed(2)}s •{' '}
            {summary.speedFactor.toFixed(2)}x realtime
          </div>
          {summary.filePath && (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="truncate text-xs text-zinc-400" title={summary.filePath}>
                {summary.filePath}
              </div>
              {window.frameSlideAPI && (
                <button
                  type="button"
                  onClick={() => void window.frameSlideAPI?.revealInFolder(summary.filePath!)}
                  className="shrink-0 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30"
                >
                  Mở thư mục
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {statusMsg && (
        <div className="rounded border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-300">{statusMsg}</div>
      )}

      {error && (
        <div className="rounded border border-red-500/40 bg-red-950/40 p-2 text-xs text-red-300">{error}</div>
      )}
    </Modal>
  );
}
