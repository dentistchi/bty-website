/**
 * livingResponseEvidence (server) — assemble a provenance-safe {@link LivingResponsePacket} from
 * canonical sources for the committed relationship. Reads MACHINE columns only (ids, day_keys,
 * pattern_family, verified_at, bands) — NEVER raw text (action_text / letter body / names / emails).
 * Fail-soft: any degraded read contributes no fact (→ fewer facts → deterministic fallback).
 *
 * V1 scope: SELF (return + keep continuity), OTHERS (verified relational action + re-exposure change
 * derived via axisRelationship). WORLD assembles NO facts → admission returns WORLD_FALLBACK_ONLY.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { projectDailyTrace } from "@/lib/bty/daily/dailyTrace.server";
import { inferRelationshipFromPatternFamily, axisToRelationship, type Relationship } from "@/domain/daily/axisRelationship";
import {
  evidenceFingerprint,
  type FactConfidence,
  type LivingResponseEvidenceFact,
  type LivingResponsePacket,
  type LivingResponseRelationship,
} from "@/domain/daily/livingResponse";
import { CENTER_KEEP_MARKER } from "@/lib/bty/center/centerKeepService";

const CAP: Record<LivingResponseRelationship, Relationship> = { self: "Self", others: "Others", world: "World" };

type Band = "emerging" | "steady" | "strong";
function bandOf(count: number): { band: Band; confidence: FactConfidence } {
  if (count >= 4) return { band: "strong", confidence: "high" };
  if (count >= 2) return { band: "steady", confidence: "medium" };
  return { band: "emerging", confidence: "low" };
}

export type CommitmentFrame = { id: string; relationship: LivingResponseRelationship; dayKey: string };

async function selfFacts(admin: SupabaseClient, userId: string, now: Date): Promise<LivingResponseEvidenceFact[]> {
  const facts: LivingResponseEvidenceFact[] = [];

  // return continuity — user_day presence over the recent window (numberless; band only).
  try {
    const { dailyTrace } = await projectDailyTrace(admin, userId, now);
    const presentDates = dailyTrace.filter((p) => p.intensity === 1).map((p) => p.date);
    if (presentDates.length > 0) {
      const { band, confidence } = bandOf(presentDates.length);
      facts.push({
        id: "fact:self_return_continuity",
        code: `SELF_RETURN_${band.toUpperCase()}`,
        relationship: "self",
        evidenceClass: "self_return_continuity",
        confidence,
        provenanceIds: presentDates, // canonical day_keys, not counts/text
      });
    }
  } catch {
    /* fail-soft */
  }

  // keep continuity — Center daily-keep rows over the recent window (ids only; no body).
  try {
    const sinceIso = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const { data } = await admin
      .from("dear_me_letters")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("source", "center")
      .eq("type", "letter")
      .eq("prompt", CENTER_KEEP_MARKER)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(14);
    const rows = (data ?? []) as { id: string; created_at: string }[];
    // distinct calendar dates (coarse continuity proxy) → band; provenance = row ids.
    const distinctDays = new Set(rows.map((r) => r.created_at.slice(0, 10)));
    if (distinctDays.size > 0) {
      const { band, confidence } = bandOf(distinctDays.size);
      facts.push({
        id: "fact:self_keep_continuity",
        code: `SELF_KEEP_${band.toUpperCase()}`,
        relationship: "self",
        evidenceClass: "self_keep_continuity",
        confidence,
        provenanceIds: rows.map((r) => String(r.id)),
      });
    }
  } catch {
    /* fail-soft */
  }

  return facts;
}

async function othersFacts(admin: SupabaseClient, userId: string): Promise<LivingResponseEvidenceFact[]> {
  const facts: LivingResponseEvidenceFact[] = [];

  // verified relational action — approved contracts whose pattern_family DERIVES to Others.
  // (No auto-classification: a contract is Others only if its family→axis→relationship == Others.)
  try {
    const { data } = await admin
      .from("bty_action_contracts")
      .select("id, pattern_family, verified_at")
      .eq("user_id", userId)
      .eq("status", "approved")
      .not("verified_at", "is", null)
      .not("pattern_family", "is", null)
      .order("verified_at", { ascending: false })
      .limit(12);
    const rows = (data ?? []) as { id: string; pattern_family: string | null }[];
    const relational = rows.filter((r) => inferRelationshipFromPatternFamily(r.pattern_family) === "Others");
    if (relational.length > 0) {
      const confidence: FactConfidence = relational.length >= 2 ? "high" : "medium";
      facts.push({
        id: "fact:others_verified_relational_action",
        code: relational.length >= 2 ? "OTHERS_RELATIONAL_STRONG" : "OTHERS_RELATIONAL_PRESENT",
        relationship: "others",
        evidenceClass: "others_verified_relational_action",
        confidence,
        provenanceIds: relational.map((r) => String(r.id)),
      });
    }
  } catch {
    /* fail-soft */
  }

  // re-exposure change — top signature deriving to Others, validated as changed with repetition.
  try {
    const { data } = await admin
      .from("user_pattern_signatures")
      .select("id, pattern_family, axis, repeat_count, last_validation_result")
      .eq("user_id", userId)
      .in("current_state", ["active", "unstable"])
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = data as
      | { id: string; pattern_family: string | null; axis: string | null; repeat_count: number | null; last_validation_result: string | null }
      | null;
    if (row) {
      const rel = axisToRelationship(row.axis) ?? inferRelationshipFromPatternFamily(row.pattern_family);
      const changed = row.last_validation_result === "changed";
      const repeats = row.repeat_count ?? 0;
      if (rel === "Others" && changed && repeats >= 2) {
        facts.push({
          id: "fact:others_reexposure_change",
          code: repeats >= 3 ? "OTHERS_REEXPOSURE_STRONG" : "OTHERS_REEXPOSURE_PRESENT",
          relationship: "others",
          evidenceClass: "others_reexposure_change",
          confidence: repeats >= 3 ? "high" : "medium",
          provenanceIds: [String(row.id)],
        });
      }
    }
  } catch {
    /* fail-soft */
  }

  return facts;
}

export async function assembleLivingResponsePacket(
  admin: SupabaseClient,
  userId: string,
  commitment: CommitmentFrame,
  now: Date,
): Promise<LivingResponsePacket> {
  let facts: LivingResponseEvidenceFact[] = [];
  if (commitment.relationship === "self") facts = await selfFacts(admin, userId, now);
  else if (commitment.relationship === "others") facts = await othersFacts(admin, userId);
  // world: no facts assembled (fallback-only in V1).

  // Defense-in-depth: only facts matching the committed relationship survive (admission also checks).
  facts = facts.filter((f) => f.relationship === commitment.relationship && CAP[f.relationship]);

  return {
    commitmentId: commitment.id,
    userId,
    dayKey: commitment.dayKey,
    relationship: commitment.relationship,
    facts,
    prohibitedFieldsPresent: false, // by construction: no raw text/PII column is ever selected
    evidenceFingerprint: evidenceFingerprint(facts),
  };
}
