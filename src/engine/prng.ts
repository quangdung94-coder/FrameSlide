/**
 * Deterministic PRNG based on integer frameIndex / seed.
 * Ensures preview and export produce identical noise/grain/weave per frame.
 */
export function hashFrameSeed(frameIndex: number, salt = 0): number {
  let x = (Math.imul(frameIndex | 0, 374761393) + Math.imul(salt | 0, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x = x ^ (x >>> 16);
  return (x >>> 0) / 4294967296;
}

export function frameTimeSeconds(frameIndex: number, fps: number): number {
  if (fps <= 0) {
    throw new Error(`Invalid fps: ${fps}`);
  }
  return frameIndex / fps;
}
