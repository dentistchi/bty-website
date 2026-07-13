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
import { CONCEPT_FROM_PATTERN_FAMILY, CONCEPTS_FROM_EVIDENCE_CLASS } from "@/domain/daily/livingResponseConcepts";
import {
  evidenceFingerprint,
  type FactConfidence,
  type LivingResponseEvidenceFact,
  type LivingResponsePacket,
  type LivingResponseRelationship,
} from "@/domain/daily/livingResponse";
import { deriveCommitmentFrame } from "@/domain/daily/livingResponseFrame";
import { classifyTrajectory } from "@/domain/daily/livingResponseTrajectory";
import { recentCommitments } from "@/lib/bty/daily/todayRelationshipCommitment.server";
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

async function othersFacts(
  admin: SupabaseClient,
  userId: string,
): Promise<{ facts: LivingResponseEvidenceFact[]; familyConcepts: string[] }> {
  const facts: LivingResponseEvidenceFact[] = [];
  const familyConcepts: string[] = [];

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
      // The specific concept the relational evidence carries (ownership / repair / directness / …),
      // derived from pattern_family — this is what makes the perspective SPECIFIC, not generic.
      for (const r of relational) {
        const concept = r.pattern_family ? CONCEPT_FROM_PATTERN_FAMILY[r.pattern_family] : undefined;
        if (concept && !familyConcepts.includes(concept)) familyConcepts.push(concept);
      }
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

  return { facts, familyConcepts };
}

export async function assembleLivingResponsePacket(
  admin: SupabaseClient,
  userId: string,
  commitment: CommitmentFrame,
  now: Date,
): Promise<LivingResponsePacket> {
  let facts: LivingResponseEvidenceFact[] = [];
  let familyConcepts: string[] = [];
  if (commitment.relationship === "self") facts = await selfFacts(admin, userId, now);
  else if (commitment.relationship === "others") ({ facts, familyConcepts } = await othersFacts(admin, userId));
  // world: no facts assembled (fallback-only in V1).

  // Defense-in-depth: only facts matching the committed relationship survive (admission also checks).
  facts = facts.filter((f) => f.relationship === commitment.relationship && CAP[f.relationship]);

  // Safe behavioral concept anchors: intrinsic (per evidence class) + family-derived (Others action).
  const concepts = new Set<string>();
  for (const f of facts) for (const c of CONCEPTS_FROM_EVIDENCE_CLASS[f.evidenceClass] ?? []) concepts.add(c);
  if (facts.some((f) => f.evidenceClass === "others_verified_relational_action")) for (const c of familyConcepts) concepts.add(c);

  // V2.1: derive the server-owned Commitment Frame from the canonical committed relationship. Never
  // reads any Today Path / Promise text — the relationship value alone determines the frame meaning.
  const commitmentFrame = deriveCommitmentFrame(commitment.relationship);
  if (!commitmentFrame) {
    // Impossible for a validated RelationshipValue, but fail closed rather than fabricate a frame.
    throw new Error("LIVING_RESPONSE_FRAME_UNDERIVABLE");
  }

  // V2.3 Living Continuity — the SHAPE of today's commitment against the recent commitment sequence.
  // Reads ONLY the canonical Today-internal commitment history (machine columns); fail-soft (a degraded
  // read yields [] → first_step → no trajectory expressed). Never touches Arena/Center/Foundry data.
  const history = await recentCommitments(admin, userId, commitment.dayKey);
  const trajectory = classifyTrajectory(commitment.relationship, commitment.dayKey, history);

  return {
    commitmentId: commitment.id,
    userId,
    dayKey: commitment.dayKey,
    relationship: commitment.relationship,
    commitmentFrame,
    facts,
    concepts: [...concepts],
    trajectory,
    prohibitedFieldsPresent: false, // by construction: no raw text/PII column is ever selected
    evidenceFingerprint: evidenceFingerprint(facts, commitmentFrame),
  };
}
