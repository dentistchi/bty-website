/**
 * BTY Today AI Mirror — V0 contract types (shadow-only, non-user-facing).
 *
 * Pure domain: types + value shapes only. No I/O, no display strings, no LLM.
 * The deterministic layer owns facts, provenance, confidence, derived relationship,
 * lens, prohibited claims, and allowed action boundaries. The LLM later owns ONLY
 * concise expression within these constraints (see lib/bty/today-intelligence).
 *
 * Relationship semantics LOCK: Self / Others / World is DERIVED here (never an explicit
 * stored daily choice). A ConfirmedFact/DerivedSignal.relationship is a DERIVATION, and
 * the response layer must never phrase it as an explicit user selection.
 */
import type { Relationship } from "@/domain/daily/axisRelationship";

export type MirrorConfidence = "low" | "medium" | "high";
/** Packet-level confidence; "none" ⇒ insufficient evidence ⇒ restraint / no claim. */
export type PacketConfidence = MirrorConfidence | "none";

/** Deterministic interpretive lenses, in fixed priority order (see selectMirrorLens). */
export type MirrorLens =
  | "reexposure_change"
  | "recovery_reentry"
  | "return_after_miss"
  | "completion_latency"
  | "open_contract_gravity"
  | "repeated_pattern"
  | "relationship_concentration"
  | "insufficient_evidence";

/** A confirmed, provenance-backed event. `relationship` is DERIVED, never an explicit choice. */
export type ConfirmedFact = {
  /** Stable id WITHIN this packet, e.g. "fact:contract_completed:0". */
  id: string;
  /** Machine kind, e.g. "contract_completed" | "contract_missed" | "return_after_gap". */
  kind: string;
  /** ISO-8601 instant, already normalized to the user-day boundary/timezone by the assembler. */
  occurredAt: string;
  source: { tableOrService: string; recordId?: string };
  /** DERIVED relationship (axis/pattern), if any. Never treat as an explicit selection. */
  relationship?: Relationship;
  /** Machine summary code (NOT free user text), e.g. "COMPLETED_VERIFIED". */
  summaryCode: string;
};

/** A deterministic derived signal (a pattern candidate), with provenance + confidence. */
export type DerivedSignal = {
  /** Machine code, e.g. "LATENCY_SHORTENED" | "RELATIONSHIP_CONCENTRATION" | "REEXPOSURE_CHANGED". */
  code: string;
  relationship?: Relationship;
  confidence: MirrorConfidence;
  /** ConfirmedFact ids that support this signal. EVERY id MUST resolve to a ConfirmedFact.id. */
  supportingEvidenceIds: string[];
  /**
   * Opaque provenance/derivation markers (e.g. "outcome:<eventId>" comparison pointers) that
   * DESCRIBE how the signal was derived but are NOT independent evidence facts. They are never
   * resolved against confirmedFacts and never count toward evidence-anchor sufficiency.
   */
  provenanceMarkers?: string[];
};

/**
 * Reference to the user's OPEN action contract. Never carries the raw action_text
 * (the user's promise, rendered verbatim elsewhere) — only an opaque reference/fingerprint.
 */
export type OpenContractRef = {
  id: string;
  actionTextReference: string;
  deadlineAt?: string;
};

export type TodayMirrorEvidencePacket = {
  userDay: { date: string; timezone: string; boundaryHour: number };
  confirmedFacts: ConfirmedFact[];
  derivedSignals: DerivedSignal[];
  openContract: OpenContractRef | null;
  /** Machine codes for what CANNOT be interpreted (drives restraint), e.g. "NO_RELATIONSHIP". */
  insufficientEvidence: string[];
  /** Machine codes of claims the response must never make. */
  prohibitedClaims: string[];
  /** Lenses the evidence can actually support (selectMirrorLens picks within this set). */
  allowedLenses: MirrorLens[];
  confidence: PacketConfidence;
};

/** Deterministic analysis plan produced BEFORE any LLM call. */
export type TodayMirrorAnalysis = {
  selectedLens: MirrorLens;
  /** Machine observation codes the response may express (nothing else). */
  supportedObservationCodes: string[];
  supportingEvidenceIds: string[];
  relationship?: Relationship;
  confidence: PacketConfidence;
  /** Machine interpretation codes permitted for the perspective. */
  allowedInterpretations: string[];
  prohibitedInterpretations: string[];
  /** e.g. "reach_out" | "begin_earlier" | "name_the_issue" | "return" | "none". */
  allowedActionTypes: string[];
  /** When true, an open contract exists → suggestedStep MUST be null (no duplication). */
  mustAvoidContractDuplication: boolean;
};

export type SuggestedStep = {
  text: string;
  observableCompletion: string;
  timeWindow: string | null;
};

export type TodayMirrorResponse = {
  mirror: string;
  perspective: string;
  suggestedStep: SuggestedStep | null;
  uncertaintyNote: string | null;
  lens: MirrorLens;
  evidenceIds: string[];
  noveltySignature: string;
};

/** Fixture-based recent-output context for novelty control (no DB table in V0). */
export type RecentTodayMirrorContext = {
  recentLenses: MirrorLens[];
  recentOpeningPatterns: string[];
  recentActionVerbs: string[];
  recentRecommendations: string[];
  recentNoveltySignatures: string[];
};

export const EMPTY_RECENT_CONTEXT: RecentTodayMirrorContext = {
  recentLenses: [],
  recentOpeningPatterns: [],
  recentActionVerbs: [],
  recentRecommendations: [],
  recentNoveltySignatures: [],
};
