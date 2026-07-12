/**
 * livingResponse (domain) — the Living Response evidence-to-response contract. Pure: no I/O, no
 * Date.now(), no side effects.
 *
 * A Living Response is ONE short perspective grounded in canonical evidence, FRAMED by the user's
 * confirmed relationship for today. The commitment is the frame — it is NOT evidence proving a claim
 * about the user. This module is deliberately separate from the Today Mirror packet/lens (which lock
 * relationship as a DERIVED signal); here `relationship` is the user's explicit committed choice and
 * `relationship_committed` is frame metadata, never an evidence fact.
 *
 * Hard invariants (STEP 1):
 *  1. relationship_committed is frame metadata, not an evidence fact.
 *  2. every evidence fact must resolve to canonical provenance (non-empty provenanceIds).
 *  3. every qualifying fact must match the committed relationship.
 *  4. no raw free text is permitted anywhere in a fact (machine codes/bands only).
 *  5. no names, emails, identifiers, letter bodies, or action text.
 *  6. unknown evidence class fails closed.
 */

export type LivingResponseRelationship = "self" | "others" | "world";
export const LIVING_RESPONSE_RELATIONSHIPS: readonly LivingResponseRelationship[] = ["self", "others", "world"];

/** Canonical evidence classes. Anything not in this set FAILS CLOSED at admission. */
export const LIVING_RESPONSE_EVIDENCE_CLASSES = [
  "self_return_continuity",
  "self_keep_continuity",
  "others_verified_relational_action",
  "others_reexposure_change",
] as const;
export type LivingResponseEvidenceClass = (typeof LIVING_RESPONSE_EVIDENCE_CLASSES)[number];

export type FactConfidence = "low" | "medium" | "high";
export type ResponseConfidence = "grounded" | "limited";

/** A canonical, provenance-anchored evidence fact. Carries ONLY machine codes — never raw text. */
export type LivingResponseEvidenceFact = {
  /** Stable id within the packet, e.g. "fact:self_return_continuity". */
  id: string;
  /** Machine code, e.g. "SELF_RETURN_STEADY" (band, never a raw count). */
  code: string;
  relationship: LivingResponseRelationship;
  evidenceClass: LivingResponseEvidenceClass;
  confidence: FactConfidence;
  /** Canonical provenance ids (row ids / day keys). MUST be non-empty. Never raw text. */
  provenanceIds: string[];
};

export type LivingResponsePacket = {
  commitmentId: string;
  userId: string;
  dayKey: string;
  relationship: LivingResponseRelationship;
  facts: LivingResponseEvidenceFact[];
  /** Safe behavioral concept anchors derived from the facts (ownership, repair, naming, …). Used to
   *  ground the prompt, require a real anchor in validation, and select evidence-specific fallback.
   *  Never machine codes; never shown as tokens. */
  concepts: string[];
  prohibitedFieldsPresent: boolean;
  evidenceFingerprint: string;
};

export type LivingResponseAdmissionReason =
  | "NO_COMMITMENT"
  | "ALREADY_SETTLED"
  | "PROHIBITED_FIELDS"
  | "PROVENANCE_INCOMPLETE"
  | "RELATIONSHIP_MISMATCH"
  | "INSUFFICIENT_EVIDENCE"
  | "WORLD_FALLBACK_ONLY"
  | "LOW_CONFIDENCE"
  | "ELIGIBLE";

export type LivingResponseAdmission = {
  eligible: boolean;
  reason: LivingResponseAdmissionReason;
  confidence: ResponseConfidence;
  qualifyingEvidenceCodes: string[];
};

export function isLivingResponseRelationship(x: unknown): x is LivingResponseRelationship {
  return typeof x === "string" && (LIVING_RESPONSE_RELATIONSHIPS as readonly string[]).includes(x);
}

const KNOWN_CLASS = new Set<string>(LIVING_RESPONSE_EVIDENCE_CLASSES);
const isMediumOrHigh = (c: FactConfidence) => c === "medium" || c === "high";

/** Deterministic, text-free fingerprint (FNV-1a over sorted code|provenance). Contains no raw text. */
export function evidenceFingerprint(facts: LivingResponseEvidenceFact[]): string {
  const material = facts
    .map((f) => `${f.evidenceClass}:${f.code}:${[...f.provenanceIds].sort().join(",")}`)
    .sort()
    .join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `lrf1_${h.toString(16).padStart(8, "0")}`;
}

/**
 * admitLivingResponse — the Living-Response-specific generation gate. Pure, fail-closed.
 * Provider generation is authorized ONLY on `{eligible:true, reason:"ELIGIBLE"}`. Every other path
 * guarantees zero provider calls (the caller settles a deterministic fallback).
 *
 * NOTE: NO_COMMITMENT and ALREADY_SETTLED are resolved by the route BEFORE this is called; they are
 * in the reason union for a single machine-readable vocabulary.
 */
export function admitLivingResponse(packet: LivingResponsePacket): LivingResponseAdmission {
  const deny = (reason: LivingResponseAdmissionReason): LivingResponseAdmission => ({
    eligible: false,
    reason,
    confidence: "limited",
    qualifyingEvidenceCodes: [],
  });

  // 3. no prohibited fields
  if (packet.prohibitedFieldsPresent) return deny("PROHIBITED_FIELDS");

  // 4. provenance complete + 6. unknown class fails closed (applies to EVERY fact)
  for (const f of packet.facts) {
    if (!KNOWN_CLASS.has(f.evidenceClass)) return deny("PROVENANCE_INCOMPLETE");
    if (!Array.isArray(f.provenanceIds) || f.provenanceIds.length === 0) return deny("PROVENANCE_INCOMPLETE");
  }

  // 5. all qualifying evidence must match the committed relationship
  if (packet.facts.some((f) => f.relationship !== packet.relationship)) return deny("RELATIONSHIP_MISMATCH");

  // 6. relationship supported in V1 (World is fallback-only)
  if (packet.relationship === "world") return deny("WORLD_FALLBACK_ONLY");

  // 7/8. evidence threshold/class + confidence (per relationship). Commitment alone → no facts → deny.
  const relevant = packet.facts.filter((f) => f.relationship === packet.relationship);
  const strong = relevant.filter((f) => isMediumOrHigh(f.confidence));

  if (packet.relationship === "self") {
    // A: return-continuity strong, OR B: keep-continuity strong, OR C: ≥2 distinct Self fact classes.
    const strongContinuity = strong.some(
      (f) => f.evidenceClass === "self_return_continuity" || f.evidenceClass === "self_keep_continuity",
    );
    const distinctClasses = new Set(relevant.map((f) => f.evidenceClass)).size;
    if (strongContinuity || (distinctClasses >= 2 && strong.length >= 1)) {
      return { eligible: true, reason: "ELIGIBLE", confidence: "grounded", qualifyingEvidenceCodes: strong.map((f) => f.code) };
    }
    // Distinguish "some evidence but weak" from "nothing": a single low arrival fact → INSUFFICIENT.
    return deny(relevant.length > 0 ? (strong.length === 0 ? "LOW_CONFIDENCE" : "INSUFFICIENT_EVIDENCE") : "INSUFFICIENT_EVIDENCE");
  }

  // others: any provenance-complete relational signal at medium/high qualifies.
  if (packet.relationship === "others") {
    if (strong.length >= 1) {
      return { eligible: true, reason: "ELIGIBLE", confidence: "grounded", qualifyingEvidenceCodes: strong.map((f) => f.code) };
    }
    return deny(relevant.length > 0 ? "LOW_CONFIDENCE" : "INSUFFICIENT_EVIDENCE");
  }

  return deny("INSUFFICIENT_EVIDENCE");
}
