import { describe, it, expect } from 'vitest';
import {
  sniffImageFormat,
  readImageDimensions,
  checkImageBytes,
  jpegExifOrientation,
  orientedDimensions,
  orientedSource,
  IMAGE_LIMITS,
} from './image-inspect';

// ── header builders (no image library) ─────────────────────────────────────
function png(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8); // len + "IHDR"
  const dv = new DataView(b.buffer);
  dv.setUint32(16, w); dv.setUint32(20, h);
  return b;
}
function jpeg(w: number, h: number, appExif?: Uint8Array): Uint8Array {
  const sof = new Uint8Array([0xff, 0xc0, 0x00, 0x11, 0x08, (h >> 8) & 0xff, h & 0xff, (w >> 8) & 0xff, w & 0xff, 0x03]);
  const head = new Uint8Array([0xff, 0xd8]);
  const parts = appExif ? [head, appExif, sof] : [head, sof];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function webpVP8X(w: number, h: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  b.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  const w1 = w - 1, h1 = h - 1;
  b[24] = w1 & 0xff; b[25] = (w1 >> 8) & 0xff; b[26] = (w1 >> 16) & 0xff;
  b[27] = h1 & 0xff; b[28] = (h1 >> 8) & 0xff; b[29] = (h1 >> 16) & 0xff;
  return b;
}
const exifApp1Orientation = (o: number) =>
  new Uint8Array([0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, o, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

describe('sniffImageFormat', () => {
  it('detects png/jpeg/webp/gif by magic bytes, not extension', () => {
    expect(sniffImageFormat(png(1, 1))).toBe('png');
    expect(sniffImageFormat(jpeg(1, 1))).toBe('jpeg');
    expect(sniffImageFormat(webpVP8X(1, 1))).toBe('webp');
    expect(sniffImageFormat(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe('gif');
    expect(sniffImageFormat(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBe('unknown'); // "<svg"
  });
});

describe('readImageDimensions', () => {
  it('reads PNG/JPEG/WebP dimensions from the header', () => {
    expect(readImageDimensions(png(640, 480), 'png')).toEqual({ width: 640, height: 480 });
    expect(readImageDimensions(jpeg(800, 600), 'jpeg')).toEqual({ width: 800, height: 600 });
    expect(readImageDimensions(webpVP8X(1024, 768), 'webp')).toEqual({ width: 1024, height: 768 });
  });
});

describe('checkImageBytes — pre-decode gate (decompression-bomb protection)', () => {
  it('accepts a valid in-limits PNG/JPEG/WebP', () => {
    expect(checkImageBytes(png(512, 512))).toEqual({ ok: true, format: 'png', width: 512, height: 512 });
    expect(checkImageBytes(jpeg(2048, 2048))).toMatchObject({ ok: true, format: 'jpeg' });
    expect(checkImageBytes(webpVP8X(4096, 1024))).toMatchObject({ ok: true, format: 'webp' });
  });
  it('rejects an oversized byte length', () => {
    const big = png(10, 10);
    const padded = new Uint8Array(IMAGE_LIMITS.maxBytes + 1);
    padded.set(big, 0);
    expect(checkImageBytes(padded)).toEqual({ ok: false, reason: 'too_large' });
  });
  it('rejects an unsupported format (GIF / SVG), even with an image extension', () => {
    expect(checkImageBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toEqual({ ok: false, reason: 'unsupported_format' });
    expect(checkImageBytes(new Uint8Array([0x3c, 0x3f, 0x78, 0x6d, 0x6c]))).toEqual({ ok: false, reason: 'unsupported_format' });
  });
  it('rejects a side over 4096px', () => {
    expect(checkImageBytes(png(4097, 100))).toEqual({ ok: false, reason: 'side_too_large' });
    expect(checkImageBytes(png(100, 5000))).toEqual({ ok: false, reason: 'side_too_large' });
  });
  it('rejects total pixels over 4,194,304 (bomb) even when both sides are ≤4096', () => {
    // 4096×2048 = 8,388,608 px, sides ok, pixels over cap.
    expect(checkImageBytes(png(4096, 2048))).toEqual({ ok: false, reason: 'too_many_pixels' });
    expect(IMAGE_LIMITS.maxPixels).toBe(4_194_304);
  });
  it('rejects an undecodable header', () => {
    expect(checkImageBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ ok: false, reason: 'undecodable_header' });
  });
});

describe('jpegExifOrientation', () => {
  it('reads the orientation tag (1..8), default 1', () => {
    expect(jpegExifOrientation(jpeg(100, 100))).toBe(1);
    expect(jpegExifOrientation(jpeg(100, 100, exifApp1Orientation(6)))).toBe(6);
    expect(jpegExifOrientation(jpeg(100, 100, exifApp1Orientation(8)))).toBe(8);
  });
});

describe('orientation math', () => {
  it('swaps dimensions for transpose orientations (5..8)', () => {
    expect(orientedDimensions(300, 150, 1)).toEqual({ width: 300, height: 150 });
    expect(orientedDimensions(300, 150, 6)).toEqual({ width: 150, height: 300 });
    expect(orientedDimensions(300, 150, 8)).toEqual({ width: 150, height: 300 });
  });
  it('maps 90°CW (orientation 6): output TL ← source BL, output TR ← source TL', () => {
    const w = 4, h = 4;
    // output(0,0) top-left of the rotated image comes from source bottom-left.
    expect(orientedSource(6, 0, 0, w, h)).toEqual({ sx: 0, sy: h - 1 });
    // output top-right (dx=OW-1=h-1) comes from source top-left.
    expect(orientedSource(6, h - 1, 0, w, h)).toEqual({ sx: 0, sy: 0 });
  });
  it('identity for orientation 1', () => {
    expect(orientedSource(1, 2, 3, 10, 10)).toEqual({ sx: 2, sy: 3 });
  });
});
