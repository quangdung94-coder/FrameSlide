import { app, type BrowserWindow } from 'electron';
import { writeFile } from 'fs/promises';

export interface SmokeResult {
  ok: boolean;
  version: string;
  rendererLoaded: boolean;
  samplePhotos: number;
  ffmpeg: boolean;
  ffmpegPath: string;
  /** First renderer errors, to see why a check failed. */
  rendererErrors: string[];
  error?: string;
}

/** `--smoke-test=<file>`: the packaged build checks itself, writes JSON to <file> and quits (CI). */
export function smokeTestOutput(argv: string[] = process.argv): string | null {
  const arg = argv.find((a) => a.startsWith('--smoke-test='));
  return arg ? arg.slice('--smoke-test='.length) : null;
}

/**
 * Checks the parts a packaged build can break: the UI loads from the asar, `sharp` (native, unpacked)
 * makes the sample photos, and the shipped FFmpeg runs. No telemetry: the result only goes to the file.
 */
export async function runSmokeTest(
  win: BrowserWindow,
  outFile: string,
  checks: { samples: () => Promise<unknown[]>; ffmpeg: Promise<boolean>; ffmpegPath: string }
): Promise<void> {
  const result: SmokeResult = {
    ok: false,
    version: app.getVersion(),
    rendererLoaded: false,
    samplePhotos: 0,
    ffmpeg: false,
    ffmpegPath: checks.ffmpegPath,
    rendererErrors: [],
  };
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error' && result.rendererErrors.length < 10) result.rendererErrors.push(event.message.slice(0, 300));
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    result.rendererErrors.push(`renderer gone: ${details.reason}`);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('renderer did not load in 60 s')), 60_000);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      if (!win.webContents.isLoading()) done();
      else win.webContents.once('did-finish-load', done);
    });
    // React mounts shortly after load; poll up to 20 s.
    for (let i = 0; i < 40 && !result.rendererLoaded; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const children = (await win.webContents.executeJavaScript(
        "document.getElementById('root')?.childElementCount ?? 0"
      )) as number;
      result.rendererLoaded = children > 0;
    }
    // Each check on its own, so one failure does not hide the others.
    try {
      result.samplePhotos = (await checks.samples()).length;
    } catch (err) {
      result.error = `samples: ${err instanceof Error ? err.message : String(err)}`;
    }
    result.ffmpeg = await checks.ffmpeg;
    result.ok = result.rendererLoaded && result.samplePhotos > 0 && result.ffmpeg;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  await writeFile(outFile, JSON.stringify(result, null, 2), 'utf-8');
  app.exit(result.ok ? 0 : 1);
}
