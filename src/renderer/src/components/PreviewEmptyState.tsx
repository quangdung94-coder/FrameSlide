interface Props {
  hasPhotos: boolean;
  hasScenes: boolean;
  onPickImages: () => void;
  onPickFolder: () => void;
  onLoadSamples: () => void;
}

/** Overlays on the preview when there are no photos yet, or photos but an empty timeline. */
export function PreviewEmptyState({ hasPhotos, hasScenes, onPickImages, onPickFolder, onLoadSamples }: Props) {
  return (
    <>
    {/* Rich Empty State when no photos are loaded */}
    {!hasPhotos && (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/90 p-6 text-center">
        <div className="mb-2 text-title font-semibold text-amber-400">
          Bắt đầu dựng B-roll cùng FrameSlide
        </div>
        <p className="mb-5 max-w-md text-xs text-zinc-400">
          Kéo thả ảnh hoặc cả thư mục ảnh vào đây, hoặc chọn nhanh bên dưới để dựng slideshow
          2.5D/3D + Film Look chất lượng cao cho DaVinci Resolve / Premiere.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onPickImages}
            disabled={!window.frameSlideAPI}
            className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          >
            + Chọn ảnh lẻ
          </button>
          <button
            type="button"
            onClick={onPickFolder}
            disabled={!window.frameSlideAPI}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
          >
            + Chọn cả thư mục
          </button>
          <button
            type="button"
            onClick={onLoadSamples}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-300 hover:border-amber-400 hover:text-amber-300"
          >
            Mở ảnh mẫu thử ngay
          </button>
        </div>
      </div>
    )}

    {/* Photos are in the tray but nothing is on the timeline yet */}
    {hasPhotos && !hasScenes && (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/85 p-6 text-center">
        <div className="mb-2 text-title font-semibold text-amber-400">
          Ảnh đã vào khay, timeline đang trống
        </div>
        <p className="max-w-md text-xs text-zinc-400">
          Chọn ảnh ở khay bên trái (giữ Ctrl để chọn nhiều, Shift để chọn một dãy) rồi bấm
          “Thêm ảnh đã chọn”, hoặc bấm “Thêm cả thư mục” để đưa tất cả ảnh chưa dùng lên timeline.
        </p>
      </div>
    )}
    </>
  );
}
