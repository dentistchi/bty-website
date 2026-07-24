import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REVIEWED_ACTION_PLAN_ACTION_TYPE,
  REVIEWED_ACTION_PLAN_STATUS,
  compareReviewedActionPlanRecency,
  reviewedActionPlanReviewDate,
  type ReviewedActionPlanDates,
} from "@/domain/arena/reviewedActionPlan";

/**
 * Reviewed Action Plans — learner projection service (Slice 3.1B-3N-5D.1). READ-ONLY.
 *
 * Projects the caller's OWN approved Field Action contracts into "Action plan reviewed
 * & accepted" cards for My Learning. This is a pure read over the existing canonical
 * truth (`bty_action_contracts` + the immutable review audit already stamped `verified_at`)
 * — it writes NOTHING, creates no evidence row, and never touches Arena/AIR/XP/Level or
 * `foundry_participant_followups`. Ownership is the session `userId` (the route resolves it;
 * the client can never supply it). The projection deliberately excludes reviewer identity,
 * audit membership snapshots, private reflection, and any word implying real-world
 * execution — an approved plan is E3 DECIDED + reviewed, NOT Applied/Observed.
 *
 * Module context (title + immutable version) is resolved through the existing durable
 * lineage `details.source.event_id` → `foundry_event_module` (the frozen publish snapshot),
 * never the mutable current draft; missing legacy lineage falls back honestly (no guess).
 */

/** Explicit column allow-list — never select('*'); NO reviewer/audit/reflection columns. */
const REVIEWED_PLAN_COLS =
  "id, action_type, status, who, what, how, step_when, contract_description, reviewed_at, verified_at, completed_at, submitted_at, created_at, details";

type ContractRow = {
  id: string;
  action_type: string | null;
  status: string | null;
  who: string | null;
  what: string | null;
  how: string | null;
  step_when: string | null;
  contract_description: string | null;
  reviewed_at: string | null;
  verified_at: string | null;
  completed_at: string | null;
  submitted_at: string | null;
  created_at: string | null;
  details: unknown;
};

export type ReviewedActionPlanCard = {
  /** Stable identity for dedup + React key (the contract PK). */
  contractId: string;
  who: string | null;
  what: string | null;
  how: string | null;
  stepWhen: string | null;
  /** Honest source context — the Foundry module title (never a fabricated action). */
  moduleTitle: string | null;
  /** The immutable published module version snapshot, or null when lineage is absent. */
  moduleVersion: number | null;
  /** Canonical review date (reviewed → verified → completed); null, never fabricated. */
  reviewedAt: string | null;
};

function sourceEventId(details: unknown): string | null {
  if (details && typeof details === "object") {
    const src = (details as { source?: unknown }).source;
    if (src && typeof src === "object") {
      const ev = (src as { event_id?: unknown }).event_id;
      if (typeof ev === "string" && ev.trim() !== "") return ev;
    }
  }
  return null;
}

/**
 * The caller's approved Field Action plans, newest first. Returns [] when the admin
 * client is unavailable, the user has none, or on read failure (fail-soft: a projection
 * failure must never break My Learning). Deduped by contract id.
 */
export async function listMyReviewedActionPlans(
  admin: SupabaseClient,
  userId: string,
): Promise<ReviewedActionPlanCard[]> {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return [];

  // Eligibility mirrors isReviewedActionPlanEligible: own + field_action + approved + verified.
  const { data: rows, error } = await admin
    .from("bty_action_contracts")
    .select(REVIEWED_PLAN_COLS)
    .eq("user_id", uid)
    .eq("action_type", REVIEWED_ACTION_PLAN_ACTION_TYPE)
    .eq("status", REVIEWED_ACTION_PLAN_STATUS)
    .not("verified_at", "is", null)
    .returns<ContractRow[]>();
  if (error || !rows || rows.length === 0) return [];

  // Dedup by contract id (belt-and-suspenders; id is the PK so rows are already distinct).
  const byId = new Map<string, ContractRow>();
  for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);
  const distinct = [...byId.values()];

  // Resolve the immutable published module version via durable lineage (event_id → snapshot).
  const eventIds = [...new Set(distinct.map((r) => sourceEventId(r.details)).filter((v): v is string => !!v))];
  const versionByEvent = new Map<string, number>();
  if (eventIds.length > 0) {
    const { data: mods } = await admin
      .from("foundry_event_module")
      .select("event_id, module_version")
      .in("event_id", eventIds)
      .returns<{ event_id: string; module_version: number | null }[]>();
    for (const m of mods ?? []) {
      if (typeof m.module_version === "number") versionByEvent.set(m.event_id, m.module_version);
    }
  }

  const cards = distinct.map((r): { contractId: string; dates: ReviewedActionPlanDates; card: ReviewedActionPlanCard } => {
    const dates: ReviewedActionPlanDates = {
      reviewedAt: r.reviewed_at,
      verifiedAt: r.verified_at,
      completedAt: r.completed_at,
      submittedAt: r.submitted_at,
      createdAt: r.created_at,
    };
    const eventId = sourceEventId(r.details);
    const title = (r.contract_description ?? "").trim();
    return {
      contractId: r.id,
      dates,
      card: {
        contractId: r.id,
        who: r.who,
        what: r.what,
        how: r.how,
        stepWhen: r.step_when,
        moduleTitle: title.length > 0 ? title : null,
        moduleVersion: eventId ? versionByEvent.get(eventId) ?? null : null,
        reviewedAt: reviewedActionPlanReviewDate(dates),
      },
    };
  });

  cards.sort((a, b) => compareReviewedActionPlanRecency(a, b));
  return cards.map((c) => c.card);
}
