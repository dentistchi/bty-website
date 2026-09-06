import { inflateSync } from "node:zlib";

/**
 * A minimal PNG reader — enough to ASSERT things about an icon, and nothing more. Slice TQ-4.
 *
 * ★ WHY NOT A LIBRARY. The Teams outline icon is guarded by pixel facts (is it 32×32, is the
 * background truly transparent, is every visible pixel pure white, is the anti-aliasing a thin edge
 * or the whole mark). A guard that only runs when a transitive native dependency happens to resolve
 * is a guard that quietly stops running. `node:zlib` ships with the runtime and cannot disappear.
 *
 * Deliberately narrow: 8-bit RGBA, non-interlaced — exactly what the build script emits. Anything
 * else THROWS rather than being interpreted, because a silently mis-decoded icon would produce
 * confident numbers about the wrong bytes.
 */

export type Rgba = { width: number; height: number; data: Uint8Array };

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function decodePng(buf: Buffer): Rgba {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (buf[i] !== SIGNATURE[i]) throw new Error("not a PNG");
  }
  let width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = 0;
  const idat: Buffer[] = [];
  let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    p += 12 + len; // length + type + data + crc
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (colorType !== 6) throw new Error(`unsupported colour type ${colorType} (expected 8-bit RGBA)`);
  if (interlace !== 0) throw new Error("interlaced PNG unsupported");

  const raw = inflateSync(Buffer.concat(idat));
  const ch = 4;
  const stride = width * ch;
  const out = new Uint8Array(width * height * ch);
  let prev = new Uint8Array(stride);
  let q = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[q++];
    const line = raw.subarray(q, q + stride);
    q += stride;
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;   // left
      const b = prev[x];                      // up
      const c = x >= ch ? prev[x - ch] : 0;   // up-left
      const v = line[x];
      let val: number;
      switch (filter) {
        case 0: val = v; break;
        case 1: val = v + a; break;
        case 2: val = v + b; break;
        case 3: val = v + ((a + b) >> 1); break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          val = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`unknown PNG filter ${filter}`);
      }
      cur[x] = val & 0xff;
    }
    out.set(cur, y * stride);
    prev = cur;
  }
  return { width, height, data: out };
}

/** Alpha-only view, row-major. */
export function alphaOf({ width, height, data }: Rgba): number[] {
  const a: number[] = [];
  for (let i = 0; i < width * height; i++) a.push(data[i * 4 + 3]);
  return a;
}

/**
 * Area-average downsample of the ALPHA channel — the same operation a renderer performs when it
 * draws a 32px asset into a smaller box, so "does the mark survive at app-bar size" is answered by
 * arithmetic rather than by opinion.
 */
export function downsampleAlpha(alpha: number[], w: number, h: number, size: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = (x * w) / size, x1 = ((x + 1) * w) / size;
      const y0 = (y * h) / size, y1 = ((y + 1) * h) / size;
      let sum = 0, area = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const cover = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * (Math.min(y1, sy + 1) - Math.max(y0, sy));
          if (cover <= 0) continue;
          sum += alpha[sy * w + sx] * cover;
          area += cover;
        }
      }
      out.push(area > 0 ? Math.round(sum / area) : 0);
    }
  }
  return out;
}

/**
 * Width and height from the IHDR alone — for images this module deliberately cannot decode.
 * `color.png` is 8-bit RGB with no alpha channel (colour type 2), which `decodePng` refuses on
 * purpose; its dimensions are still worth asserting.
 */
export function pngSize(buf: Buffer): { width: number; height: number; colorType: number } {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (buf[i] !== SIGNATURE[i]) throw new Error("not a PNG");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}
