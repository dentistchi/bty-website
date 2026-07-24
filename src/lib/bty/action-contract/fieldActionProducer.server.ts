/**
 * Field Action producer (Slice 3.1B-3N-5C.3) — the smallest canonical NON-ARENA
 * producer of a `bty_action_contracts` row for the current Learning OS.
 *
 * A Field Action is a real-world application a learner commits to AFTER completing a
 * Foundry module. It is NOT an Arena run: `run_id`, `arena_scenario_id`,
 * `primary_choice_id`, `pattern_family` are all NULL, and `action_type='field_action'`
 * is the AUTHORITATIVE server-authored source discriminator (never inferred from run_id/
 * session_id/client JSON, never mutated by learner-facing PATCH/submit routes).
 *
 * The existing `ensureDraftActionContractWithAdmin` hard-requires an `arena_runs` row, so
 * this is a distinct insert path. Idempotency reuses the existing `UNIQUE(user_id, session_id)`
 * constraint with `session_id='field_action:<foundry_progress_id>'` → exactly one current
 * Field Action per learner + Foundry progress. Ownership truth is the server session; the
 * client only names a Foundry `eventId`, which is validated against the learner's OWN
 * completed progress. No misleading behavioural text is fabricated — the learner authors
 * who/what/how/when via the form; `contract_description` carries only the module title as
 * honest source context.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const FIELD_ACTION_SOURCE_KIND = "foundry_field_action" as const;
export const FIELD_ACTION_ACTION_TYPE = "field_action" as const;
/** Default review window for a field application (the learner's "When" is authored separately). */
const FIELD_ACTION_DEFAULT_WINDOW_HOURS = 24 * 7;

export type FieldActionContract = {
  contractId: string;
  status: string;
  actionType: string;
  who: string | null;
  what: string | null;
  how: string | null;
  stepWhen: string | null;
  revisionNote: string | null;
  reviewedAt: string | null;
  moduleTitle: string;
  deadlineAt: string | null;
};

export type FieldActionProducerResult =
  | { ok: true; contract: FieldActionContract; created: boolean }
  | {
      ok: false;
      code: "progress_not_found" | "not_owner" | "insert_failed" | "load_failed";
    };

const FIELD_ACTION_COLS =
  "id, user_id, status, action_type, who, what, how, step_when, revision_note, reviewed_at, contract_description, deadline_at, session_id";

function projectContract(row: Record<string, unknown>): FieldActionContract {
  return {
    contractId: String(row.id),
    status: String(row.status ?? ""),
    actionType: String(row.action_type ?? ""),
    who: (row.who as string | null) ?? null,
    what: (row.what as string | null) ?? null,
    how: (row.how as string | null) ?? null,
    stepWhen: (row.step_when as string | null) ?? null,
    revisionNote: (row.revision_note as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    moduleTitle: String(row.contract_description ?? ""),
    deadlineAt: (row.deadline_at as string | null) ?? null,
  };
}

/**
 * Create (or return the existing) Field Action draft for a learner's completed Foundry event.
 * Idempotent per learner + progress. Never accepts ownership from the client.
 */
export async function ensureFieldActionDraft(
  admin: SupabaseClient,
  params: { learnerUserId: string; eventId: string; nowIso?: string },
): Promise<FieldActionProducerResult> {
  const learnerUserId = typeof params.learnerUserId === "string" ? params.learnerUserId.trim() : "";
  const eventId = typeof params.eventId === "string" ? params.eventId.trim() : "";
  if (!learnerUserId || !eventId) return { ok: false, code: "progress_not_found" };

  // 1. Confirm the learner OWNS a COMPLETED progress for this event (server truth).
  const { data: progress, error: progErr } = await admin
    .from("foundry_event_training_progress")
    .select("id, event_id, linked_user_id, completed_at")
    .eq("event_id", eventId)
    .eq("linked_user_id", learnerUserId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (progErr) return { ok: false, code: "load_failed" };
  if (!progress) return { ok: false, code: "progress_not_found" };

  const progressId = String((progress as { id: string }).id);
  const sessionId = `field_action:${progressId}`;

  // 2. Idempotency: return the existing Field Action for this (learner, progress) if any.
  const { data: existing, error: exErr } = await admin
    .from("bty_action_contracts")
    .select(FIELD_ACTION_COLS)
    .eq("user_id", learnerUserId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (exErr) return { ok: false, code: "load_failed" };
  if (existing) return { ok: true, contract: projectContract(existing as Record<string, unknown>), created: false };

  // 3. Module title = honest source context for contract_description (NOT a fabricated action).
  const { data: eventRow } = await admin
    .from("foundry_events")
    .select("id, title")
    .eq("id", eventId)
    .maybeSingle();
  const moduleTitle =
    typeof (eventRow as { title?: string } | null)?.title === "string" && (eventRow as { title: string }).title.trim() !== ""
      ? (eventRow as { title: string }).title.trim().slice(0, 80)
      : "Foundry learning";

  const nowIso = params.nowIso ?? new Date().toISOString();
  const deadlineAt = new Date(Date.parse(nowIso) + FIELD_ACTION_DEFAULT_WINDOW_HOURS * 3600 * 1000).toISOString();

  // 4. Insert the NON-ARENA draft. No arena_runs, no pattern_family, no scenario/choice.
  const insertRow = {
    user_id: learnerUserId,
    session_id: sessionId,
    contract_description: moduleTitle,
    deadline_at: deadlineAt,
    action_id: `field_action:${progressId}`,
    action_type: FIELD_ACTION_ACTION_TYPE,
    le_activation_type: "field_application",
    verification_type: "action_completed",
    weight: 1.0,
    mode: "field",
    chosen_at: nowIso,
    status: "draft",
    verification_mode: "hybrid",
    verification_tier: "mvp_open",
    verification_status: "pending",
    details: { source: { kind: FIELD_ACTION_SOURCE_KIND, event_id: eventId, progress_id: progressId } },
  };

  const { data: inserted, error: insErr } = await admin
    .from("bty_action_contracts")
    .insert(insertRow)
    .select(FIELD_ACTION_COLS)
    .single();

  if (!insErr && inserted) {
    return { ok: true, contract: projectContract(inserted as Record<string, unknown>), created: true };
  }

  // 23505 → a concurrent producer won the (user_id, session_id) race; return that row.
  if ((insErr as { code?: string } | null)?.code === "23505") {
    const { data: again } = await admin
      .from("bty_action_contracts")
      .select(FIELD_ACTION_COLS)
      .eq("user_id", learnerUserId)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (again) return { ok: true, contract: projectContract(again as Record<string, unknown>), created: false };
  }
  console.error("[fieldActionProducer] insert failed", {
    learner: learnerUserId.slice(0, 8),
    event: eventId.slice(0, 8),
    code: (insErr as { code?: string } | null)?.code ?? null,
  });
  return { ok: false, code: "insert_failed" };
}

/**
 * Load an existing Field Action contract by id, owner-scoped, asserting `action_type='field_action'`.
 * Used for the resubmission prefill (Today "Needs revision" → focused form).
 */
export async function loadFieldActionContract(
  admin: SupabaseClient,
  params: { learnerUserId: string; contractId: string },
): Promise<FieldActionProducerResult> {
  const learnerUserId = typeof params.learnerUserId === "string" ? params.learnerUserId.trim() : "";
  const contractId = typeof params.contractId === "string" ? params.contractId.trim() : "";
  if (!learnerUserId || !contractId) return { ok: false, code: "not_owner" };

  const { data, error } = await admin
    .from("bty_action_contracts")
    .select(FIELD_ACTION_COLS)
    .eq("id", contractId)
    .eq("user_id", learnerUserId)
    .maybeSingle();
  if (error) return { ok: false, code: "load_failed" };
  if (!data) return { ok: false, code: "not_owner" };
  if (String((data as { action_type?: string }).action_type) !== FIELD_ACTION_ACTION_TYPE) {
    return { ok: false, code: "not_owner" };
  }
  return { ok: true, contract: projectContract(data as Record<string, unknown>), created: false };
}
