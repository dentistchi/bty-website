import type { SupabaseClient } from "@supabase/supabase-js";
import { FIELD_ACTION_INVENTORY_STATUSES } from "@/domain/action-contract/fieldActionGroup";

/**
 * Canonical learner Field Action inventory (Practice → Field Actions V1).
 *
 * Returns EVERY field_action contract OWNED by the authenticated learner in a canonical lifecycle
 * status — independent of Today ranking, due date, reminder eligibility, or whether the action is the
 * primary CTA. This closes the gap where a `submitted` contract was visible in the Host reviewer queue
 * but absent from the learner surface (the old surface derived learner state from the Today brief,
 * a priority/reminder projection, not an inventory).
 *
 * Authorization: owner-scoped by `user_id = <authenticated caller>` (the route passes `user.id`; the
 * client can never supply it). Read-only; writes NOTHING; explicit column allow-list (never select('*')),
 * no reviewer identity, no audit/reflection columns. Fail-soft: any error → the caller decides (the
 * route surfaces a non-200 so the UI can show its explicit error state rather than a silent empty).
 */

/** Explicit column allow-list — learner-owned fields only; NO reviewer/audit/reflection columns. */
const INVENTORY_COLS =
  "id, action_type, status, who, what, how, step_when, contract_description, revision_note, submitted_at, reviewed_at, verified_at, created_at";

export type MyFieldAction = {
  /** Canonical identity for dedup + React key + safe deep linking (the contract PK). */
  contractId: string;
  actionType: string | null;
  status: string | null;
  who: string | null;
  what: string | null;
  how: string | null;
  stepWhen: string | null;
  contractDescription: string | null;
  /** Host revision note (learner-facing) for a rejected contract; null otherwise. */
  revisionNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  verifiedAt: string | null;
  createdAt: string | null;
};

type Row = {
  id: string;
  action_type: string | null;
  status: string | null;
  who: string | null;
  what: string | null;
  how: string | null;
  step_when: string | null;
  contract_description: string | null;
  revision_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  verified_at: string | null;
  created_at: string | null;
};

/**
 * The caller's own field_action contracts across the canonical lifecycle, newest first. Throws on a
 * query error so the route can return a non-200 (the UI needs error≠empty). Returns [] for a blank uid.
 */
export async function listMyFieldActions(admin: SupabaseClient, userId: string): Promise<MyFieldAction[]> {
  const uid = (userId ?? "").trim();
  if (!uid) return [];
  const { data, error } = await admin
    .from("bty_action_contracts")
    .select(INVENTORY_COLS)
    .eq("user_id", uid)
    .eq("action_type", "field_action")
    .in("status", FIELD_ACTION_INVENTORY_STATUSES as unknown as string[])
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listMyFieldActions: ${error.message}`);
  return ((data ?? []) as Row[]).map((r) => ({
    contractId: r.id,
    actionType: r.action_type,
    status: r.status,
    who: r.who,
    what: r.what,
    how: r.how,
    stepWhen: r.step_when,
    contractDescription: r.contract_description,
    revisionNote: typeof r.revision_note === "string" && r.revision_note.trim() !== "" ? r.revision_note.trim() : null,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at,
    verifiedAt: r.verified_at,
    createdAt: r.created_at,
  }));
}
