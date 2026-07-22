import type { SupabaseClient } from "@supabase/supabase-js";
import { draftTitleFrom, type BuilderAnswers } from "@/domain/foundry/module/module-builder";
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

  const { data: event, error: evErr } = await admin
    .from("foundry_events")
    .insert({ owner_user_id: ownerUserId, title, content_type: "document" })
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
    const snap = await snapshotFor(admin, ownerUserId, already.event_id);
    if (!snap) return { ok: false, reason: "snapshot_failed" };
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

  const answers = (draft.answers ?? {}) as BuilderAnswers;

  // Readiness (the approval gate) — enforced at publish even in the one-tap flow.
  const errors = await draftReadinessErrors(admin, draftId, answers);
  if (errors.length > 0) return { ok: false, reason: errors[0] ?? "draft_incomplete" };

  const title = (draftTitleFrom(answers) ?? answers.problem ?? "").trim();
  if (!title) return { ok: false, reason: "title_required" };

  const promptRaw = completionPromptOrNull(answers) ?? DEFAULT_COMPLETION_PROMPT[locale];
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
  let eventId: string;
  if (material.kind === "youtube") {
    const res = await createTrainingEvent(admin, ownerUserId, {
      title,
      youtube_url: material.url,
      completion_prompt: completionPrompt,
      shared_question: sharedQuestion,
    });
    if (!res.ok) return { ok: false, reason: res.reason };
    eventId = res.value.event.id;
  } else {
    const res = await createDocumentEventFromDraftAsset(admin, ownerUserId, draftId, title, completionPrompt, sharedQuestion);
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
      const snap = await snapshotFor(admin, ownerUserId, winner.event_id);
      if (!snap) return { ok: false, reason: "snapshot_failed" };
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

  const snap = await snapshotFor(admin, ownerUserId, eventId);
  if (!snap) return { ok: false, reason: "snapshot_failed" };
  // Authoritative committed state for the confirmation UI (reads DB, not the preview).
  const committed = await readCommittedParticipation(admin, eventId);
  return { ok: true, value: { snapshot: snap, reused: false, participation: committed } };
}
