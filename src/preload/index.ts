import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  FfmpegExportStartDirectOptions,
  FfmpegExportStartOptions,
  FrameSlideAPI,
  ProjectFileData,
} from '@shared/types';

const api: FrameSlideAPI = {
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getAppSettings: () => ipcRenderer.invoke('settings:get'),
  setAppSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  getCacheStats: () => ipcRenderer.invoke('cache:stats'),
  clearCache: (keepUrls: string[]) => ipcRenderer.invoke('cache:clear', keepUrls),
  openCacheFolder: () => ipcRenderer.invoke('cache:open'),
  pickCacheFolder: () => ipcRenderer.invoke('cache:pickFolder'),
  pickImages: () => ipcRenderer.invoke('media:pickImages'),
  pickFolderImages: () => ipcRenderer.invoke('media:pickFolderImages'),
  pickMultiFolders: () => ipcRenderer.invoke('media:pickMultiFolders'),
  importPaths: (paths: string[]) => ipcRenderer.invoke('media:importPaths', paths),
  rehydrateSlides: (slides) => ipcRenderer.invoke('media:rehydrateSlides', slides),
  loadSampleImages: () => ipcRenderer.invoke('media:loadSamples'),
  pickCubeLut: () => ipcRenderer.invoke('lut:pickCube'),
  readTextFile: (filePath: string) => ipcRenderer.invoke('fs:readTextFile', filePath),
  saveProject: (data: ProjectFileData, existingPath?: string | null) =>
    ipcRenderer.invoke('project:save', data, existingPath),
  openProject: () => ipcRenderer.invoke('project:open'),
  writeAutosave: (data: ProjectFileData) => ipcRenderer.invoke('project:writeAutosave', data),
  loadAutosave: () => ipcRenderer.invoke('project:loadAutosave'),
  pickOutputFolder: (defaultPath?: string) => ipcRenderer.invoke('export:pickOutputFolder', defaultPath),
  getDefaultExportFolder: () => ipcRenderer.invoke('export:defaultFolder'),
  freeExportPath: (folder: string, fileName: string) => ipcRenderer.invoke('export:freePath', folder, fileName),
  openFolder: (folder: string) => ipcRenderer.invoke('shell:openFolder', folder),
  revealInFolder: (filePath: string) => ipcRenderer.invoke('shell:revealInFolder', filePath),
  saveBinaryFile: (data: Uint8Array, defaultName: string) =>
    ipcRenderer.invoke('export:saveBinary', data, defaultName),
  saveBinaryToPath: (data: Uint8Array, filePath: string) =>
    ipcRenderer.invoke('export:saveBinaryToPath', data, filePath),
  ffmpegExportStart: (opts: FfmpegExportStartOptions) =>
    ipcRenderer.invoke('export:ffmpegStart', opts),
  ffmpegExportStartDirect: (opts: FfmpegExportStartDirectOptions) =>
    ipcRenderer.invoke('export:ffmpegStartDirect', opts),
  ffmpegExportFrame: (jobId: string, rgbaData: Uint8Array) =>
    ipcRenderer.invoke('export:ffmpegFrame', jobId, rgbaData),
  ffmpegExportFinish: (jobId: string) => ipcRenderer.invoke('export:ffmpegFinish', jobId),
  ffmpegExportCancel: (jobId: string) => ipcRenderer.invoke('export:ffmpegCancel', jobId),
  setExportActive: (active: boolean) => ipcRenderer.invoke('export:setActive', active),
  setTaskbarProgress: (ratio: number) => ipcRenderer.invoke('export:setTaskbarProgress', ratio),
};

contextBridge.exposeInMainWorld('frameSlideAPI', api);
contextBridge.exposeInMainWorld('frameSlideGetFilePath', (file: File) =>
  webUtils.getPathForFile(file)
);
