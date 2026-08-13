import type { SupabaseClient } from "@supabase/supabase-js";
import { draftTitleFrom, type BuilderAnswers } from "@/domain/foundry/module/module-builder";
import { isJourneyApprovable, journeyCompletionCheck } from "@/domain/foundry/module/journey";
import { missingProgramKinds } from "@/domain/foundry/module/program-authorship";
import {
  deriveEventMaterial,
  buildModuleSnapshot,
  completionPromptOrNull,
  sharedQuestionOrNull,
} from "@/domain/foundry/module/module-publish";
import { validateCompletionPrompt, validateSharedQuestionOptional } from "@/domain/foundry/events/foundry-training";
import { computeMinReadSeconds, validatePageCount } from "@/domain/foundry/events/foundry-document";
import {
  getOwnerDraft,
  draftReadinessErrors,
  getPublishedEventBySourceDraft,
  type ServiceResult,
} from "./foundryModuleService";
import {
  preflightAssignedAudience,
  publishAssignmentsForEvent,
  readCommittedParticipation,
  type AssignedAudience,
  type CommittedParticipation,
  type ParticipationMode,
} from "./foundryAssignmentPublishService";
import { createTrainingEvent, type ManagerTrainingSnapshot } from "./foundryTrainingService";
import { getOwnerRoomSnapshot, type ManagerDocumentSnapshot } from "./foundryDocumentService";
import { programIdForNewRun, type ProgramLineage } from "./foundryProgramService";
import { resolveProgramGenerationAuthority } from "./programGenerationRecorder";

/**
 * Foundry Guided Module Builder — PUBLISH (Slice 2.3A · service layer).
 *
 * The canonical transaction that turns an APPROVED builder draft into a live
 * Foundry event: it reuses the existing event-creation primitives (YouTube via
 * `createTrainingEvent`, incl. its embeddability gate; PDF via a bespoke document
 * creation that reuses the draft's already-stored object) and adds the immutable
 * `foundry_event_module` snapshot + lineage. There is NO parallel event creator —
 * a published module event is indistinguishable from a quick-created one except
 * for its snapshot/lineage.
 *
 * Idempotency + concurrency: `foundry_event_module.source_draft_id` is UNIQUE, so
 * one draft version publishes at most one event. A concurrent duplicate loses at
 * that constraint; the loser compensating-deletes ONLY the event rows it created
 * (never the shared PDF storage object) and resolves the winner by source_draft_id.
 *
 * PDF durability: publish references the draft's existing storage object rather
 * than copying it. That is safe because a PUBLISHED draft is immortal — `deleteDraft`
 * and `removeAsset` both guard on `status = 'draft'`, so the object can never be
 * cleaned up out from under the event.
 *
 * Privacy: the snapshot is a whitelist of design fields only (never participants,
 * progress, reflection, XP, or credentials); the completion prompt is host-authored.
 */

export type Locale = "en" | "ko";

/** Sensible localized default used ONLY when the host left the completion question blank. */
const DEFAULT_COMPLETION_PROMPT: Record<Locale, string> = {
  en: "What is one thing from this you will apply this week?",
  ko: "이 훈련에서 이번 주에 적용할 한 가지는 무엇인가요?",
};

export type ManagerRoomSnapshot = ManagerTrainingSnapshot | ManagerDocumentSnapshot;

export type PublishResult = {
  snapshot: ManagerRoomSnapshot;
  /** True when the draft was already published (idempotent replay / concurrent loser). */
  reused: boolean;
  /**
   * The participation state that ACTUALLY committed (read back from the DB, Slice 3.1B-3C).
   * The confirmation UI must use this, never the pre-publish preview — a compensated/failed
   * assigned publish reports open_link + 0 here.
   */
  participation: CommittedParticipation;
};

/** Content-type-aware owner snapshot (carries join_token for the control-room handoff). */
async function snapshotFor(
  admin: SupabaseClient,
  ownerUserId: string,
  eventId: string,
): Promise<ManagerRoomSnapshot | null> {
  return getOwnerRoomSnapshot(admin, ownerUserId, eventId);
}

/**
 * PUBLICATION RECEIPT RECOVERY (Slice 3.2Q-R1).
 *
 * THE MEASURED DEFECT. `publishDraft` writes the event, then the module snapshot, then the
 * draft's `status`/`published_at` LAST — deliberately, so a failure before that leaves the
 * draft editable rather than stranded. But if the FINAL stamp is the thing that fails, the
 * event and its snapshot are already durable and nothing ever repairs the draft: the next
 * click finds the winner by `source_draft_id`, returns `reused: true`, and leaves a live
 * session sitting behind a row that still says `draft`. That mismatch was permanent.
 *
 * THE RECEIPT ALREADY EXISTS. `foundry_event_module.source_draft_id` is UNIQUE, and its row
 * carries the event, the source draft and the module version. Publication completion is
 * therefore already durable and already provable — this adds no column and no table, exactly
 * as the Apply receipt reuses `programAdoptionV1` rather than inventing a second record.
 *
 * CLAIM-BOUND, NEVER "AN EVENT EXISTS". The reconciliation below proves the module row belongs
 * to THIS draft (`source_draft_id`, exact), THIS version (`module_version`) and THIS owner (the
 * event row is re-read owner-scoped). `program_id` is never consulted — v1 and v2 of this pilot
 * share one Program root, and a shared root must never let one version's event stamp another
 * version's draft.
 *
 * THE TIMESTAMP IS THE SERVER'S, NOT NOW. `foundry_event_module.created_at` is when the publish
 * actually committed; using `new Date()` here would record the moment someone happened to retry,
 * which can be days later and is simply not when the training went live.
 */
type PublishReconcileOutcome = "already_published" | "reconciled" | "unreconciled";

async function reconcilePublicationReceipt(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  winner: { event_id: string; source_draft_id: string; module_version: number },
): Promise<PublishReconcileOutcome> {
  const draft = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!draft) return "unreconciled";
  if (draft.status === "published" && draft.published_at) return "already_published";

  // The claim: this module row is THIS draft, at THIS version. Both must hold.
  if (winner.source_draft_id !== draftId) return "unreconciled";
  if (winner.module_version !== draft.module_version) return "unreconciled";

  /*
    And the event itself must still exist AND belong to this owner. A module row whose event was
    compensated away describes a publish that did not survive, and stamping a draft published on
    the strength of it would be the same untruth in the opposite direction.
  */
  const { data: event } = await admin
    .from("foundry_events")
    .select("id, created_at")
    .eq("id", winner.event_id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle<{ id: string; created_at: string }>();
  if (!event) return "unreconciled";

  const { data: moduleRow } = await admin
    .from("foundry_event_module")
    .select("created_at")
    .eq("source_draft_id", draftId)
    .maybeSingle<{ created_at: string }>();

  const committedAt = moduleRow?.created_at ?? event.created_at;
  const { error } = await admin
    .from("foundry_module_drafts")
    .update({
      status: "published",
      approved_at: draft.approved_at ?? committedAt,
      published_at: draft.published_at ?? committedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .in("status", ["draft", "approved"]);
  return error ? "unreconciled" : "reconciled";
}

type PdfAssetRow = {
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  byte_size: number;
  page_count: number | null;
  page_count_verified: boolean;
  content_hash: string;
};

/**
 * Create a DOCUMENT event whose content REFERENCES the draft's durable PDF object
 * (no physical copy). Compensates by deleting ONLY the event rows on failure — it
 * MUST NOT delete the storage object, which the still-existing draft asset owns.
 * Returns the new event id.
 */
async function createDocumentEventFromDraftAsset(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  title: string,
  completionPrompt: string,
  sharedQuestion: string | null,
  lineage?: ProgramLineage,
): Promise<ServiceResult<string>> {
  const { data: asset } = await admin
    .from("foundry_module_draft_assets")
    .select("storage_bucket, storage_path, original_filename, byte_size, page_count, page_count_verified, content_hash")
    .eq("draft_id", draftId)
    .eq("file_kind", "pdf")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<PdfAssetRow>();

  if (!asset) return { ok: false, reason: "material_pdf_required" };

  const pageCountCheck = validatePageCount(asset.page_count ?? 1);
  const pageCount = pageCountCheck.ok ? pageCountCheck.value : 1;
  const minReadSeconds = computeMinReadSeconds(pageCount);

  const programId = await programIdForNewRun(admin, ownerUserId, title, lineage);

  const { data: event, error: evErr } = await admin
    .from("foundry_events")
    .insert({ owner_user_id: ownerUserId, title, content_type: "document", program_id: programId })
    .select("id")
    .single<{ id: string }>();
  if (evErr || !event) return { ok: false, reason: evErr?.message ?? "event_insert_failed" };

  const { error: contentErr } = await admin.from("foundry_event_document_content").insert({
    event_id: event.id,
    source_type: "uploaded_pdf",
    original_file_id: null,
    content_hash: asset.content_hash,
    storage_bucket: asset.storage_bucket,
    storage_path: asset.storage_path, // durable shared object (published draft is immortal)
    file_name: asset.original_filename,
    byte_size: asset.byte_size,
    page_count: pageCount,
    page_count_verified: asset.page_count_verified,
    min_read_seconds: minReadSeconds,
    intro: null,
    completion_prompt: completionPrompt,
    shared_question: sharedQuestion,
  });
  if (contentErr) {
    // Compensate: remove the event (cascade drops the content row) — NEVER the object.
    await admin.from("foundry_events").delete().eq("id", event.id).eq("owner_user_id", ownerUserId);
    return { ok: false, reason: "content_insert_failed" };
  }

  return { ok: true, value: event.id };
}

/**
 * Publish an owned builder draft into a live Foundry event. Approve-on-publish:
 * a `draft` (or already-`approved`) row that passes the readiness gate is created
 * as an event, snapshotted immutably, and transitioned to `published` LAST (so a
 * failure never leaves an un-editable approved limbo). Idempotent by source_draft_id.
 */
/**
 * Optional participation overlay (Slice 3.1B-3C). Absent ⇒ OPEN_LINK, exactly today's
 * behavior. `assigned_overlay` additionally freezes a canonical recipient set; it never
 * gates the room. The audience is the declaration the Builder already supports; the server
 * resolves the actual members and never trusts a client recipient list.
 */
export type PublishParticipation = {
  mode: ParticipationMode;
  audience?: AssignedAudience;
};

export async function publishDraft(
  admin: SupabaseClient,
  ownerUserId: string,
  draftId: string,
  locale: Locale = "ko",
  participation?: PublishParticipation,
): Promise<ServiceResult<PublishResult>> {
  const draft = await getOwnerDraft(admin, ownerUserId, draftId);
  if (!draft) return { ok: false, reason: "draft_not_found" };

  // Idempotency: this draft version already published → return the existing event.
  const already = await getPublishedEventBySourceDraft(admin, draftId);
  if (already) {
    /*
      RECONCILE BEFORE RETURNING (Slice 3.2Q-R1). A retry is the only moment anything can repair
      a publish whose final draft stamp did not land, so it does that first — and says so if it
      cannot, rather than reporting a healthy reuse over a draft that still says `draft`.
    */
    const reconciled = await reconcilePublicationReceipt(admin, ownerUserId, draftId, already);
    if (reconciled === "unreconciled") return { ok: false, reason: "publish_receipt_unreconciled" };
    const snap = await snapshotFor(admin, ownerUserId, already.event_id);
    if (!snap) return { ok: false, reason: "session_created_view_unavailable" };
    const committed = await readCommittedParticipation(admin, already.event_id);
    return { ok: true, value: { snapshot: snap, reused: true, participation: committed } };
  }

  // ASSIGNED_OVERLAY pre-flight (Slice 3.1B-3C): resolve the recipient set BEFORE creating
  // any event, so a zero-recipient assigned publish creates NOTHING — no event, no snapshot,
  // no fallback to Everyone. OPEN_LINK skips this entirely and behaves exactly as before.
  const isAssigned = participation?.mode === "assigned_overlay";
  if (isAssigned) {
    if (!participation?.audience) return { ok: false, reason: "audience_required" };
    const pre = await preflightAssignedAudience(admin, ownerUserId, participation.audience);
    if (!pre.ok) return { ok: false, reason: pre.reason };
  }

  if (draft.status !== "draft" && draft.status !== "approved") {
    return { ok: false, reason: "draft_not_publishable" };
  }

  // PROGRAM GENERATION MUTUAL EXCLUSION — FAIL CLOSED (Slice 3.2L-R1.1).
  //
  // Measured live: a draft was published 4 seconds after a program generation was
  // admitted against it, and that generation recorded success 6 seconds later. Draft
  // status was checked only at generation admission, so publication could land while the
  // provider call was still in flight.
  //
  // R1 added this gate but failed OPEN when the authority query errored — which read an
  // inability to answer as permission. Publication is the IRREVERSIBLE side, so it now
  // refuses on BOTH "a generation is running" and "I cannot tell whether one is running".
  // The two are kept distinct so the Host is told the truth: one is a wait, the other is
  // a retry.
  //
  // Ordering is deliberate: the idempotency reuse branch above already returned, so an
  // ALREADY-PUBLISHED draft stays retrievable even while this authority is unavailable —
  // a completed operation must never become unreadable because of a transient failure.
  // Everything below this point mutates, so both refusals happen before any of it.
  const authority = await resolveProgramGenerationAuthority(admin, draftId);
  if (authority.state === "active") return { ok: false, reason: "program_generation_in_progress" };
  if (authority.state === "unavailable") return { ok: false, reason: "program_generation_state_unavailable" };

  const answers = (draft.answers ?? {}) as BuilderAnswers;

  // Readiness (the approval gate) — enforced at publish even in the one-tap flow.
  const errors = await draftReadinessErrors(admin, draftId, answers);
  if (errors.length > 0) return { ok: false, reason: errors[0] ?? "draft_incomplete" };

  // Reality-Grounded Journey V1 (Slice 3.2C-B3A). When the draft is Journey-enabled
  // the participant TITLE and COMPLETION CHECK come from the Host-APPROVED Journey —
  // never the raw problem first line or a raw completionPrompt that bypassed review.
  // Publish is blocked unless the Journey is fully grounded (no needs_confirmation).
  const journey = answers.realityGroundedJourneyV1;
  const journeyEnabled = journey !== undefined;
  if (journeyEnabled && !isJourneyApprovable(journey)) {
    return { ok: false, reason: "journey_not_approved" };
  }

  /**
   * PROGRAM COMPLETENESS — a SEPARATE invariant from journey approvability (Slice 3.2P-R2.1).
   *
   * MEASURED. A v2 revision inherits its parent's answers verbatim, journey included. The
   * pilot's v2 therefore arrived carrying v1's five-element journey, and every element in it
   * is grounded — so `isJourneyApprovable` returns TRUE while `scenario`, `field_application`
   * and `follow_up`, all required by the Host's OWN stored intent, are absent. Nothing on this
   * path checked for them: `missingProgramKinds` existed only in client components, and the
   * client suppressed it precisely when the journey was approvable. The two questions are not
   * substitutes — "is every element the Host approved grounded?" and "are all the elements
   * this Host's design requires present?" have different answers, and this is the second one.
   *
   * GRANDFATHERING, exactly as decided. This runs at PUBLISH, so an already-published legacy
   * version is untouched and stays readable — v1 of this very pilot is published today with
   * the same three kinds missing and remains valid. What is refused is a FUTURE publish. An
   * unpublished draft is not grandfathered by predating the fix, by inheriting a legacy
   * journey, by being module_version 1, or by being approvable.
   *
   * THE PREDICATE IS `journeyEnabled`, the same one the check above already uses, not
   * `module_version` and not the presence of a `program_id` (which `createDraft` resolves for
   * essentially every original draft and so would sweep in non-Guided content). Measured on
   * staging: of eight unpublished drafts, three are journey-enabled and exactly two would be
   * newly blocked — both v2 revisions carrying inherited legacy journeys, which is the entire
   * class this exists for. The five drafts with no journey are untouched.
   *
   * REQUIRED KINDS COME FROM THE HOST'S INTENT, never from a maximal ladder: this pilot's
   * `learningNeeds` omit `decide`, so `action_decision` is not required and is not demanded.
   */
  if (journeyEnabled) {
    const missingKinds = missingProgramKinds(answers, journey);
    if (missingKinds.length > 0) return { ok: false, reason: "program_sections_missing" };
  }

  const title = journeyEnabled
    ? (journey!.displayTitle ?? "").trim()
    : (draftTitleFrom(answers) ?? answers.problem ?? "").trim();
  if (!title) return { ok: false, reason: "title_required" };

  const promptRaw = journeyEnabled
    ? (journeyCompletionCheck(journey) ?? "")
    : (completionPromptOrNull(answers) ?? DEFAULT_COMPLETION_PROMPT[locale]);
  const promptCheck = validateCompletionPrompt(promptRaw);
  if (!promptCheck.ok) return { ok: false, reason: promptCheck.reason };
  const completionPrompt = promptCheck.value;

  // Shared Understanding question (Slice 3.1B-3G) — OPTIONAL, distinct from the private Reflection
  // prompt. NULL (blank / Host-removed) publishes no shared question → completion behaves as before.
  const sharedCheck = validateSharedQuestionOptional(sharedQuestionOrNull(answers));
  if (!sharedCheck.ok) return { ok: false, reason: sharedCheck.reason };
  const sharedQuestion = sharedCheck.value;

  const material = deriveEventMaterial(answers);
  if (material.kind === "unsupported") return { ok: false, reason: material.reason };

  // 1. Create the event + participant content via the canonical primitives.
  // Program Run lineage (Slice 3.2C): the published run INHERITS the draft's durable
  // Program identity EXACTLY (including null = draft with no recorded lineage). Never
  // re-resolved here, so a Guided publish can never cross organizations or fork identity.
  const lineage = { programId: draft.program_id };
  let eventId: string;
  if (material.kind === "youtube") {
    const res = await createTrainingEvent(admin, ownerUserId, {
      title,
      youtube_url: material.url,
      completion_prompt: completionPrompt,
      shared_question: sharedQuestion,
    }, lineage);
    if (!res.ok) return { ok: false, reason: res.reason };
    eventId = res.value.event.id;
  } else {
    const res = await createDocumentEventFromDraftAsset(admin, ownerUserId, draftId, title, completionPrompt, sharedQuestion, lineage);
    if (!res.ok) return { ok: false, reason: res.reason };
    eventId = res.value;
  }

  // 2. Freeze the immutable module snapshot (source_draft_id UNIQUE = idempotency boundary).
  const { error: modErr } = await admin.from("foundry_event_module").insert({
    event_id: eventId,
    source_draft_id: draftId,
    module_snapshot: buildModuleSnapshot(answers),
    module_version: draft.module_version,
  });
  if (modErr) {
    // Concurrent duplicate (UNIQUE) or a real error → compensate the event ONLY
    // (cascade drops the content row; the shared PDF object is never touched).
    await admin.from("foundry_events").delete().eq("id", eventId).eq("owner_user_id", ownerUserId);
    const winner = await getPublishedEventBySourceDraft(admin, draftId);
    if (winner) {
      /*
        THE CONCURRENT LOSER (Slice 3.2Q-R1). The UNIQUE on `source_draft_id` chose the other
        request; its event is durable and this one just deleted its own. The winner may have
        raced ahead of its own final stamp, so this path reconciles too — and, like the retry
        path, a failed READ here means the winner's session EXISTS and could not be shown,
        which is not a creation failure.
      */
      const reconciled = await reconcilePublicationReceipt(admin, ownerUserId, draftId, winner);
      if (reconciled === "unreconciled") return { ok: false, reason: "publish_receipt_unreconciled" };
      const snap = await snapshotFor(admin, ownerUserId, winner.event_id);
      if (!snap) return { ok: false, reason: "session_created_view_unavailable" };
      const committed = await readCommittedParticipation(admin, winner.event_id);
      return { ok: true, value: { snapshot: snap, reused: true, participation: committed } };
    }
    return { ok: false, reason: "publish_conflict" };
  }

  // 4. ASSIGNED_OVERLAY (Slice 3.1B-3C): now that the event exists, atomically freeze the
  //    audience snapshot + assignment rows + audit + mode in ONE function transaction. If it
  //    fails, COMPENSATE by deleting the just-created event (same pattern the module-snapshot
  //    conflict above uses) so a failed assigned publish leaves nothing behind.
  if (isAssigned && participation?.audience) {
    const assigned = await publishAssignmentsForEvent(admin, eventId, ownerUserId, participation.audience);
    if (!assigned.ok) {
      await admin.from("foundry_events").delete().eq("id", eventId).eq("owner_user_id", ownerUserId);
      // The draft transition has not happened yet (it runs below only on success), so the
      // draft remains publishable for a retry.
      return { ok: false, reason: assigned.reason };
    }
  }

  // 5. Transition the draft to published LAST.
  const nowPub = new Date().toISOString();
  await admin
    .from("foundry_module_drafts")
    .update({ status: "published", approved_at: draft.approved_at ?? nowPub, published_at: nowPub, updated_at: nowPub })
    .eq("id", draftId)
    .eq("owner_user_id", ownerUserId)
    .in("status", ["draft", "approved"]);

  /*
    CREATION AND PRESENTATION ARE DIFFERENT FAILURES (Slice 3.2Q-R1).

    Everything durable is committed by this line: the event, the immutable module snapshot, any
    assignments, and the draft's publication stamp. `snapshotFor` is a READ that builds the
    control-room view for the response. It used to return `snapshot_failed`, which the Builder
    maps to "Couldn't create the session. Please try once more." — a sentence that is simply
    false at this point, and one that invites a Host to retry a training that is already live.

    So the two are now distinct reasons, and this one says what actually happened: the session
    exists and could not be displayed. The retry is still safe — it lands on the idempotency
    branch, reuses the same event and creates nothing.
  */
  const snap = await snapshotFor(admin, ownerUserId, eventId);
  if (!snap) return { ok: false, reason: "session_created_view_unavailable" };
  // Authoritative committed state for the confirmation UI (reads DB, not the preview).
  const committed = await readCommittedParticipation(admin, eventId);
  return { ok: true, value: { snapshot: snap, reused: false, participation: committed } };
}
