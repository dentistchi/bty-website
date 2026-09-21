import type { SupabaseClient } from "@supabase/supabase-js";
import { validateEventTitle } from "@/domain/foundry/events/foundry-event";
import { planCompletionEvidence, storedCompletionPrompt } from "@/domain/foundry/events/quickTrainingMaterial";
import { MATERIAL_TEXT_MAX } from "@/domain/foundry/module/module-builder";
import { buildPublishedGuidance, PUBLISHED_GUIDANCE_KEY } from "@/domain/foundry/module/module-publish";
import { programErrorReason, programIdForNewRun } from "./foundryProgramService";
import { getOwnerGuidanceSnapshot, type ManagerGuidanceSnapshot } from "./foundryGuidanceService";
import type { ServiceResult } from "./foundryEventService";

/**
 * Quick Training — TEXT material.
 *
 * REUSE, NOT A SECOND TEXT SYSTEM. A text Quick Training is a `written_guidance` event: the same
 * `foundry_events.content_type` the Guided builder publishes, the same frozen
 * `publishedGuidanceV1` contract inside `foundry_event_module.module_snapshot`, the same learner
 * client (`FoundryGuidanceClient`), the same `written_guidance_read_at` exposure stamp, the same
 * completion finalizer, the same XP path and the same history entry. Nothing in this file
 * invents a content table, a progress column, a stage or a runtime — it only creates that event
 * from three fields instead of from an eight-step builder draft.
 *
 * WHY `source_draft_id` IS NULL. `foundry_event_module` was built as the frozen output of a
 * builder draft, and its `source_draft_id` carried the publish-idempotency boundary. A Quick
 * Training has no draft, and the alternative — minting a placeholder draft row so the column
 * could be filled — would put a training the Host never authored in the Builder's draft list and
 * would make the revision path offer to "create a new version" of something with no design
 * behind it. So the column became nullable and the honest value is stored. `resolveSource`
 * already reads a missing `source_draft_id` as `not_guided_program`, which is exactly what this
 * is.
 */
export type CreateQuickTextInput = {
  title?: unknown;
  material_text?: unknown;
  completion_prompt?: unknown;
  /** A reviewed quiz will be attached, so the quiz — not a written answer — is the completion check. */
  quiz_attached?: boolean;
};

function validateMaterialText(raw: unknown): { ok: true; value: string } | { ok: false; reason: string } {
  if (typeof raw !== "string") return { ok: false, reason: "material_text_required" };
  const cleaned = raw.trim();
  if (cleaned.length < 1) return { ok: false, reason: "material_text_required" };
  if (cleaned.length > MATERIAL_TEXT_MAX) return { ok: false, reason: "material_text_too_long" };
  return { ok: true, value: cleaned };
}

/**
 * Create a text Quick Training. Both-or-neither: the event and its frozen content are written in
 * that order and a failed snapshot insert deletes the event it just created, so a room whose
 * learner surface would be empty is never left behind. Shared Understanding is not asked by Quick
 * Training, so the frozen contract carries none.
 */
export async function createQuickTextEvent(
  admin: SupabaseClient,
  ownerUserId: string,
  input: CreateQuickTextInput,
): Promise<ServiceResult<ManagerGuidanceSnapshot>> {
  const title = validateEventTitle(input.title);
  if (!title.ok) return { ok: false, reason: title.reason };

  const materialText = validateMaterialText(input.material_text);
  if (!materialText.ok) return { ok: false, reason: materialText.reason };

  const plan = planCompletionEvidence(input.completion_prompt, Boolean(input.quiz_attached));
  if (!plan.ok) return { ok: false, reason: plan.reason };

  /*
    THE CONTENT IS BUILT BEFORE ANY ROW EXISTS. For a guidance event the module snapshot is the
    only copy of the learner's content, so a contract that cannot be built must refuse here —
    refusing later would leave a live event nobody can finish.
  */
  const guidance = buildPublishedGuidance({
    contentType: "written_guidance",
    materialText: materialText.value,
    completionPrompt: storedCompletionPrompt(plan.value),
    sharedQuestion: null,
    completionEvidence: plan.value.kind,
  });
  if (!guidance) return { ok: false, reason: "material_guidance_content_required" };

  // Quick/direct create resolves a FRESH Program and fails closed before any event row when the
  // canonical org is unresolvable — the same rule the video and PDF paths already follow.
  let programId: string | null;
  try {
    programId = await programIdForNewRun(admin, ownerUserId, title.value);
  } catch (e) {
    return { ok: false, reason: programErrorReason(e) };
  }
  const createdProgram = programId != null;

  const { data: event, error: evErr } = await admin
    .from("foundry_events")
    .insert({
      owner_user_id: ownerUserId,
      title: title.value,
      content_type: "written_guidance",
      program_id: programId,
    })
    .select("id")
    .single<{ id: string }>();
  if (evErr || !event) {
    if (createdProgram && programId) {
      await admin.from("foundry_programs").delete().eq("id", programId).eq("owner_user_id_snapshot", ownerUserId);
    }
    return { ok: false, reason: evErr?.message ?? "event_insert_failed" };
  }

  const { error: modErr } = await admin.from("foundry_event_module").insert({
    event_id: event.id,
    source_draft_id: null,
    module_snapshot: { [PUBLISHED_GUIDANCE_KEY]: guidance },
    module_version: 1,
  });
  if (modErr) {
    await admin.from("foundry_events").delete().eq("id", event.id).eq("owner_user_id", ownerUserId);
    if (createdProgram && programId) {
      await admin.from("foundry_programs").delete().eq("id", programId).eq("owner_user_id_snapshot", ownerUserId);
    }
    return { ok: false, reason: "content_insert_failed" };
  }

  const snapshot = await getOwnerGuidanceSnapshot(admin, ownerUserId, event.id, "written_guidance");
  if (!snapshot) return { ok: false, reason: "snapshot_failed" };
  return { ok: true, value: snapshot };
}
