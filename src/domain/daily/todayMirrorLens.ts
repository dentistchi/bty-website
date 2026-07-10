/**
 * BTY Today AI Mirror — deterministic lens selection (pure domain).
 *
 * Lens selection is DETERMINISTIC and evidence-ranked, never random. A more dramatic
 * sentence must never outrank stronger evidence. Priority is fixed (Commander §7, with
 * recovery_reentry placed just below reexposure_change as a compassion-first re-entry):
 *
 *   1 reexposure_change  — a verified change after re-exposure (strongest, earned)
 *   2 recovery_reentry   — return after a forced-reset / recovery (safety-sensitive)
 *   3 return_after_miss  — return after a missed / interrupted action
 *   4 completion_latency — action completion becoming faster
 *   5 open_contract_gravity — an unresolved open contract
 *   6 repeated_pattern   — a repeated, evidence-backed pattern candidate
 *   7 relationship_concentration — derived Self/Others/World concentration
 *   else insufficient_evidence — restraint.
 *
 * A lens is only eligible when (a) its evidence guard holds AND (b) it is in
 * packet.allowedLenses. The assembler owns allowedLenses; this module only ranks.
 */
import type {
  MirrorLens,
  TodayMirrorAnalysis,
  TodayMirrorEvidencePacket,
} from "@/domain/daily/todayMirror.types";

const LENS_PRIORITY: readonly Exclude<MirrorLens, "insufficient_evidence">[] = [
  "reexposure_change",
  "recovery_reentry",
  "return_after_miss",
  "completion_latency",
  "open_contract_gravity",
  "repeated_pattern",
  "relationship_concentration",
] as const;

/** Signal codes each lens is allowed to draw from (assembler emits these codes). */
const LENS_SIGNAL_CODES: Record<
  Exclude<MirrorLens, "insufficient_evidence">,
  readonly string[]
> = {
  reexposure_change: ["REEXPOSURE_CHANGED"],
  recovery_reentry: ["RECOVERY_REENTRY", "FORCED_RESET_REENTRY"],
  return_after_miss: ["RETURN_AFTER_MISS", "RETURN_AFTER_GAP"],
  completion_latency: ["LATENCY_SHORTENED"],
  open_contract_gravity: ["OPEN_CONTRACT"],
  repeated_pattern: ["REPEATED_PATTERN"],
  relationship_concentration: ["RELATIONSHIP_CONCENTRATION"],
};

const ACTION_TYPES_BY_LENS: Record<MirrorLens, readonly string[]> = {
  reexposure_change: ["stay_present", "name_the_issue"],
  recovery_reentry: ["gentle_reentry", "one_small_contact"],
  return_after_miss: ["begin_earlier", "reach_out"],
  completion_latency: ["begin_earlier", "protect_the_window"],
  open_contract_gravity: [], // step must be null — see mustAvoidContractDuplication
  repeated_pattern: ["name_the_issue", "one_small_contact"],
  relationship_concentration: ["reach_out", "name_the_issue"],
  insufficient_evidence: [],
};

function guardHolds(
  lens: Exclude<MirrorLens, "insufficient_evidence">,
  packet: TodayMirrorEvidencePacket,
): boolean {
  if (lens === "open_contract_gravity") return packet.openContract !== null;
  const codes = LENS_SIGNAL_CODES[lens];
  return packet.derivedSignals.some((s) => codes.includes(s.code));
}

function evidenceForLens(
  lens: Exclude<MirrorLens, "insufficient_evidence">,
  packet: TodayMirrorEvidencePacket,
): { ids: string[]; relationship?: TodayMirrorAnalysis["relationship"]; confidence: TodayMirrorAnalysis["confidence"] } {
  if (lens === "open_contract_gravity") {
    const id = packet.openContract ? `contract:${packet.openContract.id}` : "";
    return { ids: id ? [id] : [], confidence: "high" };
  }
  const codes = LENS_SIGNAL_CODES[lens];
  const signals = packet.derivedSignals.filter((s) => codes.includes(s.code));
  const ids = Array.from(
    new Set(signals.flatMap((s) => s.supportingEvidenceIds)),
  );
  // Confidence = strongest supporting signal.
  const rank = { low: 0, medium: 1, high: 2 } as const;
  let best: "low" | "medium" | "high" = "low";
  for (const s of signals) if (rank[s.confidence] > rank[best]) best = s.confidence;
  const relationship = signals.find((s) => s.relationship)?.relationship;
  return { ids, relationship, confidence: best };
}

/**
 * Select the single Today Mirror lens from a packet, deterministically.
 * Returns an analysis plan (never throws). Falls to insufficient_evidence when
 * nothing eligible — the honest-restraint path.
 */
export function selectMirrorLens(
  packet: TodayMirrorEvidencePacket,
): TodayMirrorAnalysis {
  if (packet.confidence !== "none") {
    for (const lens of LENS_PRIORITY) {
      if (!packet.allowedLenses.includes(lens)) continue;
      if (!guardHolds(lens, packet)) continue;
      const ev = evidenceForLens(lens, packet);
      return {
        selectedLens: lens,
        supportedObservationCodes: [lens.toUpperCase()],
        supportingEvidenceIds: ev.ids,
        relationship: ev.relationship,
        confidence: ev.confidence,
        allowedInterpretations: [`INTERP_${lens.toUpperCase()}`],
        prohibitedInterpretations: packet.prohibitedClaims,
        allowedActionTypes: [...ACTION_TYPES_BY_LENS[lens]],
        mustAvoidContractDuplication: packet.openContract !== null,
      };
    }
  }
  // Restraint: no eligible lens or insufficient confidence.
  return {
    selectedLens: "insufficient_evidence",
    supportedObservationCodes: ["INSUFFICIENT_EVIDENCE"],
    supportingEvidenceIds: [],
    relationship: undefined,
    confidence: "none",
    allowedInterpretations: [],
    prohibitedInterpretations: packet.prohibitedClaims,
    allowedActionTypes: [],
    mustAvoidContractDuplication: packet.openContract !== null,
  };
}
