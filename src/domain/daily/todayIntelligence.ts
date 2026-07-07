/**
 * BTY Today Intelligence — deterministic derivation ladder (STEP 7L).
 *
 * Pure domain: gate + same-window evidence candidates in, a derived Today brief out.
 * No I/O, no LLM, no display strings. Reality decides → rules derive → (AI phrases later).
 *
 * LOCKS (Commander):
 *  - Gate and brief must derive from the SAME evidence window whenever possible. For a
 *    YESTERDAY_MIRROR day, prefer same-window evidence (verified/pending action, then
 *    scenario/pattern signal); only then fall back to a stale active/unstable signature.
 *  - axis PRIMARY, pattern_family FALLBACK (see {@link resolveRelationship}); never guess.
 *  - Confidence ladder: window verified/pending action = high, window scenario signal =
 *    medium, stale-signature fallback = low, nothing derivable = none.
 *  - `relationshipFocus` is a CLAIM only when `confidence !== "none"`. At "none" the consumer
 *    renders neutral / clean-start copy keyed off `fallbackMode`, not the placeholder focus.
 */
import type { DailyGate } from "@/domain/daily/dailyGate.types";
import { resolveRelationship } from "@/domain/daily/axisRelationship";

export type TodayRelationshipFocus =
  | "Self"
  | "Others"
  | "World"
  | "CleanStart"
  | "ContinuePending";

export type TodayConfidence = "none" | "low" | "medium" | "high";

export type TodayFallbackMode =
  | "none"
  | "no_evidence"
  | "unknown_axis"
  | "ai_unavailable" // reserved for the future AI phrasing layer; unused (no LLM contact).
  | "read_error";

export type TodayUserState =
  | "new_user"
  | "clean_start"
  | "returning_no_yesterday_activity"
  | "pending_action"
  | "missed_action"
  | "verified_action"
  | "scenario_signal"
  | "safe_fallback";

/** An axis/family signal from some evidence source; axis is primary, family is fallback. */
export type AxisCandidate = { axis?: string | null; patternFamily?: string | null };

/** Priority tier of a same-window evidence candidate → maps to the confidence ladder. */
export type WindowEvidenceTier = "verified_action" | "pending_action" | "scenario_signal";

export type WindowEvidenceCandidate = AxisCandidate & { tier: WindowEvidenceTier };

export type TodayIntelligence = {
  userState: TodayUserState;
  relationshipFocus: TodayRelationshipFocus;
  confidence: TodayConfidence;
  reasonCodes: string[];
  fallbackMode: TodayFallbackMode;
};

export type DeriveTodayInput = {
  gate: DailyGate;
  /** Lifecycle status of the blocking contract, when gate === "ACTION_REQUIRED". */
  blockingContractStatus?: string | null;
  /** Same-window evidence, priority-ordered (verified → pending → scenario signal). */
  windowCandidates?: WindowEvidenceCandidate[];
  /** Stale active/unstable pattern signatures, recency-desc — low-confidence fallback only. */
  staleCandidates?: AxisCandidate[];
  /** Set when the read layer failed — Today must still open cleanly. */
  readError?: boolean;
};

const READ_ERROR: TodayIntelligence = {
  userState: "safe_fallback",
  relationshipFocus: "CleanStart",
  confidence: "none",
  reasonCodes: ["READ_ERROR"],
  fallbackMode: "read_error",
};

/** Blocking gates already ARE the one decision card — continuity is preserved. */
function continuePending(reasonCodes: string[]): TodayIntelligence {
  return {
    userState: "pending_action",
    relationshipFocus: "ContinuePending",
    confidence: "high",
    reasonCodes,
    fallbackMode: "none",
  };
}

/** Genuine clean open — no yesterday evidence to interpret. */
function cleanStart(userState: TodayUserState, reasonCode: string): TodayIntelligence {
  return {
    userState,
    relationshipFocus: "CleanStart",
    confidence: "none",
    reasonCodes: [reasonCode],
    fallbackMode: "no_evidence",
  };
}

/**
 * Yesterday had evidence but no single relationship can be derived (no / unknown axis on
 * every candidate). Evidence exists → NOT a clean start; the consumer renders the neutral
 * mirror. `hadCandidates` distinguishes "candidates existed but none derived" (AXIS_UNKNOWN)
 * from "no axis signal at all" (NO_AXIS_SIGNAL).
 */
function unknownAxisWithEvidence(hadCandidates: boolean): TodayIntelligence {
  return {
    userState: "scenario_signal",
    relationshipFocus: "CleanStart", // placeholder — confidence "none" + fallbackMode gate this
    confidence: "none",
    reasonCodes: ["YESTERDAY_EVIDENCE", hadCandidates ? "AXIS_UNKNOWN" : "NO_AXIS_SIGNAL"],
    fallbackMode: "unknown_axis",
  };
}

const TIER_USER_STATE: Record<WindowEvidenceTier, TodayUserState> = {
  verified_action: "verified_action",
  pending_action: "pending_action",
  scenario_signal: "scenario_signal",
};

/**
 * YESTERDAY_MIRROR derivation: same-window evidence first (high/medium), then a stale
 * signature fallback (low), else neutral. Scans candidates in order and returns the FIRST
 * derivable relationship — skipping unknown/unmapped rows rather than stopping at the first.
 */
function deriveFromEvidence(input: DeriveTodayInput): TodayIntelligence {
  const windowCandidates = input.windowCandidates ?? [];
  const staleCandidates = input.staleCandidates ?? [];

  // A/B/C — same-window evidence (the reality that fired the gate).
  for (const c of windowCandidates) {
    const r = resolveRelationship({ axis: c.axis, patternFamily: c.patternFamily });
    if (r) {
      return {
        userState: TIER_USER_STATE[c.tier],
        relationshipFocus: r.relationship,
        confidence: c.tier === "scenario_signal" ? "medium" : "high",
        reasonCodes: ["YESTERDAY_EVIDENCE", `WINDOW_${c.tier.toUpperCase()}`, `VIA_${r.source.toUpperCase()}`],
        fallbackMode: "none",
      };
    }
  }

  // D — stale active/unstable signature fallback (low confidence), never guessed.
  for (const s of staleCandidates) {
    const r = resolveRelationship({ axis: s.axis, patternFamily: s.patternFamily });
    if (r) {
      return {
        userState: "scenario_signal",
        relationshipFocus: r.relationship,
        confidence: "low",
        reasonCodes: ["YESTERDAY_EVIDENCE", "STALE_SIGNATURE", `VIA_${r.source.toUpperCase()}`],
        fallbackMode: "none",
      };
    }
  }

  return unknownAxisWithEvidence(windowCandidates.length > 0 || staleCandidates.length > 0);
}

/**
 * Derive the Today Intelligence brief. Deterministic, anchored on the already-computed
 * daily gate (no duplicated gate logic).
 */
export function deriveTodayIntelligence(input: DeriveTodayInput): TodayIntelligence {
  if (input.readError) return READ_ERROR;

  switch (input.gate) {
    // 1 — Recovery / self re-entry. Center-first is continuity, never shame.
    case "FORCED_RESET":
      return continuePending(["FORCED_RESET_OPEN"]);

    // 2 — Open action loop. `submitted` = awaiting verification; both preserve continuity.
    case "ACTION_REQUIRED": {
      const awaiting = input.blockingContractStatus === "submitted";
      return continuePending([awaiting ? "ACTION_AWAITING_VERIFICATION" : "PENDING_ACTION"]);
    }

    // 3 — Re-exposure due. Unfinished thread from a past choice.
    case "REEXPOSURE_DUE":
      return continuePending(["REEXPOSURE_DUE"]);

    // 4 — Evidence yesterday → derive from the SAME window, else stale fallback, else neutral.
    case "YESTERDAY_MIRROR":
      return deriveFromEvidence(input);

    // 5 — Quiet lately but active in the 14-day window → clean invitation, no fake continuity.
    case "QUIET_INVITATION":
      return cleanStart("returning_no_yesterday_activity", "QUIET_INVITATION");

    // 6 — New user → first-day ritual, no claim.
    case "FIRST_DAY":
      return cleanStart("new_user", "FIRST_DAY");

    // 7 — Established, quiet → the day opens cleanly.
    case "OPEN_DAY":
      return cleanStart("clean_start", "OPEN_DAY");

    default: {
      const _exhaustive: never = input.gate;
      void _exhaustive;
      return READ_ERROR;
    }
  }
}
