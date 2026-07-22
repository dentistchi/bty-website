// Room Branding V1 — PURE image inspection for pre-decode validation. No I/O, no
// photon. Reads the format + dimensions straight from the PNG/JPEG/WebP header so a
// decompression bomb is rejected BEFORE the decoder ever allocates pixels. Also
// parses EXIF orientation and provides the exact orientation transpose math (used by
// the server normalizer). Every function tolerates short/garbage buffers by
// returning null / a rejection rather than throwing.

export const IMAGE_LIMITS = {
  maxBytes: 2 * 1024 * 1024, //     2 MB upload cap
  maxPixels: 4_194_304, //          declared total-pixel cap (== 2048×2048)
  maxSide: 4096, //                 max width or height
} as const;

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'unknown';

export function sniffImageFormat(b: Uint8Array): ImageFormat {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (
    b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'webp';
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  return 'unknown';
}

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

export interface Dimensions { width: number; height: number; }

function pngDims(b: Uint8Array): Dimensions | null {
  // 8-byte sig + 4 len + "IHDR" → width@16, height@20 (big-endian).
  if (b.length < 24 || b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
function jpegDims(b: Uint8Array): Dimensions | null {
  let off = 2;
  while (off + 9 < b.length) {
    if (b[off] !== 0xff) { off++; continue; }
    const marker = b[off + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { off += 2; continue; }
    if (marker === 0xda) break; // start of scan — no SOF found
    const size = u16be(b, off + 2);
    if (size < 2) return null;
    if (JPEG_SOF.has(marker)) return { height: u16be(b, off + 5), width: u16be(b, off + 7) };
    off += 2 + size;
  }
  return null;
}

function webpDims(b: Uint8Array): Dimensions | null {
  if (b.length < 30) return null;
  const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (fourcc === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (fourcc === 'VP8 ') {
    // lossy simple: start code 0x9d 0x01 0x2a at 23..25, then 14-bit w/h LE.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    // lossless: byte@20 signature 0x2f, then 14-bit (w-1) then 14-bit (h-1), LE bits.
    if (b[20] !== 0x2f) return null;
    // 14-bit (width-1) then 14-bit (height-1), packed little-endian from byte 21.
    const le = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return { width: (le & 0x3fff) + 1, height: ((le >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** Width/height straight from the header, or null when unreadable. */
export function readImageDimensions(b: Uint8Array, format: ImageFormat): Dimensions | null {
  switch (format) {
    case 'png': return pngDims(b);
    case 'jpeg': return jpegDims(b);
    case 'webp': return webpDims(b);
    default: return null;
  }
}

export type ImageReject =
  | 'too_large' | 'unsupported_format' | 'undecodable_header' | 'side_too_large' | 'too_many_pixels';

export type ImageCheck =
  | { ok: true; format: 'png' | 'jpeg' | 'webp'; width: number; height: number }
  | { ok: false; reason: ImageReject };

/**
 * The mandatory PRE-DECODE gate: byte cap → format allowlist → header dimensions →
 * side + total-pixel caps. Rejecting here means the photon decoder never allocates a
 * bomb's worth of pixels. The server re-checks the DECODED dimensions against the
 * same limits afterward (defense in depth).
 */
export function checkImageBytes(b: Uint8Array): ImageCheck {
  if (b.length > IMAGE_LIMITS.maxBytes) return { ok: false, reason: 'too_large' };
  const format = sniffImageFormat(b);
  if (format !== 'png' && format !== 'jpeg' && format !== 'webp') return { ok: false, reason: 'unsupported_format' };
  const dims = readImageDimensions(b, format);
  if (!dims || dims.width <= 0 || dims.height <= 0) return { ok: false, reason: 'undecodable_header' };
  if (dims.width > IMAGE_LIMITS.maxSide || dims.height > IMAGE_LIMITS.maxSide) return { ok: false, reason: 'side_too_large' };
  if (dims.width * dims.height > IMAGE_LIMITS.maxPixels) return { ok: false, reason: 'too_many_pixels' };
  return { ok: true, format, width: dims.width, height: dims.height };
}

/** EXIF orientation (1..8) from a JPEG's APP1/TIFF IFD0, else 1. */
export function jpegExifOrientation(b: Uint8Array): number {
  if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let off = 2;
  while (off + 4 < b.length) {
    if (b[off] !== 0xff) { off++; continue; }
    const marker = b[off + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const size = u16be(b, off + 2);
    if (size < 2) return 1;
    if (marker === 0xe1 && b[off + 4] === 0x45 && b[off + 5] === 0x78 && b[off + 6] === 0x69 && b[off + 7] === 0x66) {
      const tiff = off + 10;
      const le = b[tiff] === 0x49;
      const r16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
      const r32 = (o: number) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
      const ifd0 = tiff + r32(tiff + 4);
      if (ifd0 + 2 > b.length) return 1;
      const n = r16(ifd0);
      for (let i = 0; i < n; i++) {
        const e = ifd0 + 2 + i * 12;
        if (e + 12 > b.length) break;
        if (r16(e) === 0x0112) { const v = r16(e + 8); return v >= 1 && v <= 8 ? v : 1; }
      }
      return 1;
    }
    off += 2 + size;
  }
  return 1;
}

/** Output dimensions after applying EXIF orientation (5..8 transpose W/H). */
export function orientedDimensions(w: number, h: number, o: number): Dimensions {
  return o >= 5 ? { width: h, height: w } : { width: w, height: h };
}

/** Source (sx,sy) for output pixel (dx,dy) under EXIF orientation `o`. Pure math. */
export function orientedSource(o: number, dx: number, dy: number, w: number, h: number): { sx: number; sy: number } {
  switch (o) {
    case 2: return { sx: w - 1 - dx, sy: dy }; //          mirror horizontal
    case 3: return { sx: w - 1 - dx, sy: h - 1 - dy }; //  180
    case 4: return { sx: dx, sy: h - 1 - dy }; //          mirror vertical
    case 5: return { sx: dy, sy: dx }; //                  transpose
    case 6: return { sx: dy, sy: h - 1 - dx }; //          90° CW
    case 7: return { sx: w - 1 - dy, sy: h - 1 - dx }; //  transverse
    case 8: return { sx: w - 1 - dy, sy: dx }; //          90° CCW
    default: return { sx: dx, sy: dy }; //                 identity
  }
}
