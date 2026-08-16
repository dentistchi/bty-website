import type { SupabaseClient } from "@supabase/supabase-js";
import {
  projectEvidence,
  reflectionEstablished,
  type EvidenceProjection,
  type LearnerEvidenceFacts,
} from "@/domain/foundry/events/learner-evidence";
import { requiredLearnerReflection } from "@/domain/foundry/events/foundry-training";
import {
  journeyObservableStandard,
  journeyReflection,
  type RealityGroundedJourneyV1,
} from "@/domain/foundry/module/journey";
import {
  canCheckInAgain,
  reportsApplication,
  type FollowUpOutcome,
  type FollowUpStatus,
} from "@/domain/foundry/followup/followUpObligation";
import { observationEstablished } from "@/domain/foundry/observation/behaviorObservation";
import { deriveSustainedEvidence } from "@/domain/foundry/observation/sustainedEvidence";
import { hasCompletedPracticeForEvent } from "@/lib/bty/foundry/arena/foundryArenaPracticeRunService";
import { listObservations } from "./foundryObservationService";

/**
 * LEARNER EVIDENCE — ASSEMBLY (Slice 3.2R-R1).
 *
 * The seven-rung ladder has existed and been tested since 3.2M-5 and, measured at R0, had ZERO
 * production callers. Nothing read it. This file is the one place that gathers the facts it
 * needs, and `projectEvidence` in the domain is the only place that decides what they mean.
 *
 * THE DERIVATION IS NOT HERE, AND MAY NEVER MOVE HERE. Every rung decision belongs to
 * `establishedEvidence` / `reflectionEstablished` / `deriveSustainedEvidence` /
 * `observationEstablished` / `reportsApplication`. This layer does I/O and hands over booleans.
 * A future edit that writes `if (row.decision_response_text) rungs.push("decided")` here would
 * be creating the second, drifting authority the split exists to prevent.
 *
 * PRIVACY. Three private columns are READ here — `response_text`, `learner_reflection_text` and
 * (Host-visible, but still text) `decision_response_text` — and every one of them is reduced to
 * a boolean on the line it is read. No caller can obtain the text through this module: the only
 * exported shapes carry `EvidenceProjection`, which holds rung names and nothing else. The Host
 * surface that consumes it is therefore not widened by consuming it, and
 * `learnerEvidencePrivacy.test.ts` asserts that over the serialized object rather than trusting
 * this paragraph.
 *
 * UNDER-REPORTING IS THE SAFE DIRECTION. Every source read is fail-soft. A failed read yields
 * `false`, which can only ever REMOVE a rung — it can never fabricate one. Evidence visibility
 * must not be able to take down My Learning or the Host control room, and a missing rung is an
 * honest "not established", which is also what an unestablished rung means.
 *
 * NOTHING IS STORED. No rung column, no cache, no materialized view. Same rule as the domain.
 */

/** One record to project: the completed progress row, its published event, and the learner. */
export type EvidenceRecordKey = {
  /** `foundry_event_training_progress.id` — the canonical per-participant record id. */
  readonly progressId: string;
  readonly eventId: string;
  /**
   * The durable learner identity (`linked_user_id`), or null for an anonymous unclaimed
   * completion. Null is not a defect: with no account, no practice run and no follow-up
   * obligation can belong to this record, so those rungs are genuinely unestablishable.
   */
  readonly userId: string | null;
};

/** The empty projection — what an unknown/failed record honestly establishes. */
const NOTHING_ESTABLISHED: EvidenceProjection = { established: [], highestEstablished: null };

/** No obligations read. A failed/absent read can only ever HIDE a CTA, never invent one. */
const NO_CHECK_IN_ROWS: FollowupRow[] = [];

type ProgressFacts = {
  eventId: string | null;
  completed: boolean;
  hasCompletionResponse: boolean;
  hasLearnerReflection: boolean;
  hasDecision: boolean;
  userId: string | null;
};

const nonEmpty = (v: string | null | undefined): boolean => (v ?? "").trim().length > 0;

/**
 * Load the four per-progress facts. The three text columns are read and DISCARDED in the same
 * expression — `nonEmpty` is the only thing that ever sees them, and the returned shape has no
 * field that could carry a character of learner writing.
 */
async function loadProgressFacts(
  admin: SupabaseClient,
  progressIds: string[],
): Promise<Map<string, ProgressFacts>> {
  const out = new Map<string, ProgressFacts>();
  if (progressIds.length === 0) return out;
  try {
    const { data } = await admin
      .from("foundry_event_training_progress")
      .select("id, event_id, completed_at, response_text, learner_reflection_text, decision_response_text, linked_user_id")
      .in("id", progressIds);
    for (const r of (data ?? []) as Array<{
      id: string;
      event_id: string | null;
      completed_at: string | null;
      response_text: string | null;
      learner_reflection_text: string | null;
      decision_response_text: string | null;
      linked_user_id: string | null;
    }>) {
      out.set(r.id, {
        eventId: r.event_id,
        completed: Boolean(r.completed_at),
        hasCompletionResponse: nonEmpty(r.response_text),
        hasLearnerReflection: nonEmpty(r.learner_reflection_text),
        hasDecision: nonEmpty(r.decision_response_text),
        userId: r.linked_user_id,
      });
    }
  } catch {
    // Fail-soft: an unreadable progress row establishes nothing (never a fabricated rung).
  }
  return out;
}

type EventContract = {
  /** Output of `requiredLearnerReflection` over the FROZEN event — the R8B temporal contract. */
  newReflectionContract: boolean;
  /** The frozen `observable_standard`, or null when the training published none. */
  observableStandard: string | null;
};

/**
 * Resolve each event's REFLECTED contract and observation identity from its own FROZEN snapshot.
 *
 * `requiredLearnerReflection` is the R8B authority and is called here rather than re-derived:
 * whether an event asks a distinct reflection question is a property of what was published to
 * it, so a historical row is always read under the contract it was completed under.
 */
async function loadEventContracts(
  admin: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, EventContract>> {
  const out = new Map<string, EventContract>();
  if (eventIds.length === 0) return out;

  const journeyByEvent = new Map<string, RealityGroundedJourneyV1 | undefined>();
  try {
    const { data } = await admin
      .from("foundry_event_module")
      .select("event_id, module_snapshot")
      .in("event_id", eventIds);
    for (const r of (data ?? []) as Array<{
      event_id: string;
      module_snapshot: { realityGroundedJourneyV1?: RealityGroundedJourneyV1 } | null;
    }>) {
      journeyByEvent.set(r.event_id, r.module_snapshot?.realityGroundedJourneyV1);
    }
  } catch {
    // No snapshot readable → no distinct reflection contract, no observation path.
  }

  // The two questions the reflection must be DISTINCT from live on the content row, whose table
  // depends on the room type. Both are insert-only, so this is as frozen as the snapshot.
  const promptByEvent = new Map<string, { completionPrompt: string | null; sharedQuestion: string | null }>();
  for (const table of ["foundry_event_training_content", "foundry_event_document_content"] as const) {
    try {
      const { data } = await admin
        .from(table)
        .select("event_id, completion_prompt, shared_question")
        .in("event_id", eventIds);
      for (const r of (data ?? []) as Array<{
        event_id: string;
        completion_prompt: string | null;
        shared_question: string | null;
      }>) {
        promptByEvent.set(r.event_id, { completionPrompt: r.completion_prompt, sharedQuestion: r.shared_question });
      }
    } catch {
      // Fail-soft per content type; a room whose content is unreadable keeps the legacy contract.
    }
  }

  for (const eventId of eventIds) {
    const journey = journeyByEvent.get(eventId);
    const prompts = promptByEvent.get(eventId);
    out.set(eventId, {
      newReflectionContract:
        requiredLearnerReflection(
          journeyReflection(journey),
          prompts?.completionPrompt ?? null,
          prompts?.sharedQuestion ?? null,
        ) !== null,
      observableStandard: journeyObservableStandard(journey),
    });
  }
  return out;
}

type FollowupRow = {
  id: string;
  progressId: string;
  followUpDays: number;
  status: FollowUpStatus;
  outcome: FollowUpOutcome | null;
};

/**
 * Every follow-up obligation belonging to these progress rows (7- and 30-day alike).
 *
 * `status` is selected as well as `outcome` (Slice 3.2R-R3-R1) because `canCheckInAgain` is a
 * question about the pair, not about the outcome alone — a null outcome means two different
 * things depending on whether the row has settled.
 */
async function loadFollowups(admin: SupabaseClient, progressIds: string[]): Promise<Map<string, FollowupRow[]>> {
  const out = new Map<string, FollowupRow[]>();
  if (progressIds.length === 0) return out;
  try {
    const { data } = await admin
      .from("foundry_participant_followups")
      .select("id, progress_id, follow_up_days, status, outcome")
      .in("progress_id", progressIds);
    for (const r of (data ?? []) as Array<{
      id: string;
      progress_id: string | null;
      follow_up_days: number;
      status: FollowUpStatus;
      outcome: FollowUpOutcome | null;
    }>) {
      if (!r.progress_id) continue;
      const list = out.get(r.progress_id) ?? [];
      list.push({
        id: r.id,
        progressId: r.progress_id,
        followUpDays: r.follow_up_days,
        status: r.status,
        outcome: r.outcome,
      });
      out.set(r.progress_id, list);
    }
  } catch {
    // Fail-soft: no obligation readable → no APPLIED, no OBSERVED, no SUSTAINED.
  }
  return out;
}

/**
 * Project the evidence for a set of records, keyed by `progressId`.
 *
 * Batched by source (one query per table for the whole set) except the two derivations that are
 * genuinely per-record: the practice check, which is the EXISTING
 * `hasCompletedPracticeForEvent` authority reused verbatim rather than re-implemented, and the
 * observation read, which is `listObservations` per obligation. Both follow the loop shape the
 * Host review surface already uses.
 */
export async function projectEvidenceByProgressId(
  admin: SupabaseClient,
  records: readonly EvidenceRecordKey[],
): Promise<Map<string, EvidenceProjection>> {
  const out = new Map<string, EvidenceProjection>();
  if (records.length === 0) return out;

  const progressIds = [...new Set(records.map((r) => r.progressId).filter(Boolean))];
  const [progressFacts, followupsByProgress] = await Promise.all([
    loadProgressFacts(admin, progressIds),
    loadFollowups(admin, progressIds),
  ]);

  // Event ids come from the stored row where available — the caller's hint is a fallback, never
  // an override: a record's event is a durable fact, not something a caller may assert.
  const eventIds = [
    ...new Set(
      records
        .map((r) => progressFacts.get(r.progressId)?.eventId ?? r.eventId)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const contracts = await loadEventContracts(admin, eventIds);

  // PRACTICED, per distinct (learner, event). Cached across records so a learner with several
  // completions of the same event costs one check, not several.
  const practiceCache = new Map<string, boolean>();
  const practicedFor = async (userId: string | null, eventId: string | null): Promise<boolean> => {
    if (!userId || !eventId) return false; // anonymous / unbound → unestablishable, never false-positive
    const key = `${userId}:${eventId}`;
    const hit = practiceCache.get(key);
    if (hit !== undefined) return hit;
    let value = false;
    try {
      value = await hasCompletedPracticeForEvent(admin, userId, eventId);
    } catch {
      value = false;
    }
    practiceCache.set(key, value);
    return value;
  };

  for (const rec of records) {
    const p = progressFacts.get(rec.progressId);
    if (!p) {
      out.set(rec.progressId, NOTHING_ESTABLISHED);
      continue;
    }
    const eventId = p.eventId ?? rec.eventId ?? null;
    const contract = eventId ? contracts.get(eventId) : undefined;
    const userId = p.userId ?? rec.userId ?? null;

    // REFLECTED is the R8B authority's answer, never a column read — which column establishes it
    // depends on what the frozen event actually asked.
    const reflection = reflectionEstablished({
      newReflectionContract: contract?.newReflectionContract ?? false,
      learnerReflection: p.hasLearnerReflection,
      completionResponse: p.hasCompletionResponse,
    });

    const followups = followupsByProgress.get(rec.progressId) ?? [];
    const appliedReported = followups.some((f) => reportsApplication(f.outcome));

    // OBSERVED and SUSTAINED come from independent attestation only. Both are OR-ed across this
    // record's obligations (a training may carry a 7- and a 30-day checkpoint), and each
    // SUSTAINED derivation is scoped to its OWN obligation's authored window.
    let independentlyObserved = false;
    let sustained = false;
    if (eventId && contract?.observableStandard) {
      for (const f of followups) {
        try {
          const observations = await listObservations(admin, f.id);
          if (observations.length === 0) continue;
          if (observationEstablished(observations)) independentlyObserved = true;
          const temporal = deriveSustainedEvidence(
            observations.map((o) => ({ ...o, eventId })),
            { eventId, observableStandard: contract.observableStandard, followUpDays: f.followUpDays },
          );
          if (temporal.sustained) sustained = true;
        } catch {
          // Fail-soft per obligation — an unreadable attestation set establishes nothing.
        }
      }
    }

    const facts: LearnerEvidenceFacts = {
      completed: p.completed,
      reflection,
      decision: p.hasDecision,
      practiceCompleted: await practicedFor(userId, eventId),
      appliedReported,
      independentlyObserved,
      sustained,
    };
    out.set(rec.progressId, projectEvidence(facts));
  }

  return out;
}

/**
 * A follow-up on this record that can still take a later check-in (Slice 3.2R-R3-R1).
 *
 * IDENTITY IS THE WHOLE POINT. The surface must open the EXACT obligation, so the durable
 * `followupId` travels — never the event, never the title, never the checkpoint used as a key. A
 * record may carry both a 7- and a 30-day obligation, and they are two different questions with
 * two different answers.
 *
 * NO TEXT. An id, a checkpoint number and a settled enum. Nothing the learner wrote.
 */
export type CheckInAgainTarget = {
  readonly followupId: string;
  readonly followUpDays: number;
  /** The answer already on record — what the learner is checking in AGAINST, never erased. */
  readonly outcome: FollowUpOutcome;
};

/** One learner's completed training with what it has actually established since. */
export type MyEvidenceItem = {
  /** The progress-row id — the SAME `entryId` the owner-scoped history surface already uses. */
  readonly entryId: string;
  readonly eventId: string;
  readonly evidence: EvidenceProjection;
  /**
   * Slice 3.2R-R3-R1 — the return route. Empty for every record whose follow-ups are pending,
   * absent, or settled at APPLIED. It is a NAVIGATION target only: nothing here establishes a
   * rung, and `evidence` above is computed from the same rows without consulting it.
   */
  readonly checkInAgain: readonly CheckInAgainTarget[];
};

/**
 * The authenticated learner's own evidence, newest completion first.
 *
 * Owner-scoped by `linked_user_id`, exactly like `listUserFoundryHistory`, and deliberately a
 * SEPARATE read from it: the history projection carries the learner's private writing and is
 * also consumed by the Today brief, which must not pay for evidence assembly. Keeping them apart
 * means this slice adds no I/O to any existing path.
 */
export async function listMyEvidence(admin: SupabaseClient, userId: string): Promise<MyEvidenceItem[]> {
  if (!userId) return [];
  let rows: Array<{ id: string; event_id: string; completed_at: string }> = [];
  try {
    const { data } = await admin
      .from("foundry_event_training_progress")
      .select("id, event_id, completed_at")
      .eq("linked_user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .returns<Array<{ id: string; event_id: string; completed_at: string }>>();
    rows = data ?? [];
  } catch {
    return [];
  }
  if (rows.length === 0) return [];

  const progressIds = rows.map((r) => r.id);
  const [byProgress, followupsByProgress] = await Promise.all([
    projectEvidenceByProgressId(
      admin,
      rows.map((r) => ({ progressId: r.id, eventId: r.event_id, userId })),
    ),
    /*
      A SECOND READ OF THE SAME TABLE, ON PURPOSE (Slice 3.2R-R3-R1).

      `projectEvidenceByProgressId` already loads these rows — and it is also what the HOST
      control room calls. Threading a learner-only navigation target back out of it would widen a
      shared projection so that one caller could use a field the other must never see. The rung
      derivation stays exactly as it was, this read belongs to the learner path alone, and the
      cost is one indexed select over the caller's own completions.
    */
    loadFollowups(admin, progressIds),
  ]);

  return rows.map((r) => ({
    entryId: r.id,
    eventId: r.event_id,
    evidence: byProgress.get(r.id) ?? NOTHING_ESTABLISHED,
    /*
      The domain decides which obligations are still open to a later report — this layer only
      filters by it. Ordered by checkpoint so a record carrying both a 7- and a 30-day follow-up
      renders them in a stable, meaningful order rather than whatever the database returned.
    */
    checkInAgain: (followupsByProgress.get(r.id) ?? NO_CHECK_IN_ROWS)
      .filter((f) => canCheckInAgain(f.status, f.outcome))
      .sort((a, b) => a.followUpDays - b.followUpDays)
      .map((f) => ({
        followupId: f.id,
        followUpDays: f.followUpDays,
        // canCheckInAgain is false for a null outcome, so anything surviving the filter has one.
        outcome: f.outcome as FollowUpOutcome,
      })),
  }));
}
