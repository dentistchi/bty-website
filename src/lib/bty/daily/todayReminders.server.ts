/**
 * Today Reminders (server) — deterministic projection over canonical system truth (Slice 3.1B-3J).
 *
 * OWNER-SCOPED. Reads ONLY sources with a canonical owner-scoped read (measured Phase 0):
 *   REQUIRED_LEARNING — bty_foundry_list_my_assignments (status='assigned' = incomplete; NO due date)
 *   ACTION_DUE        — bty_action_contracts.deadline_at (open contracts; due/overdue/upcoming)
 *   PRACTICE_DUE      — arena_pending_outcomes.scheduled_for (pending re-exposure; due/overdue/upcoming)
 * FOLLOW_UP_DUE / REVIEW_DUE are deliberately NOT built — no canonical dated per-participant source
 * exists, and the engine must never invent a deadline. Fail-soft per source (a read error → []).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyDue,
  dedupeReminders,
  sortReminders,
  type TodayReminder,
} from "@/domain/daily/todayReminders";

const OPEN_CONTRACT_STATUSES = ["pending", "submitted", "rejected", "escalated"] as const;

async function requiredLearning(admin: SupabaseClient, userId: string, locale: string): Promise<TodayReminder[]> {
  try {
    const { data } = await admin.rpc("bty_foundry_list_my_assignments", { p_auth_user_id: userId });
    return (data ?? [])
      .filter((r: { status?: string }) => r.status === "assigned")
      .map((r: { assignment_id: string; title: string | null }): TodayReminder => ({
        stableId: `req:${r.assignment_id}`,
        category: "REQUIRED_LEARNING",
        title: r.title ?? "Required training",
        state: "incomplete_required", // honest: no due-date column exists — never a fake deadline
        sourceTimestamp: null,
        roleContext: "learner",
        canonicalDeepLink: `/${locale}/app?tab=foundry`,
      }));
  } catch {
    return [];
  }
}

async function actionDue(admin: SupabaseClient, userId: string, now: Date, tz: string, locale: string): Promise<TodayReminder[]> {
  try {
    const { data } = await admin
      .from("bty_action_contracts")
      .select("id, contract_description, deadline_at, status")
      .eq("user_id", userId)
      .in("status", OPEN_CONTRACT_STATUSES as unknown as string[])
      .not("deadline_at", "is", null);
    return (data ?? []).map((r: { id: string; contract_description: string | null; deadline_at: string }): TodayReminder => ({
      stableId: `action:${r.id}`,
      category: "ACTION_DUE",
      title: (r.contract_description ?? "Action commitment").slice(0, 120),
      state: classifyDue(r.deadline_at, now, tz),
      sourceTimestamp: r.deadline_at,
      roleContext: "learner",
      canonicalDeepLink: `/${locale}/bty-arena`,
    }));
  } catch {
    return [];
  }
}

async function practiceDue(admin: SupabaseClient, userId: string, now: Date, tz: string, locale: string): Promise<TodayReminder[]> {
  try {
    const { data } = await admin
      .from("arena_pending_outcomes")
      .select("id, outcome_title, scheduled_for, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .not("scheduled_for", "is", null);
    return (data ?? []).map((r: { id: string; outcome_title: string | null; scheduled_for: string }): TodayReminder => ({
      stableId: `practice:${r.id}`,
      category: "PRACTICE_DUE",
      title: r.outcome_title ?? "Practice re-exposure",
      state: classifyDue(r.scheduled_for, now, tz),
      sourceTimestamp: r.scheduled_for,
      roleContext: "learner",
      canonicalDeepLink: `/${locale}/bty-arena`,
    }));
  } catch {
    return [];
  }
}

/**
 * The authenticated caller's deterministic Today reminders, priority-ordered. `suppressStableIds`
 * removes anything already shown as the primary Today path (dedup vs Today Intelligence). Upcoming
 * (dated future) items are kept only because they carry a real timestamp — never a fabricated one.
 */
export async function buildTodayReminders(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  tz: string,
  locale: string,
  suppressStableIds: ReadonlySet<string> = new Set(),
): Promise<TodayReminder[]> {
  if (!userId) return [];
  const [req, action, practice] = await Promise.all([
    requiredLearning(admin, userId, locale),
    actionDue(admin, userId, now, tz, locale),
    practiceDue(admin, userId, now, tz, locale),
  ]);
  return sortReminders(dedupeReminders([...req, ...action, ...practice], suppressStableIds));
}
