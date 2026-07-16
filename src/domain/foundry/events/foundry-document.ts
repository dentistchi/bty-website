/**
 * Foundry PDF Study Room — domain (pure).
 *
 * The DOCUMENT content type's rules: PDF input validation, the deterministic
 * reading-participation gate, and the pure helpers the service uses to maintain
 * canonical reading progress. No DB, no crypto, no I/O — inputs in, values out.
 *
 * Honesty note: the reading gate is a PARTICIPATION requirement (the participant
 * turned every page and spent a floor of active time), NOT proof of comprehension.
 * The service and UI must describe it that way.
 */

import type { ValidationResult } from "./foundry-event";

/** PDF only. A single canonical mime + extension — no Office formats in V1. */
export const FOUNDRY_DOC_ALLOWED_MIME = "application/pdf";
/** 25 MB — large enough for real training decks, small enough to read on mobile. */
export const FOUNDRY_DOC_MAX_BYTES = 25 * 1024 * 1024;
export const FOUNDRY_DOC_MAX_PAGES = 2000;
export const FOUNDRY_DOC_PROMPT_MAX = 300;
export const FOUNDRY_DOC_INTRO_MAX = 600;

/**
 * Page-aware reading-time gate. A one-page handout and a fifty-page manual must
 * NOT behave identically, so the minimum active reading time scales with page
 * count, floored (so a tiny doc still asks for a real beat) and capped (so a huge
 * doc does not become punitive). All values are seconds.
 */
export const FOUNDRY_DOC_SECONDS_PER_PAGE = 5;
export const FOUNDRY_DOC_MIN_READ_FLOOR = 15;
export const FOUNDRY_DOC_MIN_READ_CAP = 300; // 5 minutes

/**
 * The largest active-reading delta a single heartbeat may contribute. Heartbeats
 * report the visible time elapsed since the last beat; clamping each delta stops
 * a client from fast-forwarding the gate by reporting a huge number. Chosen well
 * above the client heartbeat cadence (~10s) with slack for a slow round-trip.
 */
export const FOUNDRY_DOC_MAX_HEARTBEAT_DELTA_MS = 30_000;

export function isAllowedPdfMime(type: unknown): boolean {
  return typeof type === "string" && type.trim().toLowerCase() === FOUNDRY_DOC_ALLOWED_MIME;
}

/** Extension guard — defense in depth alongside the mime check. */
export function isPdfFilename(name: unknown): boolean {
  return typeof name === "string" && /\.pdf$/i.test(name.trim());
}

/**
 * Validate the client-declared page count (the Host's own client reads it from
 * the PDF at upload time). It gates only that Host's participants, so it is not a
 * security-critical value — but it is bounded so a bad value cannot create an
 * un-completable or trivially-completable room.
 */
export function validatePageCount(raw: unknown): ValidationResult<number> {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1) return { ok: false, reason: "page_count_invalid" };
  if (n > FOUNDRY_DOC_MAX_PAGES) return { ok: false, reason: "page_count_too_large" };
  return { ok: true, value: n };
}

/**
 * Validate the optional host introduction. Absent/blank → null (allowed). Present
 * → trimmed, control-chars-except-newlines stripped, 1..600 chars.
 */
export function validateIntro(raw: unknown): ValidationResult<string | null> {
  if (raw == null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, reason: "intro_invalid" };
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    const isNewline = code === 0x0a || code === 0x0d;
    if (!isNewline && (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029)) {
      continue;
    }
    out += ch;
  }
  const cleaned = out.trim();
  if (cleaned.length < 1) return { ok: true, value: null };
  if (cleaned.length > FOUNDRY_DOC_INTRO_MAX) return { ok: false, reason: "intro_too_long" };
  return { ok: true, value: cleaned };
}

/** Deterministic minimum active reading time for a document of `pageCount` pages. */
export function computeMinReadSeconds(pageCount: number): number {
  const scaled = pageCount * FOUNDRY_DOC_SECONDS_PER_PAGE;
  return Math.min(FOUNDRY_DOC_MIN_READ_CAP, Math.max(FOUNDRY_DOC_MIN_READ_FLOOR, scaled));
}

/** Clamp one heartbeat's reported active-time delta into the honest range. */
export function clampReadDeltaMs(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), FOUNDRY_DOC_MAX_HEARTBEAT_DELTA_MS);
}

/** Keep only whole page numbers within [1, pageCount]. */
function sanitizePageList(raw: unknown, pageCount: number): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isInteger(n) && n >= 1 && n <= pageCount) out.push(n);
  }
  return out;
}

/**
 * Merge newly-reported viewed pages into the canonical distinct set. Repeated
 * viewing of the same page never inflates the count (set union), and pages
 * outside [1, pageCount] are dropped. Returns a sorted, de-duplicated array.
 */
export function mergeViewedPages(existing: unknown, incoming: unknown, pageCount: number): number[] {
  const set = new Set<number>(sanitizePageList(existing, pageCount));
  for (const p of sanitizePageList(incoming, pageCount)) set.add(p);
  return Array.from(set).sort((a, b) => a - b);
}

export function distinctViewedCount(viewed: unknown, pageCount: number): number {
  return new Set(sanitizePageList(viewed, pageCount)).size;
}

/** Validate a single reported current page for `document_last_page`. */
export function sanitizeLastPage(raw: unknown, pageCount: number): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > pageCount) return null;
  return n;
}

/**
 * The deterministic reading-participation gate: EVERY page visited AND the
 * page-aware minimum active reading time reached. The reflection requirement is
 * enforced separately at completion (this only governs whether reading is done).
 */
export function isReadingRequirementMet(args: {
  pageCount: number;
  distinctViewed: number;
  activeReadMs: number;
  minReadSeconds: number;
}): boolean {
  const { pageCount, distinctViewed, activeReadMs, minReadSeconds } = args;
  if (pageCount < 1) return false;
  return distinctViewed >= pageCount && activeReadMs >= minReadSeconds * 1000;
}
