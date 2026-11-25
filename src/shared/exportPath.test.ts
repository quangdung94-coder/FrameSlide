import { describe, expect, it } from 'vitest';
import {
  codecExtension,
  defaultExportStem,
  joinExportPath,
  nextFreeFileName,
  pathStem,
  sanitizeFileStem,
} from './exportPath';

describe('export file names (Đợt 6.1)', () => {
  it('cleans names Windows would refuse', () => {
    expect(sanitizeFileStem('Cưới: Lan/Anh?  ')).toBe('Cưới_ Lan_Anh_');
    expect(sanitizeFileStem('clip...')).toBe('clip');
    expect(sanitizeFileStem('   ')).toBeNull();
    expect(sanitizeFileStem('con')).toBe('con_');
  });

  it('builds the default name from the project file', () => {
    expect(pathStem('D:\\Cuoi\\Lan Anh.fsproj')).toBe('Lan Anh');
    expect(defaultExportStem({ projectFilePath: 'D:\\Cuoi\\Lan Anh.fsproj', codec: 'h264', fps: 30 })).toBe(
      'Lan Anh_1080p_30fps'
    );
    expect(defaultExportStem({ codec: 'prores422', fps: 23.976, rangeSuffix: '_scene3' })).toBe(
      'FrameSlide_1080p_23.976fps_ProRes422_scene3'
    );
    expect(codecExtension('dnxhr_hq')).toBe('mov');
  });

  it('joins with the folder separator and never overwrites', () => {
    expect(joinExportPath('C:\\Users\\A\\Videos', 'x.mp4')).toBe('C:\\Users\\A\\Videos\\x.mp4');
    expect(joinExportPath('/home/a/', 'x.mp4')).toBe('/home/a/x.mp4');
    const taken = new Set(['x.mp4', 'x_2.mp4']);
    expect(nextFreeFileName('x.mp4', (n) => taken.has(n))).toBe('x_3.mp4');
    expect(nextFreeFileName('y.mov', (n) => taken.has(n))).toBe('y.mov');
  });
});
