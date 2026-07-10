/**
 * BTY Today AI Mirror — GENERATION ADMISSION policy (pure domain).
 *
 * Product lock: "No Data → No Interpretation." A deterministic lens can always be selected for
 * internal observability, but that does NOT authorize sending a real evidence packet to a provider.
 * This module is the single deterministic decision of whether real evidence is strong enough to
 * warrant provider generation. It is pure: packet + analysis in, an admission verdict out — no I/O,
 * no provider, no display strings, no LLM.
 *
 * Lens selection (todayMirrorLens) and generation admission are intentionally SEPARATE:
 *   - selectMirrorLens: which lens best describes the evidence (may be a low-confidence fallback).
 *   - admitTodayMirrorGeneration: may we generate a personalized mirror from it at all.
 */
import type {
  MirrorLens,
  PacketConfidence,
  TodayMirrorAnalysis,
  TodayMirrorEvidencePacket,
} from "@/domain/daily/todayMirror.types";

export type IneligibleReason =
  | "INSUFFICIENT_EVIDENCE"
  | "LOW_CONFIDENCE_RELATIONSHIP_ONLY"
  | "NO_SUBSTANTIVE_SIGNAL"
  | "COMPARISON_IDENTITY_WEAK"
  | "OPEN_CONTRACT_HANDLED_DETERMINISTICALLY"
  | "PROVENANCE_INCOMPLETE";

export type TodayMirrorGenerationAdmission =
  | {
      eligible: true;
      reason: "QUALIFYING_EVIDENCE";
      lens: MirrorLens;
      confidence: "medium" | "high";
      supportingSignalKinds: string[];
    }
  | {
      eligible: false;
      reason: IneligibleReason;
      diagnosticLens: MirrorLens | null;
      confidence: PacketConfidence;
    };

/** Signal codes each provider-eligible lens draws from (mirrors the assembler's emitted codes). */
const LENS_SIGNAL_KINDS: Partial<Record<MirrorLens, string[]>> = {
  reexposure_change: ["REEXPOSURE_CHANGED"],
  repeated_pattern: ["REPEATED_PATTERN"],
  completion_latency: ["LATENCY_SHORTENED"],
  relationship_concentration: ["RELATIONSHIP_CONCENTRATION"],
};

/**
 * Provenance completeness — the SINGLE shared invariant (pilot status + admission both call this,
 * so they can never disagree). A packet is provenance-complete iff EVERY derived signal:
 *   (A) complete references — every supportingEvidenceId resolves to a ConfirmedFact.id, AND
 *   (B) minimum substantive anchoring — has at least one supporting confirmed fact (non-empty).
 * provenanceMarkers (e.g. "outcome:<eventId>") are NOT evidence references and are never resolved
 * here; a marker alone can never satisfy (B).
 */
export function packetProvenanceComplete(packet: TodayMirrorEvidencePacket): boolean {
  const factIds = new Set(packet.confirmedFacts.map((f) => f.id));
  return packet.derivedSignals.every(
    (s) => s.supportingEvidenceIds.length > 0 && s.supportingEvidenceIds.every((id) => factIds.has(id)),
  );
}

/**
 * Decide whether the assembled real evidence qualifies for provider generation. Deterministic and
 * conservative: when in doubt, ineligible (retain the diagnostic lens, do not interpret).
 *
 * @param opts.prohibitedFieldsPresent set by the value-safe layer when a raw/prohibited field is
 *        detected in the packet — forces PROVENANCE_INCOMPLETE (integrity failure).
 */
export function admitTodayMirrorGeneration(
  packet: TodayMirrorEvidencePacket,
  analysis: TodayMirrorAnalysis,
  opts?: { prohibitedFieldsPresent?: boolean },
): TodayMirrorGenerationAdmission {
  const lens = analysis.selectedLens;
  const confidence = analysis.confidence;
  const deny = (reason: IneligibleReason, diagnosticLens: MirrorLens | null = lens): TodayMirrorGenerationAdmission => ({
    eligible: false,
    reason,
    diagnosticLens,
    confidence,
  });

  // ── integrity guards (apply to every lens) ──
  if (opts?.prohibitedFieldsPresent) return deny("PROVENANCE_INCOMPLETE");
  if (!packetProvenanceComplete(packet)) return deny("PROVENANCE_INCOMPLETE");
  if (lens === "insufficient_evidence") return deny("INSUFFICIENT_EVIDENCE", "insufficient_evidence");

  const isMediumOrHigh = confidence === "medium" || confidence === "high";
  const admit = (): TodayMirrorGenerationAdmission => ({
    eligible: true,
    reason: "QUALIFYING_EVIDENCE",
    lens,
    confidence: confidence as "medium" | "high",
    supportingSignalKinds: LENS_SIGNAL_KINDS[lens] ?? [],
  });

  switch (lens) {
    // Substantive evidence signals — eligible only at MEDIUM/HIGH (summary-only LOW never qualifies).
    case "reexposure_change":
    case "repeated_pattern":
      return isMediumOrHigh ? admit() : deny("NO_SUBSTANTIVE_SIGNAL");
    // Completion latency draws on a pattern-family comparison identity; LOW ⇒ identity too weak.
    case "completion_latency":
      return isMediumOrHigh ? admit() : deny("COMPARISON_IDENTITY_WEAK");
    // Relationship concentration is the weakest lens; LOW is the "no data" fallback → never eligible.
    case "relationship_concentration":
      return isMediumOrHigh ? admit() : deny("LOW_CONFIDENCE_RELATIONSHIP_ONLY");
    // An open contract is already deterministic — its wording is preserved, no provider needed.
    case "open_contract_gravity":
      return deny("OPEN_CONTRACT_HANDLED_DETERMINISTICALLY");
    // Recovery re-entry (safety-sensitive) + return_after_miss (held) are handled deterministically.
    case "recovery_reentry":
    case "return_after_miss":
    default:
      return deny("NO_SUBSTANTIVE_SIGNAL");
  }
}
