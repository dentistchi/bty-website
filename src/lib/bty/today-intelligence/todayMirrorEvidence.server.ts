/**
 * BTY Today AI Mirror — evidence packet assembler (service layer, shadow-only).
 *
 * V1: wires the deterministic signals whose comparison identity is establishable —
 * reexposure_change, repeated_pattern, completion_latency (guarded to non-null pattern_family) —
 * via narrow read-only readers + pure adapters (src/domain/daily/todayMirrorSignals). Signal
 * outputs are merged, then combined with the existing Today-Intelligence context (open contract,
 * recovery re-entry, relationship concentration). Lens priority resolves conflicts; the open-
 * contract invariant is preserved. return_after_miss is NOT wired (no deterministic linkage
 * column exists in the schema — see audit); it stays held.
 *
 * Read-only + fail-soft. Never logs the raw packet. No raw action_text / user free text is read.
 * NOT attached to any route or UI. Dependency-injectable so shadow/tests need no production DB.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTodayIntelligence } from "@/lib/bty/daily/todayIntelligence.server";
import { userDayKey } from "@/domain/daily/userDayKey";
import type { Relationship } from "@/domain/daily/axisRelationship";
import type { TodayIntelligence } from "@/domain/daily/todayIntelligence";
import type {
  DerivedSignal,
  MirrorConfidence,
  MirrorLens,
  PacketConfidence,
  TodayMirrorEvidencePacket,
} from "@/domain/daily/todayMirror.types";
import {
  deriveCompletionLatency,
  deriveReexposureChange,
  deriveRepeatedPattern,
  mergeSignalOutputs,
  type NormalizedCompletion,
  type NormalizedReexposure,
  type NormalizedRepeated,
} from "@/domain/daily/todayMirrorSignals";

const RELATIONSHIP_FOCUS = new Set<Relationship>(["Self", "Others", "World"]);
const PROHIBITED_CLAIMS = ["EXPLICIT_RELATIONSHIP_CHOICE", "MOTIVE_CERTAINTY", "HIDDEN_METRICS", "COERCIVE_CONFRONTATION"];

/** Signal inputs (already normalized/windowed). Injectable so shadow/tests skip the DB. */
export type TodayMirrorSignalInputs = {
  completions?: NormalizedCompletion[];
  reexposure?: NormalizedReexposure | null;
  repeated?: NormalizedRepeated | null;
};

/**
 * The user-day frame for the packet. `timezone` is EXPLICIT — no hardcoded pilot-path default.
 * Generic/non-pilot callers omit it and take the documented "UTC" fallback; the pilot path passes
 * the validated configured timezone so userDayStartInstant + the 7/28-day recency windows are
 * computed on the user's real 05:00 boundary (see deriveCompletionLatency recency below).
 */
function baseUserDay(now: Date, timezone: string) {
  return { date: userDayKey(now, timezone, 5), timezone, boundaryHour: 5 };
}

// ── narrow read-only readers (fail-soft; select only comparison columns, never raw text) ──
// Exported so the pilot read-only harness can build the SAME user-scoped readers off a
// read-only client wrapper without duplicating the query shape (each .eq("user_id", …)).

export async function readCompletionsForLatency(supabase: SupabaseClient, userId: string): Promise<NormalizedCompletion[]> {
  try {
    const { data } = await supabase
      .from("bty_action_contracts")
      .select("id, pattern_family, chosen_at, verified_at")
      .eq("user_id", userId)
      .eq("status", "approved")
      .not("verified_at", "is", null)
      .not("chosen_at", "is", null)
      .not("pattern_family", "is", null)
      .order("verified_at", { ascending: false })
      .limit(12);
    return (data ?? []).map((r) => {
      const row = r as { id: string; pattern_family: string | null; chosen_at: string | null; verified_at: string | null };
      return { id: String(row.id), patternFamily: row.pattern_family, chosenAt: row.chosen_at, verifiedAt: row.verified_at, userId };
    });
  } catch {
    return [];
  }
}

export async function readTopSignature(supabase: SupabaseClient, userId: string): Promise<{ reexposure: NormalizedReexposure | null; repeated: NormalizedRepeated | null }> {
  try {
    const { data } = await supabase
      .from("user_pattern_signatures")
      .select("id, pattern_family, axis, repeat_count, last_validation_result, confidence_score, last_seen_at")
      .eq("user_id", userId)
      .in("current_state", ["active", "unstable"])
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { reexposure: null, repeated: null };
    const row = data as { id: string; pattern_family: string | null; axis: string | null; repeat_count: number | null; last_validation_result: "changed" | "no_change" | "unstable" | null; confidence_score: number | null; last_seen_at: string };
    const reexposure: NormalizedReexposure = {
      signatureId: String(row.id), patternFamily: row.pattern_family, axis: row.axis, repeatCount: row.repeat_count,
      lastValidationResult: row.last_validation_result, confidenceScore: row.confidence_score, lastSeenAt: row.last_seen_at,
    };
    const repeated: NormalizedRepeated = {
      patternKey: String(row.id), patternFamily: row.pattern_family, repeatCount: row.repeat_count,
      consecutiveCount: null, totalCount: null, familyWindowTally: null, lastSeenAt: row.last_seen_at,
    };
    return { reexposure, repeated };
  } catch {
    return { reexposure: null, repeated: null };
  }
}

async function gatherSignalInputs(supabase: SupabaseClient, userId: string): Promise<TodayMirrorSignalInputs> {
  const [completions, sig] = await Promise.all([readCompletionsForLatency(supabase, userId), readTopSignature(supabase, userId)]);
  return { completions, reexposure: sig.reexposure, repeated: sig.repeated };
}

/**
 * Assemble the V1 evidence packet. Read-only + fail-soft. Combines wired signals with the
 * Today-Intelligence context and lets lens priority + the open-contract invariant resolve conflicts.
 */
export async function assembleTodayMirrorPacket(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
  injected?: TodayMirrorSignalInputs,
  options?: {
    /** Explicit user timezone. Omitted → documented "UTC" fallback (non-pilot callers). */
    timezone?: string;
    /** Pre-fetched brief. When supplied WITH `injected`, the client is never touched (pilot path). */
    brief?: TodayIntelligence;
  },
): Promise<TodayMirrorEvidencePacket> {
  const timezone = options?.timezone ?? "UTC";
  const userDay = baseUserDay(now, timezone);
  const insufficient = (codes: string[]): TodayMirrorEvidencePacket => ({
    userDay, confirmedFacts: [], derivedSignals: [], openContract: null,
    insufficientEvidence: codes, prohibitedClaims: PROHIBITED_CLAIMS,
    allowedLenses: ["recovery_reentry", "open_contract_gravity", "relationship_concentration"], confidence: "none",
  });

  try {
    const inputs = injected ?? (await gatherSignalInputs(supabase, userId));
    // Recency window uses the 05:00 BTY user-day boundary in the EXPLICIT timezone (pilot path
    // passes the configured tz; generic callers fall back to the documented "UTC").
    const merged = mergeSignalOutputs([
      deriveCompletionLatency(inputs.completions ?? [], userId, { now, tz: timezone }),
      inputs.reexposure ? deriveReexposureChange(inputs.reexposure) : { facts: [], signals: [], insufficientEvidence: [], allowedNumericClaims: [] },
      inputs.repeated ? deriveRepeatedPattern(inputs.repeated) : { facts: [], signals: [], insufficientEvidence: [], allowedNumericClaims: [] },
    ]);

    // Injected brief (pilot read-only path) short-circuits the client entirely. When both `injected`
    // signal inputs AND `options.brief` are supplied, this function issues ZERO queries.
    const brief = options?.brief ?? (await buildTodayIntelligence(supabase, userId, now));
    const briefConfidence = brief.confidence as PacketConfidence;

    // Brief-derived context (unchanged sources): open contract, recovery, relationship concentration.
    const openContract =
      brief.relationshipFocus === "ContinuePending" || brief.userState === "pending_action"
        ? { id: "open", actionTextReference: `open:${brief.reasonCodes.join(",")}` }
        : null;

    const contextFacts = [...merged.facts];
    const contextSignals = [...merged.signals];

    if (brief.reasonCodes.includes("FORCED_RESET_OPEN")) {
      const id = "fact:recovery_reentry:0";
      contextFacts.push({ id, kind: "recovery_reentry", occurredAt: now.toISOString(), source: { tableOrService: "leadership_engine_state" }, summaryCode: "FORCED_RESET_REENTRY" });
      contextSignals.push({ code: "RECOVERY_REENTRY", confidence: (briefConfidence === "none" ? "medium" : briefConfidence) as MirrorConfidence, supportingEvidenceIds: [id] });
    }
    if (RELATIONSHIP_FOCUS.has(brief.relationshipFocus as Relationship) && briefConfidence !== "none") {
      const relationship = brief.relationshipFocus as Relationship;
      const id = "fact:relationship_concentration:0";
      contextFacts.push({ id, kind: "yesterday_activity", occurredAt: now.toISOString(), source: { tableOrService: "today-intelligence" }, relationship, summaryCode: brief.reasonCodes.join(",") });
      contextSignals.push({ code: "RELATIONSHIP_CONCENTRATION", relationship, confidence: briefConfidence as MirrorConfidence, supportingEvidenceIds: [id] });
    }

    if (contextSignals.length === 0 && !openContract) {
      return insufficient([...merged.insufficientEvidence, ...(brief.reasonCodes.length ? brief.reasonCodes : ["NO_EVIDENCE"])]);
    }

    // Allowed lenses = every present signal's lens (+ open_contract_gravity when a promise is open).
    const lensOf: Record<string, MirrorLens> = {
      REEXPOSURE_CHANGED: "reexposure_change", RECOVERY_REENTRY: "recovery_reentry", RETURN_AFTER_MISS: "return_after_miss",
      LATENCY_SHORTENED: "completion_latency", REPEATED_PATTERN: "repeated_pattern", RELATIONSHIP_CONCENTRATION: "relationship_concentration",
    };
    const allowedLenses = Array.from(
      new Set([...contextSignals.map((s) => lensOf[s.code]).filter(Boolean), ...(openContract ? (["open_contract_gravity"] as MirrorLens[]) : [])]),
    ) as MirrorLens[];

    const rank = { low: 0, medium: 1, high: 2 } as const;
    let confidence: PacketConfidence = openContract ? "high" : "none";
    for (const s of contextSignals) if (confidence === "none" || rank[s.confidence] > rank[confidence as MirrorConfidence]) confidence = s.confidence;

    return {
      userDay,
      confirmedFacts: contextFacts,
      derivedSignals: contextSignals,
      openContract,
      insufficientEvidence: merged.insufficientEvidence,
      prohibitedClaims: PROHIBITED_CLAIMS,
      allowedLenses: allowedLenses.length ? allowedLenses : ["open_contract_gravity"],
      confidence,
    };
  } catch {
    return insufficient(["READ_ERROR"]);
  }
}
