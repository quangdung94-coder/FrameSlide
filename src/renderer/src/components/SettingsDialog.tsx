import { useCallback, useEffect, useState } from 'react';
import type { AppSettingsInfo, CacheStats, OutputAspectId, SupportedFps } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_PREFS, usePrefsStore, type WorkPrefs } from '../store/usePrefsStore';
import { CheckField, Group, Modal, SelectField, type SelectOption } from './ui';

const FPS_OPTIONS: SelectOption<SupportedFps>[] = [23.976, 24, 25, 30].map((v) => ({
  value: v as SupportedFps,
  label: `${v} fps`,
}));
const ASPECT_OPTIONS: SelectOption<OutputAspectId>[] = [
  { value: '16:9', label: '16:9 Full HD' },
  { value: '9:16', label: '9:16 dọc' },
  { value: '1:1', label: '1:1 vuông' },
];
const SCENE_SEC_OPTIONS: SelectOption<number>[] = [2, 2.5, 3, 3.5, 4, 5, 6].map((v) => ({ value: v, label: `${v} giây` }));
const AUTOSAVE_OPTIONS: SelectOption<WorkPrefs['autosaveSec']>[] = [
  { value: 0, label: 'Tắt' },
  { value: 30, label: 'Mỗi 30 giây' },
  { value: 60, label: 'Mỗi 1 phút' },
  { value: 120, label: 'Mỗi 2 phút' },
];
const PROXY_OPTIONS: SelectOption<2560 | 2880 | 3200>[] = [
  { value: 2560, label: '2560 px (nhẹ máy)' },
  { value: 2880, label: '2880 px (mặc định)' },
  { value: 3200, label: '3200 px (nét nhất, tốn RAM)' },
];

const BTN =
  'h-8 rounded border border-zinc-700 bg-zinc-800 px-3 text-xs text-zinc-100 hover:border-amber-400 disabled:opacity-40';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/** "⚙ Cài đặt" (Đợt 5.3b): cache, working photo size, new-project defaults, autosave. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const api = window.frameSlideAPI;
  const prefs = usePrefsStore();
  const [info, setInfo] = useState<AppSettingsInfo | null>(null);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api) return;
    const [i, st] = await Promise.all([api.getAppSettings(), api.getCacheStats()]);
    setInfo(i);
    setStats(st);
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearCache = async () => {
    if (!api) return;
    // Keep the files every open workspace tab (and its undo/redo history) uses.
    const keep = useAppStore
      .getState()
      .getAllWorkspacesSnapshot()
      .flatMap((w) => [
        ...w.slides,
        ...w.past.flatMap((snap) => snap.slides),
        ...w.future.flatMap((snap) => snap.slides),
      ])
      .flatMap((s) => [s.proxyUrl, s.thumbUrl].filter(Boolean) as string[]);
    const removed = await api.clearCache(keep);
    setNotice(`Đã xóa ${removed} file cache. Ảnh của các dự án đang mở được giữ lại.`);
    void refresh();
  };

  const pickCacheDir = async () => {
    if (!api) return;
    const dir = await api.pickCacheFolder();
    if (!dir) return;
    setInfo(await api.setAppSettings({ cacheDir: dir }));
    setNotice('Thư mục cache mới sẽ dùng từ lần mở app sau.');
  };

  const pendingDir = info && (info.settings.cacheDir ?? info.defaultCacheDir) !== info.activeCacheDir;

  return (
    <Modal title="Cài đặt" ariaLabel="Cài đặt" widthClass="max-w-lg" onClose={onClose}>
      <Group id="settings-cache" title="Bộ nhớ đệm (cache ảnh)">
        {!api ? (
          <p className="text-2xs text-zinc-500">Chỉ có trong app trên máy (không có ở bản xem thử trên trình duyệt).</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-zinc-400">
              Thư mục đang dùng:
              <div className="mt-0.5 break-all font-mono text-2xs text-zinc-200">{info?.activeCacheDir ?? '…'}</div>
              {pendingDir && (
                <div className="mt-1 text-2xs text-amber-300">
                  Lần mở app sau sẽ dùng: <span className="break-all font-mono">{info?.settings.cacheDir ?? info?.defaultCacheDir}</span>
                </div>
              )}
            </div>
            <div className="text-zinc-300">
              Dung lượng: <b>{stats ? formatBytes(stats.bytes) : '…'}</b>
              {stats && <span className="text-zinc-500"> ({stats.files} file)</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={BTN} onClick={() => void api.openCacheFolder()}>
                Mở thư mục
              </button>
              <button type="button" className={BTN} onClick={() => void pickCacheDir()}>
                Đổi thư mục…
              </button>
              {info?.settings.cacheDir && (
                <button
                  type="button"
                  className={BTN}
                  onClick={async () => {
                    setInfo(await api.setAppSettings({ cacheDir: null }));
                    setNotice('Lần mở app sau sẽ dùng lại thư mục mặc định.');
                  }}
                >
                  Về mặc định
                </button>
              )}
              <button type="button" className={`${BTN} text-red-300`} onClick={() => void clearCache()}>
                Xóa cache
              </button>
            </div>
            <SelectField
              label="Cỡ ảnh làm việc (proxy) cho ảnh nhập mới"
              value={info?.settings.proxyMaxEdge ?? 2880}
              options={PROXY_OPTIONS}
              onChange={async (v) => setInfo(await api.setAppSettings({ proxyMaxEdge: v }))}
            />
            <p className="text-2xs text-zinc-500">
              Ảnh đã có trong cache giữ cỡ cũ; xóa cache rồi nhập lại nếu muốn làm lại theo cỡ mới.
            </p>
          </div>
        )}
      </Group>

      <Group id="settings-defaults" title="Mặc định khi mở app (dự án mới)">
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="FPS" value={prefs.defaultFps} options={FPS_OPTIONS} onChange={(v) => prefs.setPrefs({ defaultFps: v })} />
          <SelectField
            label="Tỷ lệ khung"
            value={prefs.defaultAspect}
            options={ASPECT_OPTIONS}
            onChange={(v) => prefs.setPrefs({ defaultAspect: v })}
          />
          <SelectField
            label="Thời lượng mỗi scene"
            value={prefs.defaultSceneSec}
            options={SCENE_SEC_OPTIONS}
            onChange={(v) => prefs.setPrefs({ defaultSceneSec: v })}
          />
          <SelectField
            label="Tự lưu nháp"
            value={prefs.autosaveSec}
            options={AUTOSAVE_OPTIONS}
            onChange={(v) => prefs.setPrefs({ autosaveSec: v })}
          />
        </div>
        <CheckField
          label="Bật Film Look sẵn khi mở app"
          checked={prefs.filmLookOnStart}
          onChange={(v) => prefs.setPrefs({ filmLookOnStart: v })}
        />
        <button type="button" className={`${BTN} self-start`} onClick={prefs.resetPrefs}>
          Đặt lại mặc định
        </button>
        <p className="text-2xs text-zinc-500">
          Áp dụng khi mở app với dự án trống. Dự án đã lưu giữ nguyên thiết lập của nó. Mặc định gốc:{' '}
          {DEFAULT_PREFS.defaultFps} fps, {DEFAULT_PREFS.defaultAspect}, {DEFAULT_PREFS.defaultSceneSec}s, Film Look bật.
        </p>
      </Group>

      {notice && <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-200">{notice}</p>}
    </Modal>
  );
}
