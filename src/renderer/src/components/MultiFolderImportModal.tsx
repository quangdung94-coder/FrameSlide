import { useState } from 'react';
import type { FolderScanEntry, SlideAsset } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { CheckField, Modal } from './ui';

interface Props {
  folders: FolderScanEntry[];
  onClose: () => void;
  onImported: (count: number, autoBuilt: boolean) => void;
}

/**
 * Confirmation dialog for "Nhập nhiều thư mục": lets the user check which folders to turn into
 * separate workspace tabs, auto-arranges photos onto each tab's timeline by default, and shows progress.
 */
export function MultiFolderImportModal({ folders, onClose, onImported }: Props) {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(folders.map((f) => f.folderPath))
  );
  const [autoBuildScenes, setAutoBuildScenes] = useState(true);
  const [copyCurrentStyle, setCopyCurrentStyle] = useState(true);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ index: number; total: number; name: string } | null>(null);

  const pickedFolders = folders.filter((f) => selectedPaths.has(f.folderPath));
  const totalImages = pickedFolders.reduce((acc, f) => acc + f.imageCount, 0);

  const toggleFolder = (folderPath: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const handleImport = async () => {
    const api = window.frameSlideAPI;
    if (!api || pickedFolders.length === 0) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      const loadedItems: { name: string; sourceFolder: string; slides: SlideAsset[] }[] = [];
      for (let i = 0; i < pickedFolders.length; i++) {
        const folder = pickedFolders[i];
        setProgress({ index: i + 1, total: pickedFolders.length, name: folder.name });
        const slides = await api.importPaths(folder.imagePaths);
        if (slides.length > 0) {
          loadedItems.push({
            name: folder.name,
            sourceFolder: folder.folderPath,
            slides,
          });
        }
      }
      if (loadedItems.length === 0) {
        setErrorMsg('Không nạp được ảnh hợp lệ nào từ các thư mục đã chọn.');
        return;
      }
      const created = useAppStore
        .getState()
        .importFolderWorkspaces(loadedItems, { autoBuildScenes, copyCurrentStyle });
      onImported(created, autoBuildScenes);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      title={`Nhập nhiều thư mục (${folders.length} tìm thấy)`}
      ariaLabel="Nhập nhiều thư mục"
      widthClass="max-w-lg"
      onClose={() => {
        if (!importing) onClose();
      }}
    >
      <p className="text-xs text-zinc-400">
        Mỗi thư mục được chọn sẽ tạo thành 1 tab dự án riêng. Tab ảnh mẫu mặc định ban đầu sẽ tự động được bỏ đi.
      </p>

      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-300">
          Đã chọn <strong>{pickedFolders.length}</strong>/{folders.length} thư mục ({totalImages} ảnh)
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={importing}
            onClick={() => setSelectedPaths(new Set(folders.map((f) => f.folderPath)))}
            className="rounded border border-zinc-700 px-2 py-0.5 text-2xs text-zinc-300 hover:border-amber-400 disabled:opacity-40"
          >
            Chọn tất cả
          </button>
          <button
            type="button"
            disabled={importing}
            onClick={() => setSelectedPaths(new Set())}
            className="rounded border border-zinc-700 px-2 py-0.5 text-2xs text-zinc-300 hover:border-amber-400 disabled:opacity-40"
          >
            Bỏ chọn
          </button>
        </div>
      </div>

      <div className="max-h-60 space-y-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-2">
        {folders.map((f) => {
          const checked = selectedPaths.has(f.folderPath);
          return (
            <label
              key={f.folderPath}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-zinc-900 ${
                checked ? 'text-zinc-100' : 'text-zinc-500'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={importing}
                  onChange={() => toggleFolder(f.folderPath)}
                  className="accent-amber-400"
                />
                <span className="truncate font-medium" title={f.folderPath}>
                  📁 {f.name}
                </span>
              </span>
              <span className="shrink-0 font-mono text-2xs text-zinc-400">{f.imageCount} ảnh</span>
            </label>
          );
        })}
      </div>

      <div className="space-y-1.5 rounded border border-zinc-800 bg-zinc-900/50 p-2.5">
        <CheckField
          label="Tự động xếp ảnh lên Timeline cho từng tab"
          checked={autoBuildScenes}
          disabled={importing}
          onChange={setAutoBuildScenes}
        />
        <CheckField
          label="Áp cài đặt hiện tại (Template, Film Look, Tỷ lệ khung, LUT) cho các tab mới"
          checked={copyCurrentStyle}
          disabled={importing}
          onChange={setCopyCurrentStyle}
        />
      </div>

      {progress && (
        <div className="space-y-1.5 rounded border border-amber-500/30 bg-amber-950/20 p-2.5">
          <div className="flex justify-between text-xs text-amber-200">
            <span className="truncate">Đang nạp: {progress.name}</span>
            <span className="shrink-0 font-mono">
              {progress.index}/{progress.total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${Math.round((progress.index / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded border border-red-500/40 bg-red-950/40 p-2 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
        <button
          type="button"
          disabled={importing}
          onClick={onClose}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          Hủy
        </button>
        <button
          type="button"
          disabled={importing || pickedFolders.length === 0}
          onClick={() => void handleImport()}
          className="rounded bg-amber-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          {importing ? 'Đang nhập…' : `Nhập ${pickedFolders.length} thư mục`}
        </button>
      </div>
    </Modal>
  );
}
