import type { AppInfo, ExportCodec } from '@shared/types';
import { currentExportRange, type ExportJobs } from '../hooks/useExportJobs';
import { rangeFrameCount, type ExportRangeMode } from '@engine/frameRange';
import { useAppStore } from '../store/useAppStore';
import { Group, Modal, SelectField, SliderRow, type SelectOption } from './ui';

const BATCH_CODEC_OPTIONS: SelectOption<ExportCodec>[] = [
  { value: 'h264', label: 'MP4 H.264' },
  { value: 'dnxhr_hq', label: 'DNxHR HQ (.mov)' },
  { value: 'prores422', label: 'ProRes 422 (.mov)' },
];

const SECONDARY_BTN =
  'w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-40';

interface Props {
  jobs: ExportJobs;
  appInfo: AppInfo | null;
  exportSize: { width: number; height: number };
  effectiveDurationSec: number;
  onClose: () => void;
}

/** Export dialog: single clip (MP4 / DNxHR / ProRes), batch export, progress and result. */
export function ExportDialog({ jobs, appInfo, exportSize, effectiveDurationSec, onClose }: Props) {
  const slides = useAppStore((s) => s.slides);
  const sceneCount = useAppStore((s) => s.scenes.length);
  const fadeIn = useAppStore((s) => s.renderParams.videoFadeInSec);
  const fadeOut = useAppStore((s) => s.renderParams.videoFadeOutSec);
  const setVideoFadeInSec = useAppStore((s) => s.setVideoFadeInSec);
  const setVideoFadeOutSec = useAppStore((s) => s.setVideoFadeOutSec);
  const { isExporting, progress, summary, statusMsg, error } = jobs;
  const fps = useAppStore((s) => s.fps);
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
  const ffmpegOff = !window.frameSlideAPI || !appInfo?.ffmpegAvailable || sceneCount === 0 || isExporting;

  return (
    <Modal
      title="Xuất video"
      ariaLabel="Xuất video"
      widthClass="max-w-lg"
      closeTitle="Đóng (Esc). Việc xuất đang chạy vẫn tiếp tục."
      onClose={onClose}
    >
      <Group
        id="export-single"
        title={
          <>
            Xuất 1 clip ({exportSize.width}×{exportSize.height} • {sceneCount} Scene •{' '}
            {exportSec.toFixed(1)}s)
          </>
        }
      >
        <div className="flex flex-col gap-1 text-xs text-zinc-400">
          Xuất phần nào
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
            <span className="text-2xs text-zinc-500">
              Hạt phim, bụi, rung giữ đúng như khi xem trước. Fade In/Out vẫn tính theo đầu/cuối cả clip. Batch Export luôn xuất toàn bộ.
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SliderRow label="Fade In đầu (s)" value={fadeIn} min={0} max={1.5} step={0.1} disabled={isExporting} onChange={setVideoFadeInSec} />
          <SliderRow label="Fade Out cuối (s)" value={fadeOut} min={0} max={1.5} step={0.1} disabled={isExporting} onChange={setVideoFadeOutSec} />
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={jobs.exportMp4}
            disabled={sceneCount === 0 || isExporting}
            className="w-full rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            Xuất MP4 H.264 (WebCodecs)
          </button>
          <button onClick={() => jobs.exportFfmpeg('dnxhr_hq')} disabled={ffmpegOff} className={SECONDARY_BTN}>
            Xuất DNxHR HQ (.mov • bt709)
          </button>
          <button onClick={() => jobs.exportFfmpeg('prores422')} disabled={ffmpegOff} className={SECONDARY_BTN}>
            Xuất ProRes 422 (.mov • bt709)
          </button>
        </div>
      </Group>

      <Group id="export-batch" title="Batch Export (Chia nhiều clip B-roll)" accent>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Số ảnh / clip
            <input
              type="number"
              min={1}
              max={30}
              value={jobs.batchSlidesPerClip}
              disabled={isExporting}
              onChange={(e) => jobs.setBatchSlidesPerClip(Math.max(1, Number(e.target.value)))}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 h-8 text-zinc-100"
            />
          </label>
          <SelectField
            label="Định dạng"
            value={jobs.batchCodec}
            options={BATCH_CODEC_OPTIONS}
            disabled={isExporting}
            onChange={jobs.setBatchCodec}
          />
        </div>
        <div className="text-xs text-zinc-500">
          Dự kiến xuất:{' '}
          <strong className="text-zinc-300">
            {Math.ceil(slides.length / Math.max(1, jobs.batchSlidesPerClip))}
          </strong>{' '}
          clip B-roll từ {slides.length} ảnh.
        </div>
        <button
          onClick={jobs.exportBatch}
          disabled={!window.frameSlideAPI || slides.length === 0 || isExporting}
          className="w-full rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          Chọn thư mục & Xuất hàng loạt
        </button>
      </Group>

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
