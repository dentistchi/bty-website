/**
 * Foundry document — server-side PDF inspection (pure).
 *
 * Operates on the RAW bytes the server actually received, so nothing here trusts
 * a filename, a browser MIME type, or a client-supplied page count. Signature
 * verification is authoritative and reliable; page-count derivation is best-effort
 * (a compressed PDF can hide its page objects in object streams) and reports
 * whether it succeeded so the caller never silently retains a client value.
 *
 * No I/O, no crypto, no Node/DOM APIs beyond the standard TextDecoder — pure
 * byte→value functions that run identically in Node and the Workers runtime.
 */

import { FOUNDRY_DOC_MAX_PAGES } from "./foundry-document";

/** The PDF magic bytes: "%PDF-". */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

/**
 * True iff the bytes are a genuine PDF: the "%PDF-" signature must appear within
 * the first 1024 bytes (the spec permits leading junk/BOM before the header).
 * This is the authoritative content check — a file renamed to `.pdf` or sent with
 * an `application/pdf` MIME but non-PDF content fails here.
 */
export function verifyPdfSignature(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < PDF_MAGIC.length) return false;
  const limit = Math.min(bytes.length - PDF_MAGIC.length, 1024);
  for (let i = 0; i <= limit; i++) {
    let hit = true;
    for (let j = 0; j < PDF_MAGIC.length; j++) {
      if (bytes[i + j] !== PDF_MAGIC[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
}

export type PdfPageCountResult = {
  /** Server-derived page count, or null when the bytes were undeterminable. */
  count: number | null;
  /** How it was derived — for observability + the verified flag. */
  /** `object_stream_count` = found only after inflating compressed object streams (3.2R-R6). */
  method: "page_tree_count" | "type_page_objects" | "object_stream_count" | "undeterminable";
};

/**
 * Derive the page count from the raw bytes, without a full PDF parser:
 *  - primary: the MAX `/Count N` in the document — the page-tree ROOT node's
 *    Count is the total page number, and the root is virtually always
 *    uncompressed (even linearized PDFs keep it in cleartext);
 *  - fallback: count `/Type /Page` object headers (works for uncompressed PDFs,
 *    undercounts when page objects live in object streams).
 * Returns null only when neither signal is present (heavily compressed PDF whose
 * page tree is entirely inside object streams) — the caller must then treat the
 * count as unverified rather than trusting a client value silently.
 */
export function derivePdfPageCount(bytes: Uint8Array): PdfPageCountResult {
  if (!bytes || bytes.length === 0) return { count: null, method: "undeterminable" };
  // latin1 keeps every byte 1:1 so byte-offset regexes are stable.
  return countPagesInPdfText(new TextDecoder("latin1").decode(bytes));
}

/**
 * The same counting rules, over ANY latin1 view of PDF syntax — the raw file, or the inflated
 * contents of its object streams (Slice 3.2R-R6).
 *
 * Extracted so the deep pass can reuse the exact rules rather than reimplementing them beside
 * a decompressor. The rules are the authority; where the bytes came from is the caller's
 * problem, and the codec stays out of the domain.
 */
export function countPagesInPdfText(text: string): PdfPageCountResult {

  // Primary: the largest /Count in the page tree (root node's total).
  let maxCount = 0;
  const countRe = /\/Count\s+(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = countRe.exec(text)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxCount) maxCount = n;
  }
  if (maxCount >= 1) {
    return { count: Math.min(maxCount, FOUNDRY_DOC_MAX_PAGES), method: "page_tree_count" };
  }

  // Fallback: count /Type /Page object headers (exclude /Type /Pages).
  const pageRe = /\/Type\s*\/Page(?![sA-Za-z])/g;
  let pages = 0;
  while (pageRe.exec(text) !== null) pages++;
  if (pages >= 1) {
    return { count: Math.min(pages, FOUNDRY_DOC_MAX_PAGES), method: "type_page_objects" };
  }

  return { count: null, method: "undeterminable" };
}
