/**
 * BTY Today Intelligence v1 — deterministic derivation ladder (STEP 7B).
 *
 * Pure domain: gate + evidence signals in, a derived Today brief out. No I/O, no LLM,
 * no display strings. Reality decides → rules derive → (AI may phrase later, not here).
 *
 * LOCKS (Commander):
 *  - No evidence → no interpretation. No axis match → clean fallback (never guess).
 *  - Pending action → preserve continuity (ContinuePending), never a new invented task.
 *  - Never shame missed activity; never expose raw metrics.
 *  - `relationshipFocus` is a CLAIM only when `confidence !== "none"`. When confidence is
 *    "none", the consumer must render neutral / clean-start copy keyed off `fallbackMode`,
 *    NOT the placeholder focus value.
 */
import type { DailyGate } from "@/domain/daily/dailyGate.types";
import { axisToRelationship, axisTokenFromRaw } from "@/domain/daily/axisRelationship";

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
  | "ai_unavailable" // reserved for the future AI phrasing layer; unused in v1 (no LLM contact).
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

/** Recency of the most-recent active pattern axis, relative to the user-day windows. */
export type AxisRecency = "yesterday" | "window";

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
  /** Most-recent active pattern axis + its recency, or null when none/stale. */
  recentAxis?: { axis: string; recency: AxisRecency } | null;
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
 * Yesterday had evidence but no single relationship can be derived (no axis / unknown axis).
 * Evidence exists → NOT a clean start; the consumer renders the neutral mirror.
 */
function unknownAxisWithEvidence(extraReason: string): TodayIntelligence {
  return {
    userState: "scenario_signal",
    relationshipFocus: "CleanStart", // placeholder only — confidence "none" + fallbackMode gate this
    confidence: "none",
    reasonCodes: ["YESTERDAY_EVIDENCE", extraReason],
    fallbackMode: "unknown_axis",
  };
}

/**
 * Derive the Today Intelligence brief. Deterministic, order = the STEP 7B ladder,
 * anchored on the already-computed daily gate (no duplicated gate logic).
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

    // 4 — Evidence yesterday → map the active axis to a relationship, else neutral mirror.
    case "YESTERDAY_MIRROR": {
      if (!input.recentAxis) return unknownAxisWithEvidence("NO_AXIS_SIGNAL");
      const relationship = axisToRelationship(input.recentAxis.axis);
      if (!relationship) return unknownAxisWithEvidence("AXIS_UNKNOWN");
      const token = axisTokenFromRaw(input.recentAxis.axis);
      return {
        userState: "scenario_signal",
        relationshipFocus: relationship,
        confidence: input.recentAxis.recency === "yesterday" ? "high" : "medium",
        reasonCodes: ["YESTERDAY_EVIDENCE", `AXIS_MAPPED_${token}`],
        fallbackMode: "none",
      };
    }

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
