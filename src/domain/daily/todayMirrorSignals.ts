/**
 * BTY Today AI Mirror — deterministic signal adapters (pure domain, shadow-only).
 *
 * Each adapter takes ALREADY-NORMALIZED, ALREADY-WINDOWED repository rows (the server reader
 * applies the 05:00 user-day window and strips raw text) and returns evidence with precise
 * provenance. No I/O, no raw user text, no hidden metrics. A signal is emitted ONLY when a valid
 * comparison identity is proven — an unsupported signal is preferable to a false one.
 *
 * Source-reality verdicts (audit): reexposure_change + repeated_pattern have strong single-row
 * identities; completion_latency is guarded (pattern_family must be non-null); return_after_miss
 * has NO deterministic linkage column in the schema and is therefore held (emitted only when an
 * EXPLICIT linkage key is supplied, which the current repository cannot provide).
 */
import type { Relationship } from "@/domain/daily/axisRelationship";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import type {
  ConfirmedFact,
  DerivedSignal,
  MirrorConfidence,
  MirrorLens,
  PacketConfidence,
} from "@/domain/daily/todayMirror.types";

/** Structurally identical to the validator's AllowedNumericClaim (kept domain-pure). */
export type SignalNumericClaim = { value: number; kind: string; evidenceIds: string[] };

export type SignalOutput = {
  facts: ConfirmedFact[];
  signals: DerivedSignal[];
  insufficientEvidence: string[];
  allowedNumericClaims: SignalNumericClaim[];
};

const EMPTY: SignalOutput = { facts: [], signals: [], insufficientEvidence: [], allowedNumericClaims: [] };

function out(over: Partial<SignalOutput>): SignalOutput {
  return { ...EMPTY, ...over };
}

// ───────────────────────────── completion_latency (GUARDED) ─────────────────────────

export type NormalizedCompletion = {
  id: string;
  patternFamily: string | null;
  chosenAt: string | null; // ISO
  verifiedAt: string | null; // ISO (status = approved)
  relationship?: Relationship;
  userId?: string; // for cross-user rejection in tests
};

function ms(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

/** BTY user-day age (number of 05:00 boundaries between an event and now). */
function userDayAge(eventIso: string, now: Date, tz: string): number {
  const eventStart = userDayStartInstant(new Date(eventIso), tz, 5).getTime();
  const nowStart = userDayStartInstant(now, tz, 5).getTime();
  return Math.round((nowStart - eventStart) / 86_400_000);
}

/**
 * completion_latency = the CHOICE→VERIFIED-COMPLETION interval (chosen_at → verified_at) closing
 * faster for the later comparable action. This is NOT recognition-to-start / reaction speed /
 * "began sooner". Emit only when two APPROVED contracts share the SAME non-null pattern_family,
 * the later interval is strictly shorter, and (when a recency window is given) the latest event is
 * within 7 BTY user-days and the previous within 28. Confidence caps at MEDIUM for pattern_family-
 * only identity (HIGH would require a stronger shared identity, absent in V1).
 */
export function deriveCompletionLatency(
  actions: NormalizedCompletion[],
  expectedUserId?: string,
  recency?: { now: Date; tz: string },
): SignalOutput {
  const usable = actions.filter(
    (a) =>
      a.chosenAt &&
      a.verifiedAt &&
      a.patternFamily != null &&
      a.patternFamily !== "" &&
      Number.isFinite(ms(a.chosenAt)) &&
      Number.isFinite(ms(a.verifiedAt)) &&
      (expectedUserId == null || a.userId == null || a.userId === expectedUserId),
  );
  if (usable.length < 2) return out({ insufficientEvidence: ["LATENCY_INSUFFICIENT_COMPARABLE"] });

  // Group by pattern_family; choose the family whose newest pair is most recent.
  const byFamily = new Map<string, NormalizedCompletion[]>();
  for (const a of usable) {
    const k = a.patternFamily as string;
    (byFamily.get(k) ?? byFamily.set(k, []).get(k)!).push(a);
  }
  const families = [...byFamily.values()].filter((g) => g.length >= 2);
  if (families.length === 0) return out({ insufficientEvidence: ["LATENCY_NO_SAME_FAMILY_PAIR"] });

  families.forEach((g) => g.sort((x, y) => ms(x.verifiedAt!) - ms(y.verifiedAt!)));
  families.sort((a, b) => ms(b[b.length - 1].verifiedAt!) - ms(a[a.length - 1].verifiedAt!));
  const group = families[0];
  const curr = group[group.length - 1];
  const prev = group[group.length - 2];
  const currLatency = ms(curr.verifiedAt!) - ms(curr.chosenAt!);
  const prevLatency = ms(prev.verifiedAt!) - ms(prev.chosenAt!);

  const fPrev: ConfirmedFact = {
    id: `contract:completed:${prev.id}`,
    kind: "ACTION_COMPLETED",
    occurredAt: prev.verifiedAt!,
    source: { tableOrService: "action-contract-reader", recordId: prev.id },
    relationship: prev.relationship,
    summaryCode: "ACTION_COMPLETED_VERIFIED",
  };
  const fCurr: ConfirmedFact = {
    id: `contract:completed:${curr.id}`,
    kind: "ACTION_COMPLETED",
    occurredAt: curr.verifiedAt!,
    source: { tableOrService: "action-contract-reader", recordId: curr.id },
    relationship: curr.relationship,
    summaryCode: "ACTION_COMPLETED_VERIFIED",
  };

  if (!(currLatency < prevLatency)) {
    // longer or unchanged → V0 does not surface (no "you got slower" lens).
    return out({ facts: [fPrev, fCurr], insufficientEvidence: ["LATENCY_NOT_SHORTER"] });
  }
  // BTY user-day recency window (05:00 boundary): latest within 7, previous within 28 user-days.
  if (recency) {
    const currAge = userDayAge(curr.verifiedAt!, recency.now, recency.tz);
    const prevAge = userDayAge(prev.verifiedAt!, recency.now, recency.tz);
    if (currAge > 7 || prevAge > 28) {
      return out({ facts: [fPrev, fCurr], insufficientEvidence: ["LATENCY_OUTSIDE_RECENCY_WINDOW"] });
    }
  }
  const signal: DerivedSignal = {
    code: "LATENCY_SHORTENED",
    relationship: curr.relationship,
    // pattern_family-only identity → MEDIUM (HIGH requires a stronger shared identity, absent in V1).
    confidence: "medium",
    supportingEvidenceIds: [fPrev.id, fCurr.id],
  };
  return out({ facts: [fPrev, fCurr], signals: [signal] });
}

// ───────────────────────────── reexposure_change (AVAILABLE) ────────────────────────

export type NormalizedReexposure = {
  signatureId: string; // opaque provenance id (user_pattern_signatures row)
  patternFamily: string | null;
  axis: string | null;
  repeatCount: number | null;
  lastValidationResult: "changed" | "no_change" | "unstable" | null;
  confidenceScore: number | null;
  lastSeenAt: string;
  relationship?: Relationship;
  priorEventId?: string;
  laterEventId?: string;
};

/**
 * Emit REEXPOSURE_CHANGED only when the exposure identity (pattern_family+axis) has repeat_count>=2
 * AND the stored last_validation_result is "changed". no_change / unstable / <2 → no change signal
 * (honest restraint; no progress language). Only CHANGED enables BEHAVIOR_CONTRAST downstream.
 */
export function deriveReexposureChange(input: NormalizedReexposure): SignalOutput {
  if (input.patternFamily == null || input.patternFamily === "") {
    return out({ insufficientEvidence: ["REEXPOSURE_NO_IDENTITY"] });
  }
  if ((input.repeatCount ?? 0) < 2) {
    return out({ insufficientEvidence: ["REEXPOSURE_SINGLE_EXPOSURE"] });
  }
  const fact: ConfirmedFact = {
    id: `signature:${input.signatureId}`,
    kind: "REEXPOSURE",
    occurredAt: input.lastSeenAt,
    source: { tableOrService: "pattern-signature-reader", recordId: input.signatureId },
    relationship: input.relationship,
    summaryCode: `REEXPOSURE_${(input.lastValidationResult ?? "unknown").toUpperCase()}`,
  };
  const supporting = [fact.id];
  if (input.laterEventId) supporting.push(`outcome:${input.laterEventId}`);

  if (input.lastValidationResult === "changed") {
    // HIGH requires traceable comparison provenance (both exposure events). confidence_score alone
    // does NOT replace it — cap at MEDIUM and record the missing comparison event (§11).
    const hasComparisonProvenance = Boolean(input.priorEventId && input.laterEventId);
    const conf: MirrorConfidence =
      hasComparisonProvenance && (input.confidenceScore ?? 0) >= 0.66 ? "high" : "medium";
    return out({
      facts: [fact],
      signals: [{ code: "REEXPOSURE_CHANGED", relationship: input.relationship, confidence: conf, supportingEvidenceIds: supporting }],
      insufficientEvidence: hasComparisonProvenance ? [] : ["REEXPOSURE_NO_COMPARISON_EVENT"],
    });
  }
  // no_change / unstable → not a change; leave recurrence to repeated_pattern; restraint here.
  return out({
    facts: [fact],
    insufficientEvidence: [input.lastValidationResult === "no_change" ? "REEXPOSURE_NO_CHANGE" : "REEXPOSURE_UNSTABLE_OR_UNKNOWN"],
  });
}

// ───────────────────────────── repeated_pattern (AVAILABLE) ─────────────────────────

export type NormalizedRepeated = {
  patternKey: string; // opaque (pattern_family or pattern_key)
  patternFamily: string | null;
  repeatCount: number | null;
  consecutiveCount: number | null;
  totalCount: number | null;
  familyWindowTally: number | null;
  occurrences?: { id: string; occurredAt: string }[]; // event-backed (pattern_signals) — strongest
  relationship?: Relationship;
  lastSeenAt: string;
};

/**
 * Emit REPEATED_PATTERN when the same pattern identity recurred >=2 times. Event-backed
 * occurrences (>=2) → high confidence; summary-scalar only → low confidence + insufficiency note
 * (counts prohibited). One occurrence → no recurrence claim.
 */
export function deriveRepeatedPattern(input: NormalizedRepeated): SignalOutput {
  if (input.patternFamily == null || input.patternFamily === "") {
    return out({ insufficientEvidence: ["REPEATED_NO_IDENTITY"] });
  }
  const events = input.occurrences ?? [];
  const scalar = Math.max(
    input.repeatCount ?? 0,
    input.consecutiveCount ?? 0,
    input.totalCount ?? 0,
    Math.floor(input.familyWindowTally ?? 0),
  );
  const recurred = events.length >= 2 || scalar >= 2;
  if (!recurred) return out({ insufficientEvidence: ["REPEATED_SINGLE_OCCURRENCE"] });

  if (events.length >= 2) {
    const facts: ConfirmedFact[] = events.slice(-2).map((e) => ({
      id: `pattern-event:${e.id}`,
      kind: "PATTERN_OCCURRENCE",
      occurredAt: e.occurredAt,
      source: { tableOrService: "pattern-signals-reader", recordId: e.id },
      relationship: input.relationship,
      summaryCode: "PATTERN_RECURRED",
    }));
    return out({
      facts,
      signals: [{ code: "REPEATED_PATTERN", relationship: input.relationship, confidence: "high", supportingEvidenceIds: facts.map((f) => f.id) }],
    });
  }
  // Summary-scalar only → recurrence supported but weak; prohibit counts.
  const fact: ConfirmedFact = {
    id: `pattern-state:${input.patternKey}`,
    kind: "PATTERN_STATE",
    occurredAt: input.lastSeenAt,
    source: { tableOrService: "pattern-state-reader", recordId: input.patternKey },
    relationship: input.relationship,
    summaryCode: "PATTERN_RECURRED_SUMMARY",
  };
  return out({
    facts: [fact],
    signals: [{ code: "REPEATED_PATTERN", relationship: input.relationship, confidence: "low", supportingEvidenceIds: [fact.id] }],
    insufficientEvidence: ["REPEATED_SUMMARY_ONLY_NO_EVENTS"],
  });
}

// ───────────────────────────── return_after_miss (HELD) ─────────────────────────────

export type NormalizedMiss = { id: string; occurredAt: string; linkageKey?: string; patternFamily: string | null };
export type NormalizedReturn = { id: string; occurredAt: string; linkageKey?: string; patternFamily: string | null; verified: boolean };

/**
 * Return-after-miss requires a deterministic linkage between a specific miss and its return.
 * The repository has NO such linkage column (no recovery-task/forced-reset/contract FK ties a miss
 * to its return; pattern_family + temporal ordering "asserts nothing about recovering THAT miss").
 * So a signal is emitted ONLY when an EXPLICIT shared linkageKey is supplied — which the current
 * server reader cannot provide. Otherwise: held (insufficientEvidence), never a false signal.
 */
export function deriveReturnAfterMiss(misses: NormalizedMiss[], returns: NormalizedReturn[]): SignalOutput {
  for (const r of returns) {
    if (!r.verified || !r.linkageKey) continue;
    const miss = misses.find((m) => m.linkageKey && m.linkageKey === r.linkageKey && ms(m.occurredAt) < ms(r.occurredAt));
    if (!miss) continue;
    const fMiss: ConfirmedFact = {
      id: `contract:missed:${miss.id}`,
      kind: "ACTION_MISSED",
      occurredAt: miss.occurredAt,
      source: { tableOrService: "action-contract-reader", recordId: miss.id },
      summaryCode: "ACTION_MISSED",
    };
    const fRet: ConfirmedFact = {
      id: `contract:return:${r.id}`,
      kind: "ACTION_RETURN",
      occurredAt: r.occurredAt,
      source: { tableOrService: "action-contract-reader", recordId: r.id },
      summaryCode: "ACTION_RETURN_VERIFIED",
    };
    return out({
      facts: [fMiss, fRet],
      signals: [{ code: "RETURN_AFTER_MISS", confidence: "medium", supportingEvidenceIds: [fMiss.id, fRet.id] }],
    });
  }
  // No explicit linkage available (the repository reality) → do not fabricate a return.
  return out({ insufficientEvidence: ["RETURN_LINKAGE_UNAVAILABLE"] });
}

// ───────────────────────────── merge (pure orchestration) ──────────────────────────

const SIGNAL_TO_LENS: Record<string, MirrorLens> = {
  REEXPOSURE_CHANGED: "reexposure_change",
  RECOVERY_REENTRY: "recovery_reentry",
  RETURN_AFTER_MISS: "return_after_miss",
  LATENCY_SHORTENED: "completion_latency",
  REPEATED_PATTERN: "repeated_pattern",
  RELATIONSHIP_CONCENTRATION: "relationship_concentration",
};
const CONF_RANK = { low: 0, medium: 1, high: 2 } as const;

export type MergedSignalEvidence = {
  facts: ConfirmedFact[];
  signals: DerivedSignal[];
  insufficientEvidence: string[];
  allowedNumericClaims: SignalNumericClaim[];
  allowedLenses: MirrorLens[];
  confidence: PacketConfidence;
  relationship?: Relationship;
};

/** Merge signal-adapter outputs into packet-ready evidence (dedup facts; lenses from signals). */
export function mergeSignalOutputs(outputs: SignalOutput[]): MergedSignalEvidence {
  const factById = new Map<string, ConfirmedFact>();
  const signals: DerivedSignal[] = [];
  const insufficient: string[] = [];
  const numeric: SignalNumericClaim[] = [];
  for (const o of outputs) {
    for (const f of o.facts) if (!factById.has(f.id)) factById.set(f.id, f);
    signals.push(...o.signals);
    insufficient.push(...o.insufficientEvidence);
    numeric.push(...o.allowedNumericClaims);
  }
  const lenses = Array.from(new Set(signals.map((s) => SIGNAL_TO_LENS[s.code]).filter(Boolean))) as MirrorLens[];
  let best: MirrorConfidence | "none" = "none";
  for (const s of signals) if (best === "none" || CONF_RANK[s.confidence] > CONF_RANK[best]) best = s.confidence;
  const relationship = signals.find((s) => s.relationship)?.relationship;
  return {
    facts: [...factById.values()],
    signals,
    insufficientEvidence: insufficient,
    allowedNumericClaims: numeric,
    allowedLenses: lenses,
    confidence: best,
    relationship,
  };
}
