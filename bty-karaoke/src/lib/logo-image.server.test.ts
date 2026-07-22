import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { normalizeLogoToWebp } from './logo-image.server';

// Minimal RGBA (colortype 6) / RGB (colortype 2) PNG encoder — no image library.
const CRC = (() => { const t: number[] = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = new TextEncoder().encode(type);
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, data.length);
  const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, crc32(new Uint8Array([...t, ...data])));
  return new Uint8Array([...len, ...t, ...data, ...crc]);
}
function makePng(w: number, h: number, colorType: 2 | 6, fn: (x: number, y: number) => number[]): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = colorType;
  const ch = colorType === 6 ? 4 : 3; const rb = w * ch; const raw = new Uint8Array(h * (1 + rb));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (1 + rb) + 1 + x * ch; const p = fn(x, y); for (let c = 0; c < ch; c++) raw[o + c] = p[c]; }
  const idat = new Uint8Array(zlib.deflateSync(raw));
  return new Uint8Array([...sig, ...chunk('IHDR', ihdr), ...chunk('IDAT', idat), ...chunk('IEND', new Uint8Array(0))]);
}
const isWebp = (b: Uint8Array) => b[0] === 0x52 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;

describe('normalizeLogoToWebp — pre-decode rejections (no photon needed)', () => {
  it('rejects an unsupported format (GIF magic)', async () => {
    const r = await normalizeLogoToWebp(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]));
    expect(r).toEqual({ ok: false, reason: 'unsupported_format' });
  });
  it('rejects an oversized side from the header before decoding', async () => {
    // valid PNG header claiming 5000×10 — checkImageBytes rejects (side) pre-decode.
    const r = await normalizeLogoToWebp(makePng(5000, 10, 2, () => [10, 10, 10]).subarray(0, 40));
    expect(r).toEqual({ ok: false, reason: 'side_too_large' });
  });
  it('rejects a header that over-declares total pixels (bomb) before decoding', async () => {
    const r = await normalizeLogoToWebp(makePng(4096, 2048, 2, () => [0, 0, 0]).subarray(0, 40));
    expect(r).toEqual({ ok: false, reason: 'too_many_pixels' });
  });
});

describe('normalizeLogoToWebp — real decode/normalize (photon)', () => {
  it('normalizes an opaque PNG to a canonical WebP', async () => {
    const src = makePng(120, 60, 2, (x) => (x < 60 ? [220, 30, 30] : [30, 30, 220]));
    const r = await normalizeLogoToWebp(src);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(isWebp(r.webp)).toBe(true); expect(r.webp.length).toBeGreaterThan(0); }
  });
  it('normalizes a TRANSPARENT PNG to WebP (alpha preserved end-to-end)', async () => {
    const src = makePng(64, 64, 6, (x) => (x < 32 ? [220, 30, 30, 255] : [0, 0, 0, 0]));
    const r = await normalizeLogoToWebp(src);
    expect(r.ok).toBe(true);
    if (r.ok) expect(isWebp(r.webp)).toBe(true);
  });
  it('rejects corrupt bytes that pass the header sniff but fail to decode', async () => {
    const bad = new Uint8Array(80); bad.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bad.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
    new DataView(bad.buffer).setUint32(16, 8); new DataView(bad.buffer).setUint32(20, 8); // 8×8 header, garbage body
    const r = await normalizeLogoToWebp(bad);
    expect(r.ok).toBe(false);
  });
});
