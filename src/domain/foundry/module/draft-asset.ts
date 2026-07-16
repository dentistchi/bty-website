/**
 * Foundry Guided Module Builder — draft asset validation (Slice 2.1.2, pure).
 *
 * Server-authoritative file intake rules for multi-format draft attachments. The
 * client-reported MIME is NEVER trusted alone: a file is accepted only when its
 * normalized extension is allowlisted AND its bytes carry an acceptable
 * signature/container for that format. A material extension↔content mismatch is
 * rejected. No DB, no storage, no I/O — bytes in, verdict out.
 *
 * Readiness is three separate ideas (see projectReadiness): attached (stored),
 * preview_supported (builder can show it), participant_delivery_ready (the CURRENT
 * participant runtime can serve it — PDF only in this slice).
 */

import { verifyPdfSignature, derivePdfPageCount } from "../events/foundry-pdf-inspect";

export type FileKind = "pdf" | "document" | "spreadsheet" | "presentation" | "text" | "image";

export const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MB per file
export const MAX_ASSETS_PER_DRAFT = 10;
export const MAX_DRAFT_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB per draft

type Spec = { kind: FileKind; mime: string; sig: SigCheck };
type SigCheck = (b: Uint8Array) => boolean;

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------
function startsWith(b: Uint8Array, bytes: number[], offset = 0): boolean {
  if (b.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) if (b[offset + i] !== bytes[i]) return false;
  return true;
}
function asciiAt(b: Uint8Array, offset: number, s: string): boolean {
  if (b.length < offset + s.length) return false;
  for (let i = 0; i < s.length; i++) if (b[offset + i] !== s.charCodeAt(i)) return false;
  return true;
}
/** Search for an ASCII needle in the bytes (whole buffer; native Buffer.indexOf). */
function containsAscii(b: Uint8Array, needle: string): boolean {
  return Buffer.from(b.buffer, b.byteOffset, b.byteLength).indexOf(needle, 0, "latin1") !== -1;
}

// ---------------------------------------------------------------------------
// Signature checks
// ---------------------------------------------------------------------------
const isPdf: SigCheck = (b) => verifyPdfSignature(b);
const isOle: SigCheck = (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const isZip: SigCheck = (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);
const isRtf: SigCheck = (b) => asciiAt(b, 0, "{\\rtf");
const isJpeg: SigCheck = (b) => startsWith(b, [0xff, 0xd8, 0xff]);
const isPng: SigCheck = (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isWebp: SigCheck = (b) => asciiAt(b, 0, "RIFF") && asciiAt(b, 8, "WEBP");
const HEIC_BRANDS = ["heic", "heix", "heif", "hevc", "mif1", "msf1", "heim", "heis", "hevx"];
const isHeic: SigCheck = (b) => asciiAt(b, 4, "ftyp") && HEIC_BRANDS.some((brand) => asciiAt(b, 8, brand));

/** An Office Open XML package: a ZIP that actually carries the OOXML parts. */
function isOoxml(kindDir: string): SigCheck {
  return (b) => isZip(b) && containsAscii(b, "[Content_Types].xml") && containsAscii(b, kindDir);
}

/** Textual: no NUL bytes and few control chars in a leading sample. */
const isTextual: SigCheck = (b) => {
  const n = Math.min(b.length, 65536);
  if (n === 0) return false;
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const c = b[i];
    if (c === 0x00) return false;
    const control = c < 0x09 || (c > 0x0d && c < 0x20);
    if (control) bad++;
  }
  return bad / n < 0.1;
};

// ---------------------------------------------------------------------------
// Extension allowlist (canonical MIME is server-owned, not the client's claim)
// ---------------------------------------------------------------------------
const ALLOW: Record<string, Spec> = {
  pdf: { kind: "pdf", mime: "application/pdf", sig: isPdf },
  doc: { kind: "document", mime: "application/msword", sig: isOle },
  docx: { kind: "document", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sig: isOoxml("word/") },
  ppt: { kind: "presentation", mime: "application/vnd.ms-powerpoint", sig: isOle },
  pptx: { kind: "presentation", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", sig: isOoxml("ppt/") },
  xls: { kind: "spreadsheet", mime: "application/vnd.ms-excel", sig: isOle },
  xlsx: { kind: "spreadsheet", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sig: isOoxml("xl/") },
  csv: { kind: "text", mime: "text/csv", sig: isTextual },
  txt: { kind: "text", mime: "text/plain", sig: isTextual },
  md: { kind: "text", mime: "text/markdown", sig: isTextual },
  rtf: { kind: "text", mime: "application/rtf", sig: (b) => isRtf(b) || isTextual(b) },
  jpg: { kind: "image", mime: "image/jpeg", sig: isJpeg },
  jpeg: { kind: "image", mime: "image/jpeg", sig: isJpeg },
  png: { kind: "image", mime: "image/png", sig: isPng },
  webp: { kind: "image", mime: "image/webp", sig: isWebp },
  heic: { kind: "image", mime: "image/heic", sig: isHeic },
  heif: { kind: "image", mime: "image/heif", sig: isHeic },
};

/** Explicitly-blocked extensions (defense in depth; anything not allowlisted is rejected anyway). */
export const BLOCKED_EXTENSIONS: readonly string[] = [
  "exe", "dmg", "apk", "js", "sh", "bat", "cmd", "zip", "rar", "7z", "tar", "gz", "app", "msi", "com", "scr",
];

export const SUPPORTED_EXTENSIONS = Object.keys(ALLOW);

export function normalizeExtension(filename: unknown): string | null {
  if (typeof filename !== "string") return null;
  const m = filename.trim().toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Best-effort image dimensions (PNG + JPEG; others null)
// ---------------------------------------------------------------------------
function pngDims(b: Uint8Array): { width: number; height: number } | null {
  if (!isPng(b) || b.length < 24) return null;
  const w = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
  const h = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23];
  return w > 0 && h > 0 ? { width: w, height: h } : null;
}
function jpegDims(b: Uint8Array): { width: number; height: number } | null {
  if (!isJpeg(b)) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    // SOF0..SOF15 except DHT(C4)/JPG(C8)/DAC(CC) carry frame dimensions.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const h = (b[i + 5] << 8) | b[i + 6];
      const w = (b[i + 7] << 8) | b[i + 8];
      return w > 0 && h > 0 ? { width: w, height: h } : null;
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len <= 0) return null;
    i += 2 + len;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
export type AssetInspection = {
  ext: string;
  fileKind: FileKind;
  mime: string;
  pageCount: number | null;
  pageCountVerified: boolean;
  width: number | null;
  height: number | null;
};

export type AssetInspectionResult =
  | { ok: true; value: AssetInspection }
  | { ok: false; reason: string };

/**
 * Validate a file by its filename + bytes (the client MIME hint is ignored for
 * the decision). Reasons: `unsupported_file_type`, `invalid_file_signature`,
 * `file_empty`, `file_too_large`.
 */
export function inspectAsset(filename: unknown, bytes: Uint8Array): AssetInspectionResult {
  if (!bytes || bytes.length === 0) return { ok: false, reason: "file_empty" };
  if (bytes.length > MAX_ASSET_BYTES) return { ok: false, reason: "file_too_large" };

  const ext = normalizeExtension(filename);
  if (!ext || !(ext in ALLOW)) return { ok: false, reason: "unsupported_file_type" };

  const spec = ALLOW[ext];
  if (!spec.sig(bytes)) return { ok: false, reason: "invalid_file_signature" };

  let pageCount: number | null = null;
  let pageCountVerified = false;
  if (spec.kind === "pdf") {
    const derived = derivePdfPageCount(bytes);
    pageCount = derived.count;
    pageCountVerified = derived.count != null;
  }

  let width: number | null = null;
  let height: number | null = null;
  if (spec.kind === "image") {
    const dims = pngDims(bytes) ?? jpegDims(bytes);
    if (dims) {
      width = dims.width;
      height = dims.height;
    }
  }

  return { ok: true, value: { ext, fileKind: spec.kind, mime: spec.mime, pageCount, pageCountVerified, width, height } };
}

// ---------------------------------------------------------------------------
// Readiness projection (honest, per file kind)
// ---------------------------------------------------------------------------
export function previewSupported(fileKind: FileKind): boolean {
  return fileKind === "pdf" || fileKind === "image";
}
/** Only PDF is deliverable by the CURRENT participant runtime. */
export function participantDeliveryReady(fileKind: FileKind): boolean {
  return fileKind === "pdf";
}
