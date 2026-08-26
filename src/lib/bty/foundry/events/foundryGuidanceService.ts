import type { SupabaseClient } from "@supabase/supabase-js";
import { isParticipantAccountCompatible, mayAttributeToAccount } from "@/domain/foundry/events/participant-account";
import type { FoundryEventStatus } from "@/domain/foundry/events/foundry-event";
import {
  validateResponse,
  resolveSharedResponse,
  projectManagerRosterStatus,
  projectPublicTrainingStage,
  type ManagerRosterStatus,
  type PublicTrainingStage,
  type TrainingProgressMarkers,
  resolveDecisionResponse,
  requiredLearnerReflection,
  resolveReflectionResponse,
} from "@/domain/foundry/events/foundry-training";
import { readPublishedGuidance, type PublishedGuidanceV1 } from "@/domain/foundry/module/module-publish";
import { readContentType, isGuidanceContentType, type GuidanceContentType } from "@/domain/foundry/events/content-type";
import {
  getOwnerEventSnapshot,
  resolveEventByToken,
  findParticipantBySession,
  type EventRow,
  type ParticipantRow,
} from "./foundryEventService";
import {
  resolvePublic,
  awardTrainingCoreXp,
  outcomeToXpStatus,
  linkLearnerIdentity,
  readEventJourney,
  readEventFollowUpDays,
  type PublicXpStatus,
} from "./foundryTrainingService";
import { claimAssignmentForParticipant, type AssignmentClaimResult } from "./foundryAssignmentPublishService";
import { materializeFollowupObligation } from "./foundryFollowupService";
import { materializeApplyWindow, applyNarration, type MaterializeApplyResult } from "./foundryApplyWindowService";
import { issueCompletionClaim, invalidateDeferredClaim } from "./completionClaimService";
import type { FollowUpDays } from "@/domain/foundry/followup/followUpObligation";
import { participantDraftNamespace } from "./participant-draft-namespace";
import { journeyActionDecision, journeyReflection, toPublicJourney, type PublicJourney } from "@/domain/foundry/module/journey";

/**
 * Foundry GUIDANCE rooms — written guidance and live discussion (Slice R4-R2G).
 *
 * The third and fourth approved V1 material types, on the SAME canonical spine as the other
 * two: the same `foundry_events` row, the same `foundry_event_participants`, the same
 * `foundry_event_training_progress` row, and the same XP path
 * (`awardTrainingCoreXp` → `bty_foundry_award_daily_capped` → `applyDirectCoreXp`), attributed
 * identically as `source_type='foundry_training_completion'`. No new event table, no new
 * completion table, no new XP ledger, and — the boundary this slice was given — NO NEW CONTENT
 * TABLE.
 *
 * WHERE THE CONTENT LIVES. In the immutable `foundry_event_module.module_snapshot`, as the
 * `publishedGuidanceV1` contract frozen at publish. That snapshot is already the learner-facing
 * source for the approved Journey, already read at learner runtime, and already immutable — so
 * what the Host approved is exactly what the learner receives, with nothing to keep in sync.
 *
 * WHAT THE EVIDENCE IS, AND IS NOT.
 *
 * Both types complete through a LEARNER DECLARATION, and both declarations sit on the exposure
 * rung of the BTY Evidence Ladder — the same rung as "the video ended" and "the pages were
 * visited", no higher:
 *
 *   written_guidance    → `written_guidance_read_at`. The learner acknowledged reading the
 *                         guidance that was rendered on their screen. Read evidence. NOT
 *                         understanding.
 *
 *   live_discussion     → `discussion_self_reported_at`. The learner said they took part.
 *                         PARTICIPANT-REPORTED, and that is the whole of it: BTY did not
 *                         observe the discussion, did not verify it, took no attendance, and
 *                         has no record that it occurred. A Host reading this room learns that
 *                         a learner SAID they participated — never that they did.
 *
 * Neither stamp awards anything on its own. Core XP is awarded by the ordinary full completion
 * (`completeGuidanceTraining`) — the same response, shared-understanding, reflection and
 * decision contract every other content type answers — exactly as the Founder decided.
 */

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

type GuidanceProgressRow = {
  id: string;
  event_id: string;
  participant_id: string;
  response_text: string | null;
  completed_at: string | null;
  linked_user_id: string | null;
  xp_awarded_at: string | null;
  written_guidance_read_at: string | null;
  discussion_self_reported_at: string | null;
};

const GUIDANCE_PROGRESS_COLS =
  "id, event_id, participant_id, response_text, completed_at, linked_user_id, xp_awarded_at, written_guidance_read_at, discussion_self_reported_at";

/**
 * The exposure column for a guidance type. A TOTAL map over the two guidance types — there is
 * no default arm, so neither type can silently borrow the other's stamp.
 */
const EXPOSURE_COLUMN: Readonly<Record<GuidanceContentType, keyof GuidanceProgressRow>> = {
  written_guidance: "written_guidance_read_at",
  live_discussion: "discussion_self_reported_at",
};

/**
 * Read the frozen participant-facing content for a guidance event. null when the event has no
 * `publishedGuidanceV1` contract, or the contract is malformed / mis-versioned — the caller
 * then shows an honest unavailable state rather than an empty training.
 */
export async function readGuidanceContent(
  admin: SupabaseClient,
  eventId: string,
): Promise<PublishedGuidanceV1 | null> {
  const { data } = await admin
    .from("foundry_event_module")
    .select("module_snapshot")
    .eq("event_id", eventId)
    .maybeSingle<{ module_snapshot: unknown }>();
  return readPublishedGuidance(data?.module_snapshot);
}

async function getGuidanceProgress(
  admin: SupabaseClient,
  eventId: string,
  participantId: string,
): Promise<GuidanceProgressRow | null> {
  const { data } = await admin
    .from("foundry_event_training_progress")
    .select(GUIDANCE_PROGRESS_COLS)
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .maybeSingle<GuidanceProgressRow>();
  return data ?? null;
}

/** Get-or-create the shared progress row for this (event, participant). */
async function ensureGuidanceProgress(
  admin: SupabaseClient,
  eventId: string,
  participantId: string,
): Promise<GuidanceProgressRow | null> {
  const existing = await getGuidanceProgress(admin, eventId, participantId);
  if (existing) return existing;
  const { data } = await admin
    .from("foundry_event_training_progress")
    .insert({ event_id: eventId, participant_id: participantId })
    .select(GUIDANCE_PROGRESS_COLS)
    .maybeSingle<GuidanceProgressRow>();
  return data ?? (await getGuidanceProgress(admin, eventId, participantId));
}

function guidanceMarkers(p: GuidanceProgressRow | null): TrainingProgressMarkers | null {
  if (!p) return null;
  return {
    video_started_at: null,
    video_completed_at: null,
    completed_at: p.completed_at,
    xp_awarded_at: p.xp_awarded_at,
    written_guidance_read_at: p.written_guidance_read_at,
    discussion_self_reported_at: p.discussion_self_reported_at,
  };
}

/**
 * Which guidance type this token's room is, resolved SERVER-SIDE from the stored discriminator.
 * null when the token is unresolvable, or the room is not a guidance room, or its discriminator
 * is unknown — the routes then refuse rather than acting on a type the client asked for.
 */
export async function resolveGuidanceType(
  admin: SupabaseClient,
  token: string,
): Promise<GuidanceContentType | null> {
  const resolved = await resolveEventByToken(admin, token);
  if (!resolved.ok) return null;
  const contentType = readContentType(resolved.event.content_type);
  if (contentType === null) return null;
  return isGuidanceContentType(contentType) ? contentType : null;
}

// ---------------------------------------------------------------------------
// Owner (control room)
// ---------------------------------------------------------------------------

export type ManagerGuidanceParticipant = {
  id: string;
  display_name: string;
  joined_at: string;
  training_status: ManagerRosterStatus;
};

export type ManagerGuidanceSnapshot = {
  event: {
    id: string;
    title: string;
    status: FoundryEventStatus;
    content_type: GuidanceContentType;
    join_token: string;
    created_at: string;
    closed_at: string | null;
    guidance: { material_text: string; completion_prompt: string } | null;
  };
  participants: ManagerGuidanceParticipant[];
  joined_count: number;
  completed_count: number;
};

/** Owner control-room snapshot: base event + frozen guidance + roster + counts. */
export async function getOwnerGuidanceSnapshot(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
  contentType: GuidanceContentType,
): Promise<ManagerGuidanceSnapshot | null> {
  const base = await getOwnerEventSnapshot(admin, ownerUserId, eventId);
  if (!base) return null;

  const content = await readGuidanceContent(admin, eventId);

  const { data: progress } = await admin
    .from("foundry_event_training_progress")
    .select("participant_id, completed_at, xp_awarded_at, written_guidance_read_at, discussion_self_reported_at")
    .eq("event_id", eventId)
    .returns<
      {
        participant_id: string;
        completed_at: string | null;
        xp_awarded_at: string | null;
        written_guidance_read_at: string | null;
        discussion_self_reported_at: string | null;
      }[]
    >();

  const byParticipant = new Map<string, TrainingProgressMarkers>();
  for (const p of progress ?? []) {
    byParticipant.set(p.participant_id, {
      video_started_at: null,
      video_completed_at: null,
      completed_at: p.completed_at,
      xp_awarded_at: p.xp_awarded_at,
      written_guidance_read_at: p.written_guidance_read_at,
      discussion_self_reported_at: p.discussion_self_reported_at,
    });
  }

  let completed = 0;
  const participants: ManagerGuidanceParticipant[] = base.participants.map((p) => {
    const markers = byParticipant.get(p.id) ?? null;
    if (markers?.completed_at) completed += 1;
    return {
      id: p.id,
      display_name: p.display_name,
      joined_at: p.joined_at,
      training_status: projectManagerRosterStatus("joined", markers, contentType),
    };
  });

  return {
    event: {
      id: base.event.id,
      title: base.event.title,
      status: base.event.status,
      content_type: contentType,
      join_token: base.event.join_token,
      created_at: base.event.created_at,
      closed_at: base.event.closed_at,
      guidance: content
        ? { material_text: content.materialText, completion_prompt: content.completionPrompt }
        : null,
    },
    participants,
    joined_count: participants.length,
    completed_count: completed,
  };
}

// ---------------------------------------------------------------------------
// Public (learner)
// ---------------------------------------------------------------------------

export type PublicGuidanceSnapshot = {
  content_type: GuidanceContentType;
  event: { title: string; status: FoundryEventStatus } | null;
  /**
   * R4-R5C4A — an opaque, non-authenticating namespace for this participant's DEVICE-LOCAL
   * draft. It names a localStorage slot and nothing else: no route reads it, no route accepts
   * it, and it reveals neither the session token nor the account. See
   * `participant-draft-namespace.ts` for why the browser needed one at all.
   */
  participant: { display_name: string; draft_ns: string } | null;
  /**
   * R4-R5C7A — a name to PREFILL the join field with, for the signed-in learner looking at their
   * OWN pre-join screen. Present only while `participant` is null: once someone has joined there
   * is nothing to prefill, and the account name has no business being on the wire. It is a
   * suggestion, never identity — the learner's submitted value stays the authority.
   */
  suggested_name?: string | null;
  /**
   * The Host's own text plus the questions the learner owes — visible only once joined, and the
   * prompts only once the exposure declaration has been made (the same unlock shape the video
   * and document rooms use).
   */
  guidance: {
    material_text: string;
    completion_prompt: string | null;
    shared_question: string | null;
  } | null;
  /**
   * Has this learner made their exposure declaration yet? The learner-facing control is rendered
   * from this, never from a client-side guess, and the server is the only writer.
   */
  declared: boolean;
  stage: PublicTrainingStage;
  xp_status: PublicXpStatus;
  journey?: PublicJourney | null;
  reflection_required?: boolean;
  /** R4-R3B1 — the frozen follow-up checkpoint. Same field, same meaning, as the video room. */
  follow_up_days?: FollowUpDays | null;
};

const UNAVAILABLE = (contentType: GuidanceContentType): PublicGuidanceSnapshot => ({
  content_type: contentType,
  event: null,
  participant: null,
  guidance: null,
  declared: false,
  stage: "inactive",
  xp_status: "none",
});

function buildGuidanceSnapshot(
  event: EventRow,
  contentType: GuidanceContentType,
  participant: ParticipantRow | null,
  progress: GuidanceProgressRow | null,
  content: PublishedGuidanceV1 | null,
  tokenVersionCurrent: boolean,
  xpOverride?: PublicXpStatus,
  journey?: PublicJourney | null,
  followUpDays?: FollowUpDays | null,
): PublicGuidanceSnapshot {
  const hasParticipant = Boolean(participant);
  const markers = guidanceMarkers(progress);
  const stage = projectPublicTrainingStage({
    participantStatus: participant?.status ?? null,
    eventStatus: event.status,
    progress: markers,
    hasParticipant,
    contentType,
  });

  if (!hasParticipant && !tokenVersionCurrent) return UNAVAILABLE(contentType);
  if (stage === "removed" || stage === "inactive") {
    return { ...UNAVAILABLE(contentType), stage };
  }

  const declared = Boolean(
    progress?.[EXPOSURE_COLUMN[contentType]],
  );

  const showContent =
    stage === "declare" || stage === "response" || stage === "completed_awarded" || stage === "completed_claimable";
  const unlockedPrompt =
    stage === "response" || stage === "completed_awarded" || stage === "completed_claimable";

  const guidance =
    content && showContent
      ? {
          material_text: content.materialText,
          completion_prompt: unlockedPrompt ? content.completionPrompt : null,
          shared_question: unlockedPrompt ? content.sharedQuestion : null,
        }
      : null;

  const derivedXp: PublicXpStatus = progress?.xp_awarded_at
    ? "awarded"
    : progress?.completed_at
      ? "claimable"
      : "none";

  return {
    content_type: contentType,
    event: { title: event.title, status: event.status },
    participant: participant
      ? { display_name: participant.display_name, draft_ns: participantDraftNamespace(participant.event_id, participant.id) }
      : null,
    guidance,
    declared,
    stage,
    xp_status: xpOverride ?? derivedXp,
    journey: showContent ? (journey ?? null) : null,
    reflection_required: Boolean(
      showContent &&
        requiredLearnerReflection(
          journey?.elements.find((e) => e.kind === "reflection")?.content,
          content?.completionPrompt,
          content?.sharedQuestion,
        ),
    ),
    /* R4-R3B1 — what signing in is FOR. Null when the Host asked for no checkpoint. */
    follow_up_days: followUpDays ?? null,
  };
}

async function guidanceSnapshotFor(
  admin: SupabaseClient,
  event: EventRow,
  contentType: GuidanceContentType,
  participant: ParticipantRow,
  xpOverride?: PublicXpStatus,
): Promise<PublicGuidanceSnapshot> {
  const progress = await getGuidanceProgress(admin, event.id, participant.id);
  const content = await readGuidanceContent(admin, event.id);
  const journey = toPublicJourney(await readEventJourney(admin, event.id));
  const followUpDays = await readEventFollowUpDays(admin, event.id);
  return buildGuidanceSnapshot(event, contentType, participant, progress, content, true, xpOverride, journey, followUpDays);
}

export async function getPublicGuidanceSnapshot(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  contentType: GuidanceContentType,
  /** R4-R5C3A1 — server-derived caller, or null when anonymous. Optional: omitting it preserves today's behaviour exactly. */
  authUserId?: string | null,
  /**
   * R4-R5C7A — resolved by the ROUTE from the optional auth session (never sent by the browser).
   * Passed through to the pre-join snapshot only; see the field's note on the snapshot type.
   */
  suggestedName?: string | null,
): Promise<PublicGuidanceSnapshot> {
  const resolved = await resolveEventByToken(admin, token);
  if (!resolved.ok) return UNAVAILABLE(contentType);
  const { event, tokenVersion } = resolved;

  const resolvedParticipant = sessionToken ? await findParticipantBySession(admin, event.id, sessionToken) : null;
  /*
    ACCOUNT-SWITCH CONTAINMENT (R4-R5C3A1 §5). A participant bound to a DIFFERENT account is
    treated as ABSENT for this authenticated caller — the snapshot then reports the ordinary
    pre-join state and the learner joins as themselves. Nothing about P is mutated, deleted,
    re-linked or invalidated; it simply is not this caller's session. `authUserId` is optional,
    so every anonymous request and every existing caller behaves exactly as before, and a NULL
    participant is never a mismatch (that is the anonymous learner who signed in later).
  */
  const participant = isParticipantAccountCompatible(resolvedParticipant?.user_id, authUserId)
    ? resolvedParticipant
    : null;
  const progress = participant ? await getGuidanceProgress(admin, event.id, participant.id) : null;
  const content = await readGuidanceContent(admin, event.id);
  const journey = participant ? toPublicJourney(await readEventJourney(admin, event.id)) : null;
  /*
    PRE-JOIN ONLY (R4-R5C7A) — same rule as the video and document rooms: attached at the public
    read path, never inside the shared builder that action responses also use.
  */
  const snap = buildGuidanceSnapshot(
    event,
    contentType,
    participant,
    progress,
    content,
    tokenVersion === event.join_version,
    undefined,
    journey,
    participant ? await readEventFollowUpDays(admin, event.id) : null,
  );
  return snap.participant ? snap : { ...snap, suggested_name: suggestedName ?? null };
}

export type GuidanceResult =
  | {
      ok: true;
      snapshot: PublicGuidanceSnapshot;
      assignmentClaim?: AssignmentClaimResult;
      /**
       * R4-R5C9A — the authoritative outcome of `materializeApplyWindow`, kept rather than discarded.
       *
       * `created` and `exists` are the SAME learner truth: a Reality step is live for this training.
       * `skipped` and `error` never reach the client, so the terminal can only narrate what the
       * server actually did. The terminal NARRATES; Today still owns the action.
       */
      applyWindow?: "created" | "exists";
      /**
       * THE CODE THE LEARNER KEEPS (Deferred Completion Claim V1). Present only when the
       * completion belongs to nobody yet — a signed-in finisher already owns it and is shown
       * nothing. Returned exactly once, in this response; only its SHA-256 is stored, so it can
       * never be read back and must not be logged or serialised into an error.
       */
      claimCode?: string;
      claimExpiresAt?: string;
    }
  | { ok: false; reason: string };

/**
 * Record the learner's EXPOSURE DECLARATION — "I've read this guidance" or "I participated in
 * this discussion" (Slice R4-R2G).
 *
 * SERVER-GATED ON THE CONTENT EXISTING. A declaration is only meaningful about something that
 * was actually delivered, so an event with no frozen guidance refuses rather than recording an
 * acknowledgement of nothing.
 *
 * WRITE-ONCE. The stamp is set with `.is(column, null)`, so the FIRST declaration stands and a
 * repeat is a no-op — a learner cannot accumulate declarations, and the recorded instant is
 * always the moment they first said it.
 *
 * THIS AWARDS NOTHING. No XP, no completion, no follow-up obligation, no apply window and no
 * observation lineage begins here. It unlocks the ordinary completion step and does nothing
 * else, which is exactly what the Founder's D1 requires: the participation button is not the
 * completion.
 */
export async function declareGuidanceExposure(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  contentType: GuidanceContentType,
): Promise<GuidanceResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };
  if (r.event.status === "closed") return { ok: false, reason: "event_closed" };

  const content = await readGuidanceContent(admin, r.event.id);
  if (!content) return { ok: false, reason: "guidance_unavailable" };
  /*
    The stored event says it is one type and its frozen content says another — a state no publish
    can produce. Refuse rather than stamp the column the URL happened to ask for.
  */
  if (content.contentType !== contentType) return { ok: false, reason: "guidance_unavailable" };

  const prog = await ensureGuidanceProgress(admin, r.event.id, r.participant.id);
  if (!prog) return { ok: false, reason: "progress_failed" };

  const column = EXPOSURE_COLUMN[contentType];
  if (!prog[column]) {
    const now = new Date().toISOString();
    await admin
      .from("foundry_event_training_progress")
      .update({ [column]: now, updated_at: now })
      .eq("id", prog.id)
      .is(column, null);
  }

  return { ok: true, snapshot: await guidanceSnapshotFor(admin, r.event, contentType, r.participant) };
}

/**
 * Complete a guidance room. Identical in every respect to the document and video completions
 * except for WHICH exposure stamp gates it: the same required response, the same optional
 * shared-understanding answer, the same learner reflection rule, the same action decision, the
 * same idempotency, the same XP path, the same follow-up obligation and apply window.
 *
 * D3 — THE COMPLETION PATH IS REACHABLE, and this is where that is guaranteed: a guidance event
 * is published only with non-empty content and a non-empty completion prompt, the learner can
 * always declare their own exposure, and this function then behaves exactly like every other
 * content type. There is no published event that can never be finished.
 */
export async function completeGuidanceTraining(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  contentType: GuidanceContentType,
  rawResponse: unknown,
  authUserId: string | null,
  rawSharedResponse?: unknown,
  deviceTz?: string | null,
  rawDecisionResponse?: unknown,
  rawReflectionResponse?: unknown,
): Promise<GuidanceResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  const prog = await ensureGuidanceProgress(admin, r.event.id, r.participant.id);
  if (!prog) return { ok: false, reason: "progress_failed" };

  // Already complete → idempotent (do not re-award, do not overwrite the response).
  if (prog.completed_at) {
    return { ok: true, snapshot: await guidanceSnapshotFor(admin, r.event, contentType, r.participant) };
  }

  if (r.event.status === "closed") return { ok: false, reason: "event_closed" };

  /*
    THE EXPOSURE DECLARATION IS REQUIRED FIRST, and the server checks its OWN column rather than
    trusting the client to say it happened — the same relationship `video_not_complete` and
    `reading_not_complete` have to their gates.
  */
  if (!prog[EXPOSURE_COLUMN[contentType]]) {
    return { ok: false, reason: "guidance_not_declared" };
  }

  const content = await readGuidanceContent(admin, r.event.id);
  if (!content) return { ok: false, reason: "guidance_unavailable" };

  const response = validateResponse(rawResponse);
  if (!response.ok) return { ok: false, reason: response.reason };

  const shared = resolveSharedResponse(content.sharedQuestion, rawSharedResponse);
  if (!shared.ok) return { ok: false, reason: shared.reason };

  const journey = await readEventJourney(admin, r.event.id);
  const reflectionQuestion = requiredLearnerReflection(
    journeyReflection(journey),
    content.completionPrompt,
    content.sharedQuestion,
  );
  const reflection = resolveReflectionResponse(reflectionQuestion, rawReflectionResponse);
  if (!reflection.ok) return { ok: false, reason: reflection.reason };

  const actionDecision = journeyActionDecision(journey);
  const decision = resolveDecisionResponse(actionDecision, rawDecisionResponse);
  if (!decision.ok) return { ok: false, reason: decision.reason };

  const now = new Date().toISOString();
  const sharedWrite = shared.value
    ? { shared_understanding_response: shared.value, shared_response_submitted_at: now, host_review_status: "NOT_REVIEWED" }
    : {};
  const decisionWrite = decision.value
    ? { decision_response_text: decision.value, decision_submitted_at: now }
    : {};
  const reflectionWrite = reflection.value
    ? { learner_reflection_text: reflection.value, learner_reflection_submitted_at: now }
    : {};

  const { data: updated } = await admin
    .from("foundry_event_training_progress")
    .update({ response_text: response.value, completed_at: now, updated_at: now, ...sharedWrite, ...decisionWrite, ...reflectionWrite })
    .eq("id", prog.id)
    .is("completed_at", null)
    .select(GUIDANCE_PROGRESS_COLS)
    .maybeSingle<GuidanceProgressRow>();

  const progressId = updated?.id ?? prog.id;

  // Identity FIRST, independent of the reward — same rule as the video and document paths.
  /*
    COMPLETION SAFETY BELT (Slice R4-R5C3A1 §7) — see the full note in
    `foundryTrainingService.completeTraining`. Same predicate, same refusal: participant-level
    completion always stands; only account attribution is withheld when the participant belongs
    to a different account. The result contract is unchanged.
  */
  const accountLinkable = mayAttributeToAccount(r.participant.user_id, authUserId);
  const linkableUserId = accountLinkable ? authUserId : null;
  await linkLearnerIdentity(admin, progressId, linkableUserId);

  let xpOverride: PublicXpStatus | undefined;
  if (linkableUserId) {
    const outcome = await awardTrainingCoreXp(admin, linkableUserId, r.event.id, r.event.owner_user_id, progressId);
    if (outcome === "awarded") {
      await admin
        .from("foundry_event_training_progress")
        .update({ linked_user_id: linkableUserId, xp_awarded_at: new Date().toISOString() })
        .eq("id", progressId)
        .is("xp_awarded_at", null);
    }
    xpOverride = outcomeToXpStatus(outcome);
  }

  /*
    R4-R5C9A — declared at function scope so the outcome survives the block it is produced in.
    Defaults to "skipped": when the authenticated branch never runs (an anonymous completion),
    there is genuinely nothing to narrate, and that is the honest default rather than an absent value.
  */
  let applyWindowResult: MaterializeApplyResult = "skipped";
  /*
    THE ONE THING AN ANONYMOUS FINISHER LEAVES WITH (Deferred Completion Claim V1).

    The branch below is unchanged and stays the forward rule: no Apply window and no learner
    follow-up until an account exists. What was missing is that the learner also left with no way
    BACK — the participant session is HttpOnly, 30 days and one device, so a completion they
    walked away from could never be attached again. They now get a code they can keep.

    Fail-soft by construction: `issueCompletionClaim` returns null rather than throwing, because a
    credential problem must never fail a training somebody has already finished.
  */
  const deferredClaim = linkableUserId ? null : await issueCompletionClaim(admin, progressId);
  if (linkableUserId) {
    await materializeFollowupObligation(admin, {
      eventId: r.event.id,
      progressId,
      authUserId: linkableUserId,
      completedAtIso: now,
      deviceTz,
    });
    applyWindowResult = await materializeApplyWindow(admin, {
      eventId: r.event.id,
      progressId,
      authUserId: linkableUserId,
      completedAtIso: now,
      deviceTz,
    });

    /*
      ASSIGNMENT TRUTH IS A CONSEQUENCE OF COMPLETION (Slice R4-R5B1) — see the full note in
      `foundryTrainingService.completeTraining`. This room family had NO compensation of any kind:
      the guidance client carries no auto-claim effect, and a signed-in learner never sees the claim
      control, so a completed written-guidance or live-discussion assignment stayed `assigned`
      indefinitely. Same call, same position, same guarantees: server-derived match keys, idempotent
      and conflict-safe RPC, `not_applicable` (no write) for an open-link event, result deliberately
      not surfaced, and no way to throw into this path.
    */
    await claimAssignmentForParticipant(admin, r.event.id, r.participant.id, linkableUserId);
  }

  return { ok: true, snapshot: await guidanceSnapshotFor(admin, r.event, contentType, r.participant, xpOverride), ...applyNarration(applyWindowResult), ...(deferredClaim ? { claimCode: deferredClaim.code, claimExpiresAt: deferredClaim.expiresAt } : {}) };
}

/** Claim XP after an anonymous guidance completion, once the participant authenticates. */
export async function claimGuidanceXp(
  admin: SupabaseClient,
  token: string,
  sessionToken: string | null | undefined,
  contentType: GuidanceContentType,
  authUserId: string,
  deviceTz?: string | null,
): Promise<GuidanceResult> {
  const r = await resolvePublic(admin, token, sessionToken);
  if (!r.ok) return { ok: false, reason: r.reason };

  /*
    SAFETY BELT ON THE CLAIM PATH TOO (R4-R5C3A1 §7). The same conflict is reachable here: a
    browser holding user A's participant cookie while user B is signed in. The canonical
    anonymous claim is untouched — an anonymous participant has `user_id` NULL, which is always
    compatible — so this refuses only a proven cross-account attribution.
  */
  if (!mayAttributeToAccount(r.participant.user_id, authUserId)) {
    return { ok: false, reason: "no_session" };
  }
  const prog = await getGuidanceProgress(admin, r.event.id, r.participant.id);
  if (!prog || !prog.completed_at) return { ok: false, reason: "not_completed" };

  /*
    R4-R5C9A — declared at function scope so the outcome survives the block it is produced in.
    Defaults to "skipped": when the authenticated branch never runs (an anonymous completion),
    there is genuinely nothing to narrate, and that is the honest default rather than an absent value.
  */
  let applyWindowResult: MaterializeApplyResult = "skipped";
  const assignmentClaim = await claimAssignmentForParticipant(admin, r.event.id, r.participant.id, authUserId);

  await materializeFollowupObligation(admin, {
    eventId: r.event.id,
    progressId: prog.id,
    authUserId,
    completedAtIso: prog.completed_at,
    deviceTz,
  });
  applyWindowResult = await materializeApplyWindow(admin, {
    eventId: r.event.id,
    progressId: prog.id,
    authUserId,
    completedAtIso: prog.completed_at,
    deviceTz,
  });

  await linkLearnerIdentity(admin, prog.id, authUserId);
  /*
    A COMPLETION THAT NOW HAS AN OWNER MUST NOT STILL BE CLAIMABLE (Deferred Completion Claim V1).

    The learner may have walked away with a written-down code and then come back through the room
    instead. This route just gave the completion an account, so the code is retired here rather
    than left to expire — a bearer credential pointing at something already owned is exactly what
    single-use is for. Fail-soft: the linkage above is the part that matters.
  */
  await invalidateDeferredClaim(admin, prog.id);

  if (prog.xp_awarded_at) {
    return {
      ok: true,
      snapshot: await guidanceSnapshotFor(admin, r.event, contentType, r.participant, "awarded"),
      assignmentClaim,
      ...applyNarration(applyWindowResult),
    };
  }

  const outcome = await awardTrainingCoreXp(admin, authUserId, r.event.id, r.event.owner_user_id, prog.id);
  if (outcome === "awarded") {
    await admin
      .from("foundry_event_training_progress")
      .update({ linked_user_id: authUserId, xp_awarded_at: new Date().toISOString() })
      .eq("id", prog.id)
      .is("xp_awarded_at", null);
  }

  return {
    ok: true,
    snapshot: await guidanceSnapshotFor(admin, r.event, contentType, r.participant, outcomeToXpStatus(outcome)),
    assignmentClaim,
  };
}
