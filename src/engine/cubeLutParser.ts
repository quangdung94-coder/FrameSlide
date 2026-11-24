import * as THREE from 'three';

export interface ParsedCubeLut {
  title: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  /**
   * 2D strip RGBA Uint8Array of width = size * size, height = size.
   * Row = G (0..size-1), Col = B * size + R (0..size*size-1).
   */
  stripRgba: Uint8Array;
}

/**
 * Parses standard Adobe / DaVinci Resolve 3D .cube LUT files (17^3, 33^3, 65^3, etc.)
 * into a 2D tiled strip texture compatible with WebGL1/WebGL2 GLSL trilinear lookup.
 */
export function parseCubeLut(content: string, fallbackTitle = 'Custom LUT'): ParsedCubeLut {
  const lines = content.split(/\r?\n/);
  let title = fallbackTitle;
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const triplets: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('TITLE')) {
      const m = line.match(/TITLE\s+"([^"]+)"/i);
      if (m?.[1]) title = m[1].trim();
      continue;
    }
    if (line.startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      size = Number(parts[1]);
      continue;
    }
    if (line.startsWith('LUT_1D_SIZE')) {
      throw new Error('Chỉ hỗ trợ 3D LUT (.cube có LUT_3D_SIZE), chưa hỗ trợ 1D LUT.');
    }
    if (line.startsWith('DOMAIN_MIN')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        domainMin = [parts[0], parts[1], parts[2]];
      }
      continue;
    }
    if (line.startsWith('DOMAIN_MAX')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        domainMax = [parts[0], parts[1], parts[2]];
      }
      continue;
    }

    const nums = line.split(/\s+/);
    if (nums.length >= 3) {
      const r = Number(nums[0]);
      const g = Number(nums[1]);
      const b = Number(nums[2]);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        triplets.push(r, g, b);
      }
    }
  }

  if (!Number.isInteger(size) || size < 2 || size > 65) {
    throw new Error(`Kích thước LUT_3D_SIZE không hợp lệ: ${size}`);
  }

  const expectedCount = size * size * size;
  const actualCount = triplets.length / 3;
  if (actualCount !== expectedCount) {
    throw new Error(
      `File .cube thiếu hoặc thừa dữ liệu: cần ${expectedCount} điểm (${size}³), đọc được ${actualCount}.`
    );
  }

  // Pack into 2D strip: width = size * size (x = b * size + r), height = size (y = g)
  const width = size * size;
  const height = size;
  const stripRgba = new Uint8Array(width * height * 4);

  let idx = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const rv = Math.max(0, Math.min(1, triplets[idx++]));
        const gv = Math.max(0, Math.min(1, triplets[idx++]));
        const bv = Math.max(0, Math.min(1, triplets[idx++]));

        const x = b * size + r;
        const y = g;
        const dst = (y * width + x) * 4;
        stripRgba[dst] = Math.round(rv * 255);
        stripRgba[dst + 1] = Math.round(gv * 255);
        stripRgba[dst + 2] = Math.round(bv * 255);
        stripRgba[dst + 3] = 255;
      }
    }
  }

  return { title, size, domainMin, domainMax, stripRgba };
}

export function createLutStripTexture(parsed: ParsedCubeLut): THREE.DataTexture {
  const width = parsed.size * parsed.size;
  const height = parsed.size;
  const tex = new THREE.DataTexture(parsed.stripRgba, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}
