/**
 * Foundry Living Thread — pure domain (V1).
 *
 * A Living Thread is NOT a diagnosis and NOT an identity. It shows one connection
 * that is *checkable* across sentences the user actually wrote, on different days,
 * in different completed trainings. It never claims a pattern that the evidence
 * does not support, and it never counts one response as recurrence.
 *
 * This module owns the DECISION half (pure, no I/O, no display strings):
 *   Completed history → Eligibility → Evidence Packet → Fingerprint → [EXPRESS] → Validator
 *
 * The EXPRESSION half (LLM prompt, deterministic fallback copy, status messages,
 * date formatting) lives in the service layer (`livingThreadExpression.ts`).
 * The bans are shared with the reflection guard (one source of truth) via
 * `scanForbiddenExpression` — so "you keep / you always / you are a …" are rejected
 * here too — while *date-anchored* recurrence ("Across these three reflections…")
 * is allowed because it is grounded in real, separate evidence.
 *
 * No DB, no network, no framework, NO display strings.
 */

import {
  scanForbiddenExpression,
  matchesDelayCostFrame,
  matchesPatienceRetreat,
} from "./living-reflection";

export const LIVING_THREAD_PROMPT_VERSION = "v1";

/** Eligibility thresholds (V1). Repository reality may tighten, never loosen, these. */
export const THREAD_MIN_RECORDS = 3;
export const THREAD_MIN_SPAN_DAYS = 14;

const EXCERPT_MAX = 200; // short excerpt of the user's own words (grounding + display)
const THREAD_MAX = 400; // the thread is 1–2 sentences
const QUESTION_MAX = 240; // one grounded question
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CompletionMeaning = "pass" | "review" | "incomplete";

/** One completed Foundry training belonging to the CURRENT user. */
export type FoundryHistoryRecord = {
  eventId: string;
  eventTitle: string;
  completedAt: string; // ISO
  responseText: string; // user-authored final reflection (may be empty)
  aiReflectionLine: string | null; // stored AI reflection meaning line — reference only
  completionState: CompletionMeaning | null;
};

export type ThreadStatus = "none" | "one" | "two" | "gathering" | "eligible";

export type ThreadEligibility = {
  status: ThreadStatus;
  eligible: boolean;
  /** Distinct completed events that carry real user-authored text. */
  eligibleCount: number;
  spanDays: number;
  reason: string;
};

// ---------------------------------------------------------------------------
// Helpers (pure).
// ---------------------------------------------------------------------------

function toMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function collapse(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

/** A short, clean excerpt of the user's own words (word-boundary, "…" if cut). */
export function excerptOf(raw: unknown, max = EXCERPT_MAX): string {
  const one = collapse(raw);
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function hasRealText(r: FoundryHistoryRecord): boolean {
  return collapse(r.responseText).length > 0;
}

/**
 * Distinct completed events that carry real user text. Two rows for the same
 * event (should not happen given the unique index, but defended anyway) count
 * once — a reloaded/re-saved record is never independent evidence.
 */
function eligibleRecords(records: FoundryHistoryRecord[]): FoundryHistoryRecord[] {
  const byEvent = new Map<string, FoundryHistoryRecord>();
  for (const r of records) {
    if (!hasRealText(r) || !Number.isFinite(toMs(r.completedAt))) continue;
    const existing = byEvent.get(r.eventId);
    // Keep the earliest completion per event (the original, not a re-save).
    if (!existing || toMs(r.completedAt) < toMs(existing.completedAt)) byEvent.set(r.eventId, r);
  }
  return [...byEvent.values()].sort((a, b) => toMs(a.completedAt) - toMs(b.completedAt));
}

function spanDaysOf(sorted: FoundryHistoryRecord[]): number {
  if (sorted.length < 2) return 0;
  const first = toMs(sorted[0].completedAt);
  const last = toMs(sorted[sorted.length - 1].completedAt);
  return Math.floor((last - first) / MS_PER_DAY);
}

/**
 * ELIGIBILITY. A Living Thread is generated ONLY with enough longitudinal
 * evidence: ≥3 real user reflections, from distinct completed events, spanning
 * ≥14 days. 0–2 → a quiet status, never a synthesized pattern.
 */
export function evaluateThreadEligibility(records: FoundryHistoryRecord[]): ThreadEligibility {
  const elig = eligibleRecords(records);
  const count = elig.length;
  const spanDays = spanDaysOf(elig);

  if (count === 0) return { status: "none", eligible: false, eligibleCount: 0, spanDays, reason: "no_records" };
  if (count === 1) return { status: "one", eligible: false, eligibleCount: 1, spanDays, reason: "one_record" };
  if (count === 2) return { status: "two", eligible: false, eligibleCount: 2, spanDays, reason: "two_records" };
  if (spanDays < THREAD_MIN_SPAN_DAYS) {
    return { status: "gathering", eligible: false, eligibleCount: count, spanDays, reason: "span_too_short" };
  }
  return { status: "eligible", eligible: true, eligibleCount: count, spanDays, reason: "eligible" };
}

// ---------------------------------------------------------------------------
// Evidence packet — user text is the PRIMARY evidence; AI lines are reference only.
// ---------------------------------------------------------------------------

export type EvidenceMoment = {
  eventId: string;
  eventTitle: string;
  date: string; // ISO
  /** The user's own words — the highest-confidence evidence. */
  userExcerpt: string;
  /** A previously stored AI reflection line — reference expression ONLY, never
   *  independent proof of a recurring pattern. */
  aiReflectionLine: string | null;
};

export type EvidencePacket = {
  moments: EvidenceMoment[]; // eligible only, oldest → newest
  sourceCount: number;
  spanDays: number;
  promptVersion: string;
};

export function buildEvidencePacket(records: FoundryHistoryRecord[]): EvidencePacket {
  const elig = eligibleRecords(records);
  return {
    moments: elig.map((r) => ({
      eventId: r.eventId,
      eventTitle: collapse(r.eventTitle),
      date: r.completedAt,
      userExcerpt: excerptOf(r.responseText),
      aiReflectionLine: r.aiReflectionLine ? collapse(r.aiReflectionLine) : null,
    })),
    sourceCount: elig.length,
    spanDays: spanDaysOf(elig),
    promptVersion: LIVING_THREAD_PROMPT_VERSION,
  };
}

/**
 * The canonical string of the EXACT evidence a thread is built from — the material
 * a fingerprint hashes. Same evidence → same string (order-independent: eligible
 * records are date-sorted); any change to the eligible responses (add/edit) → a
 * different string. Uses the FULL user text (not the excerpt) so real edits are
 * detected. Pure and hash-free: the SERVICE turns this into a collision-resistant
 * SHA-256 fingerprint (domain stays free of runtime crypto).
 */
export function canonicalEvidenceString(records: FoundryHistoryRecord[]): string {
  return eligibleRecords(records)
    .map((r) => `${r.eventId}|${r.completedAt}|${collapse(r.responseText)}`)
    .join("~");
}

// ---------------------------------------------------------------------------
// Living Thread validator — the gate every expression (LLM or fallback) passes.
// ---------------------------------------------------------------------------

/** The user-facing thread. supportingMoments reference packet eventIds ONLY —
 *  their date/title are re-attached from the packet, never authored by the AI. */
export type LivingThread = {
  thread: string;
  supportingMoments: { eventId: string; excerpt: string }[];
  nextQuestion: string | null;
};

export type ThreadValidation =
  | { ok: true; value: LivingThread }
  | { ok: false; reason: string };

/** Identity diagnosis / psychological inference / guaranteed-growth claims —
 *  banned on top of the shared expression bans (recurrence-as-character, praise…). */
const THREAD_FORBIDDEN: { re: RegExp; code: string }[] = [
  { re: /\bthis is who you are\b/i, code: "identity_claim" },
  { re: /\byour leadership style\b/i, code: "identity_claim" },
  { re: /\byou have (?:transformed|become|grown into)\b/i, code: "growth_claim" },
  { re: /\bbecoming a\b[^.]*\bleader\b/i, code: "growth_claim" },
  { re: /\ba pattern is emerging\b/i, code: "growth_claim" },
  { re: /\bdeep down\b/i, code: "psych_inference" },
  { re: /\byou (?:secretly |really )?fear\b/i, code: "psych_inference" },
  { re: /\byou are afraid\b/i, code: "psych_inference" },
  { re: /\bsubconscious/i, code: "psych_inference" },
];

function scanThreadText(text: string): string | null {
  return scanForbiddenExpression(text) ?? THREAD_FORBIDDEN.find((r) => r.re.test(text))?.code ?? null;
}

/**
 * Validate a Living Thread against the contract:
 *  - thread: 1–2 sentences, no identity/psych/growth/recurrence-as-character claim,
 *    no patience-retreat against a delay frame drawn from the real evidence,
 *  - supportingMoments: 2–3 real moments, each referencing a packet eventId (no
 *    fabricated event), each with a non-empty excerpt,
 *  - nextQuestion: optional; when present it is one grounded question (ends "?"),
 *    passes the same bans, and does not retreat from a delay frame.
 * On any failure the caller falls back to the deterministic thread.
 */
export function validateLivingThread(input: unknown, packet: EvidencePacket): ThreadValidation {
  if (!input || typeof input !== "object") return { ok: false, reason: "malformed_shape" };
  const obj = input as Record<string, unknown>;

  const thread = typeof obj.thread === "string" ? obj.thread.trim() : "";
  if (thread.length < 1 || thread.length > THREAD_MAX) return { ok: false, reason: "malformed_shape" };

  const packetIds = new Set(packet.moments.map((m) => m.eventId));
  const frameText = packet.moments.map((m) => m.userExcerpt).join(" ");
  const framed = matchesDelayCostFrame(frameText);

  const threadBad = scanThreadText(thread);
  if (threadBad) return { ok: false, reason: threadBad };
  if (framed && matchesPatienceRetreat(thread)) return { ok: false, reason: "invitation_contradicts_frame" };

  // Supporting moments: 2–3, each grounded in a real packet event.
  const rawMoments = Array.isArray(obj.supportingMoments) ? obj.supportingMoments : null;
  if (!rawMoments || rawMoments.length < 2 || rawMoments.length > 3) {
    return { ok: false, reason: "supporting_moments_count" };
  }
  const supportingMoments: LivingThread["supportingMoments"] = [];
  for (const raw of rawMoments) {
    if (!raw || typeof raw !== "object") return { ok: false, reason: "supporting_moment_shape" };
    const m = raw as Record<string, unknown>;
    const eventId = typeof m.eventId === "string" ? m.eventId : "";
    const excerpt = typeof m.excerpt === "string" ? m.excerpt.trim() : "";
    if (!packetIds.has(eventId)) return { ok: false, reason: "fabricated_event" };
    if (excerpt.length < 1) return { ok: false, reason: "empty_excerpt" };
    supportingMoments.push({ eventId, excerpt });
  }

  // Next question (optional).
  let nextQuestion: string | null = null;
  if (obj.nextQuestion != null && obj.nextQuestion !== "") {
    const q = typeof obj.nextQuestion === "string" ? obj.nextQuestion.trim() : "";
    if (q.length < 1 || q.length > QUESTION_MAX) return { ok: false, reason: "question_shape" };
    if (!q.endsWith("?")) return { ok: false, reason: "question_not_grounded" };
    const qBad = scanThreadText(q);
    if (qBad) return { ok: false, reason: qBad };
    if (framed && matchesPatienceRetreat(q)) return { ok: false, reason: "invitation_contradicts_frame" };
    nextQuestion = q;
  }

  return { ok: true, value: { thread, supportingMoments, nextQuestion } };
}
