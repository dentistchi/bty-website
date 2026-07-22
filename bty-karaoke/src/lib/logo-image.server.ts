// Room Branding V1 — server-only logo normalization (proven in the Worker runtime,
// Phase 1). Validates BEFORE decoding (pre-decode dimension gate = decompression-bomb
// defense), decodes with @cf-wasm/photon, applies EXIF orientation by exact raw-pixel
// transpose (photon's `rotate` washes the image, so it is not used), cover-crops to
// exactly 512×512, and re-encodes canonical WebP (strips metadata, preserves alpha).
// Stores nothing — the caller persists only the returned WebP.

import { PhotonImage, resize, crop, SamplingFilter } from '@cf-wasm/photon';
import {
  checkImageBytes,
  jpegExifOrientation,
  orientedDimensions,
  orientedSource,
  IMAGE_LIMITS,
} from '@/domain/image-inspect';

export type NormalizeResult =
  | { ok: true; webp: Uint8Array }
  | { ok: false; reason: string };

/** Apply EXIF orientation via exact pixel remap → a NEW image (or the same for o=1). */
function applyOrientation(img: PhotonImage, o: number): PhotonImage {
  if (o === 1) return img;
  const w = img.get_width(), h = img.get_height();
  const src = img.get_raw_pixels();
  const { width: OW, height: OH } = orientedDimensions(w, h, o);
  const out = new Uint8Array(OW * OH * 4);
  for (let dy = 0; dy < OH; dy++) {
    for (let dx = 0; dx < OW; dx++) {
      const { sx, sy } = orientedSource(o, dx, dy, w, h);
      const si = (sy * w + sx) * 4, di = (dy * OW + dx) * 4;
      out[di] = src[si]; out[di + 1] = src[si + 1]; out[di + 2] = src[si + 2]; out[di + 3] = src[si + 3];
    }
  }
  return new PhotonImage(out, OW, OH);
}

/** Cover-fit to exactly 512×512: scale the short side to 512, center-crop. */
function coverTo512(img: PhotonImage): PhotonImage {
  const w = img.get_width(), h = img.get_height();
  const scale = Math.max(512 / w, 512 / h);
  const rw = Math.max(512, Math.round(w * scale)), rh = Math.max(512, Math.round(h * scale));
  const resized = resize(img, rw, rh, SamplingFilter.Lanczos3);
  if (rw === 512 && rh === 512) return resized;
  const x1 = Math.floor((rw - 512) / 2), y1 = Math.floor((rh - 512) / 2);
  const cropped = crop(resized, x1, y1, x1 + 512, y1 + 512);
  resized.free();
  return cropped;
}

/**
 * Normalize an uploaded image to a canonical 512×512 WebP. Returns the WebP bytes or
 * a typed rejection. The pre-decode `checkImageBytes` gate runs first; after decode
 * the ACTUAL decoded dimensions are re-verified against the header + limits (a lying
 * header can't smuggle a bomb past the decoder).
 */
export async function normalizeLogoToWebp(bytes: Uint8Array): Promise<NormalizeResult> {
  const check = checkImageBytes(bytes);
  if (!check.ok) return { ok: false, reason: check.reason };

  let src: PhotonImage;
  try {
    src = PhotonImage.new_from_byteslice(bytes);
  } catch {
    return { ok: false, reason: 'undecodable' };
  }

  try {
    const w = src.get_width(), h = src.get_height();
    if (w !== check.width || h !== check.height) { src.free(); return { ok: false, reason: 'dimension_mismatch' }; }
    if (w > IMAGE_LIMITS.maxSide || h > IMAGE_LIMITS.maxSide || w * h > IMAGE_LIMITS.maxPixels) {
      src.free();
      return { ok: false, reason: 'too_large_decoded' };
    }

    const orientation = check.format === 'jpeg' ? jpegExifOrientation(bytes) : 1;
    const oriented = applyOrientation(src, orientation);
    const canonical = coverTo512(oriented);
    if (oriented !== src && oriented !== canonical) oriented.free();

    // Copy the WebP bytes OUT of wasm memory before freeing the image.
    const webp = canonical.get_bytes_webp().slice();
    canonical.free();
    src.free();
    if (webp.length === 0) return { ok: false, reason: 'encode_failed' };
    return { ok: true, webp };
  } catch {
    try { src.free(); } catch { /* */ }
    return { ok: false, reason: 'processing_failed' };
  }
}
