import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'child_process';
import { randomUUID } from 'crypto';
import type { ExportCodec, FfmpegExportFinishResult } from '@shared/types';

interface ActiveJob {
  process: ChildProcessWithoutNullStreams;
  filePath: string;
  startedAt: number;
  stderr: string;
  closed: Promise<number | null>;
}

const activeJobs = new Map<string, ActiveJob>();

export function isFfmpegAvailable(): boolean {
  const res = spawnSync('ffmpeg', ['-version'], { windowsHide: true, timeout: 3000 });
  return res.status === 0;
}

export function formatFfmpegFps(fps: number): string {
  if (Math.abs(fps - 23.976) < 0.01) {
    return '24000/1001';
  }
  return String(fps);
}

export function buildCodecArgs(codec: ExportCodec): string[] {
  switch (codec) {
    case 'prores422':
      return [
        '-c:v', 'prores_ks',
        '-profile:v', '2',
        '-vendor', 'apl0',
        '-pix_fmt', 'yuv422p10le',
        '-colorspace', 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-color_range', 'tv',
      ];
    case 'dnxhr_hq':
      return [
        '-c:v', 'dnxhd',
        '-profile:v', 'dnxhr_hq',
        '-pix_fmt', 'yuv422p',
        '-colorspace', 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-color_range', 'tv',
      ];
    case 'h264':
    default:
      return [
        '-c:v', 'libx264',
        '-crf', '16',
        '-preset', 'medium',
        '-pix_fmt', 'yuv420p',
        '-colorspace', 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-color_range', 'tv',
        '-movflags', '+faststart',
      ];
  }
}

export function buildFfmpegArgs(opts: {
  width: number;
  height: number;
  fps: number;
  codec: ExportCodec;
  filePath: string;
}): string[] {
  return [
    '-y',
    '-f', 'rawvideo',
    '-vcodec', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${opts.width}x${opts.height}`,
    '-r', formatFfmpegFps(opts.fps),
    '-i', 'pipe:0',
    // Flip WebGL bottom-to-top rows AND convert Full-Range RGB -> Limited-Range BT.709 YUV accurately
    '-vf', 'vflip,scale=in_range=full:out_color_matrix=bt709:out_range=tv',
    '-an',
    ...buildCodecArgs(opts.codec),
    opts.filePath,
  ];
}

export function startFfmpegJob(opts: {
  width: number;
  height: number;
  fps: number;
  codec: ExportCodec;
  filePath: string;
}): string {
  const jobId = randomUUID();
  const args = buildFfmpegArgs(opts);
  const proc = spawn('ffmpeg', args, { windowsHide: true });

  const job: ActiveJob = {
    process: proc,
    filePath: opts.filePath,
    startedAt: performance.now(),
    stderr: '',
    closed: new Promise<number | null>((resolve, reject) => {
      proc.on('error', reject);
      proc.on('close', (code) => resolve(code));
    }),
  };

  proc.stderr.on('data', (chunk: Buffer) => {
    job.stderr += chunk.toString('utf-8');
    if (job.stderr.length > 8000) {
      job.stderr = job.stderr.slice(-8000);
    }
  });

  activeJobs.set(jobId, job);
  return jobId;
}

export async function writeFfmpegFrame(jobId: string, rgbaData: Uint8Array): Promise<void> {
  const job = activeJobs.get(jobId);
  if (!job) throw new Error(`Export job not found: ${jobId}`);

  const buffer = Buffer.from(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength);
  const ok = job.process.stdin.write(buffer);
  if (!ok) {
    await new Promise<void>((resolve, reject) => {
      const onDrain = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        job.process.stdin.off('drain', onDrain);
        job.process.stdin.off('error', onError);
      };
      job.process.stdin.once('drain', onDrain);
      job.process.stdin.once('error', onError);
    });
  }
}

export async function finishFfmpegJob(jobId: string): Promise<FfmpegExportFinishResult> {
  const job = activeJobs.get(jobId);
  if (!job) throw new Error(`Export job not found: ${jobId}`);

  job.process.stdin.end();
  const exitCode = await job.closed;
  activeJobs.delete(jobId);

  if (exitCode !== 0) {
    throw new Error(`FFmpeg exited with code ${exitCode}:\n${job.stderr.slice(-1200)}`);
  }

  return {
    filePath: job.filePath,
    durationMs: Math.round(performance.now() - job.startedAt),
  };
}

export async function cancelFfmpegJob(jobId: string): Promise<void> {
  const job = activeJobs.get(jobId);
  if (!job) return;
  activeJobs.delete(jobId);
  try {
    job.process.stdin.destroy();
    job.process.kill('SIGKILL');
  } catch {
    // ignore cleanup errors
  }
}

export function cancelAllFfmpegJobs(): void {
  for (const jobId of Array.from(activeJobs.keys())) {
    void cancelFfmpegJob(jobId);
  }
}
