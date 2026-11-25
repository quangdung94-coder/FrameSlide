import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { pathToFileURL } from 'url';
import type {
  AppInfo,
  AppSettings,
  AppSettingsInfo,
  CacheStats,
  FfmpegExportStartDirectOptions,
  FfmpegExportStartOptions,
  FfmpegExportStartResult,
  OpenProjectResult,
  PickCubeLutResult,
  PickFolderResult,
  ProjectFileData,
  SaveFileResult,
  SlideAsset,
} from '@shared/types';
import {
  cancelAllFfmpegJobs,
  cancelFfmpegJob,
  finishFfmpegJob,
  isFfmpegAvailable,
  startFfmpegJob,
  writeFfmpegFrame,
} from './ffmpegExport';
import {
  collectImagePaths,
  createImageProxiesBatch,
  createImageProxy,
  decodeMediaUrl,
  ensureSamplePhotos,
  mergeRegeneratedSlide,
  setProxyMaxEdge,
} from './proxyService';
import { clearCacheFiles, getCacheStats, readAppSettings, writeAppSettings } from './appSettings';

const isDev = Boolean(process.env['ELECTRON_RENDERER_URL']);

// Laptops/desktops with both Intel and NVIDIA/AMD GPUs: render on the dedicated card.
app.commandLine.appendSwitch('force_high_performance_gpu');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'frameslide-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getDefaultCacheDir(): string {
  return join(app.getPath('userData'), 'cache');
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

/** Cache folder for this run: the user's choice from the settings file, else the default. */
function getCacheDir(): string {
  return readAppSettings(getSettingsPath()).cacheDir ?? getDefaultCacheDir();
}

function getAutosavePath(): string {
  return join(app.getPath('userData'), 'autosave.frameslide');
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1420,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f0f12',
    title: 'FrameSlide',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  // Read once at start: changing the cache folder takes effect the next time the app opens.
  const cacheDir = getCacheDir();
  setProxyMaxEdge(readAppSettings(getSettingsPath()).proxyMaxEdge);

  const settingsInfo = (settings: AppSettings): AppSettingsInfo => ({
    settings,
    activeCacheDir: cacheDir,
    defaultCacheDir: getDefaultCacheDir(),
  });

  ipcMain.handle('settings:get', (): AppSettingsInfo => settingsInfo(readAppSettings(getSettingsPath())));

  ipcMain.handle('settings:set', (_evt, patch: Partial<AppSettings>): AppSettingsInfo => {
    const next = writeAppSettings(getSettingsPath(), { ...readAppSettings(getSettingsPath()), ...patch });
    setProxyMaxEdge(next.proxyMaxEdge);
    return settingsInfo(next);
  });

  ipcMain.handle('cache:stats', (): Promise<CacheStats> => getCacheStats(cacheDir));

  ipcMain.handle('cache:clear', async (_evt, keepUrls: string[]): Promise<number> => {
    const keep = (Array.isArray(keepUrls) ? keepUrls : [])
      .map((u) => decodeMediaUrl(String(u), cacheDir))
      .filter((p): p is string => Boolean(p));
    return clearCacheFiles(cacheDir, keep);
  });

  ipcMain.handle('cache:open', async (): Promise<void> => {
    await shell.openPath(cacheDir);
  });

  ipcMain.handle('cache:pickFolder', async (): Promise<string | null> => {
    const res = await dialog.showOpenDialog({
      title: 'Chọn thư mục lưu cache ảnh',
      properties: ['openDirectory', 'createDirectory'],
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  protocol.handle('frameslide-media', (request) => {
    const filePath = decodeMediaUrl(request.url, cacheDir);
    if (!filePath) {
      return new Response('Invalid or disallowed media URL', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  const ffmpegReady = isFfmpegAvailable();

  ipcMain.handle('app:getInfo', (): AppInfo => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
    ffmpegAvailable: ffmpegReady,
  }));

  ipcMain.handle('media:loadSamples', async (): Promise<SlideAsset[]> => {
    return ensureSamplePhotos(cacheDir);
  });

  ipcMain.handle('media:pickImages', async (): Promise<SlideAsset[]> => {
    const res = await dialog.showOpenDialog({
      title: 'Chọn ảnh cho slideshow',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Ảnh', extensions: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return [];
    const { assets } = await createImageProxiesBatch(res.filePaths, cacheDir, 4);
    return assets;
  });

  ipcMain.handle('media:pickFolderImages', async (): Promise<SlideAsset[]> => {
    const res = await dialog.showOpenDialog({
      title: 'Chọn thư mục chứa ảnh',
      properties: ['openDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return [];
    const imagePaths = await collectImagePaths(res.filePaths, 2);
    if (imagePaths.length === 0) return [];
    const { assets } = await createImageProxiesBatch(imagePaths, cacheDir, 4);
    return assets;
  });

  ipcMain.handle('media:importPaths', async (_evt, paths: string[]): Promise<SlideAsset[]> => {
    const imagePaths = await collectImagePaths(paths, 2);
    if (imagePaths.length === 0) return [];
    const { assets } = await createImageProxiesBatch(imagePaths, cacheDir, 4);
    return assets;
  });

  ipcMain.handle(
    'media:rehydrateSlides',
    async (_evt, slides: SlideAsset[]): Promise<SlideAsset[]> => {
      const out: SlideAsset[] = [];
      for (const s of slides) {
        const proxyFile = decodeMediaUrl(s.proxyUrl, cacheDir);
        const thumbFile = decodeMediaUrl(s.thumbUrl, cacheDir);
        if (proxyFile && thumbFile && existsSync(proxyFile) && existsSync(thumbFile)) {
          out.push(s);
          continue;
        }
        if (s.originalPath && existsSync(s.originalPath)) {
          try {
            const regenerated = await createImageProxy(s.originalPath, cacheDir);
            out.push(mergeRegeneratedSlide(s, regenerated));
            continue;
          } catch {
            // Fall through and keep metadata if regeneration fails
          }
        }
        out.push(s);
      }
      return out;
    }
  );

  ipcMain.handle('lut:pickCube', async (): Promise<PickCubeLutResult> => {
    const res = await dialog.showOpenDialog({
      title: 'Chọn file 3D LUT (.cube) từ DaVinci Resolve',
      properties: ['openFile'],
      filters: [{ name: '3D LUT (.cube)', extensions: ['cube'] }],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { canceled: true };
    }
    const filePath = res.filePaths[0];
    const content = await readFile(filePath, 'utf-8');
    return {
      canceled: false,
      name: basename(filePath),
      filePath,
      content,
    };
  });

  ipcMain.handle('fs:readTextFile', async (_evt, filePath: string): Promise<string | null> => {
    try {
      if (!existsSync(filePath)) return null;
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    'project:save',
    async (_evt, data: ProjectFileData, existingPath?: string | null): Promise<SaveFileResult> => {
      let targetPath = existingPath ?? undefined;
      if (!targetPath) {
        const res = await dialog.showSaveDialog({
          title: 'Lưu dự án FrameSlide',
          defaultPath: 'du-an.frameslide',
          filters: [{ name: 'FrameSlide Project', extensions: ['frameslide'] }],
        });
        if (res.canceled || !res.filePath) {
          return { canceled: true };
        }
        targetPath = res.filePath;
      }
      await writeFile(targetPath, JSON.stringify(data, null, 2), 'utf-8');
      return { canceled: false, filePath: targetPath };
    }
  );

  ipcMain.handle('project:open', async (): Promise<OpenProjectResult> => {
    const res = await dialog.showOpenDialog({
      title: 'Mở dự án FrameSlide',
      properties: ['openFile'],
      filters: [{ name: 'FrameSlide Project', extensions: ['frameslide'] }],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { canceled: true };
    }
    const filePath = res.filePaths[0];
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as ProjectFileData;
    return { canceled: false, filePath, data };
  });

  ipcMain.handle('project:writeAutosave', async (_evt, data: ProjectFileData): Promise<void> => {
    await writeFile(getAutosavePath(), JSON.stringify(data), 'utf-8');
  });

  ipcMain.handle('project:loadAutosave', async (): Promise<ProjectFileData | null> => {
    const p = getAutosavePath();
    if (!existsSync(p)) return null;
    try {
      const raw = await readFile(p, 'utf-8');
      return JSON.parse(raw) as ProjectFileData;
    } catch {
      return null;
    }
  });

  ipcMain.handle('export:pickOutputFolder', async (): Promise<PickFolderResult> => {
    const res = await dialog.showOpenDialog({
      title: 'Chọn thư mục lưu các clip Batch Export',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, folderPath: res.filePaths[0] };
  });

  ipcMain.handle('shell:revealInFolder', async (_evt, filePath: string): Promise<void> => {
    if (!filePath) return;
    if (existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    } else {
      await shell.openPath(filePath);
    }
  });

  ipcMain.handle(
    'export:saveBinary',
    async (_evt, data: Uint8Array, defaultName: string): Promise<SaveFileResult> => {
      const res = await dialog.showSaveDialog({
        title: 'Lưu video xuất ra',
        defaultPath: defaultName,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
      });
      if (res.canceled || !res.filePath) {
        return { canceled: true };
      }
      await writeFile(res.filePath, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
      return { canceled: false, filePath: res.filePath };
    }
  );

  ipcMain.handle(
    'export:saveBinaryToPath',
    async (_evt, data: Uint8Array, filePath: string): Promise<void> => {
      await writeFile(filePath, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    }
  );

  ipcMain.handle(
    'export:ffmpegStart',
    async (_evt, opts: FfmpegExportStartOptions): Promise<FfmpegExportStartResult> => {
      const ext = opts.codec === 'h264' ? 'mp4' : 'mov';
      const label =
        opts.codec === 'prores422'
          ? 'ProRes 422 (.mov)'
          : opts.codec === 'dnxhr_hq'
            ? 'DNxHR HQ (.mov)'
            : 'MP4 (.mp4)';
      const res = await dialog.showSaveDialog({
        title: `Xuất ${label}`,
        defaultPath: opts.defaultName,
        filters: [{ name: label, extensions: [ext] }],
      });
      if (res.canceled || !res.filePath) {
        return { canceled: true };
      }
      const jobId = startFfmpegJob({
        width: opts.width,
        height: opts.height,
        fps: opts.fps,
        codec: opts.codec,
        filePath: res.filePath,
      });
      return { canceled: false, jobId, filePath: res.filePath };
    }
  );

  ipcMain.handle(
    'export:ffmpegStartDirect',
    async (_evt, opts: FfmpegExportStartDirectOptions): Promise<{ jobId: string }> => {
      const jobId = startFfmpegJob(opts);
      return { jobId };
    }
  );

  ipcMain.handle('export:ffmpegFrame', async (_evt, jobId: string, rgbaData: Uint8Array) => {
    await writeFfmpegFrame(jobId, rgbaData);
  });

  ipcMain.handle('export:ffmpegFinish', async (_evt, jobId: string) => {
    return finishFfmpegJob(jobId);
  });

  ipcMain.handle('export:ffmpegCancel', async (_evt, jobId: string) => {
    await cancelFfmpegJob(jobId);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  cancelAllFfmpegJobs();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
