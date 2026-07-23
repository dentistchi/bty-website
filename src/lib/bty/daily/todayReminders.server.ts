/**
 * Today Reminders (server) — deterministic projection over canonical system truth (Slice 3.1B-3J).
 *
 * OWNER-SCOPED. Reads ONLY sources with a canonical owner-scoped read (measured Phase 0):
 *   REQUIRED_LEARNING — bty_foundry_list_my_assignments (status='assigned' = incomplete; NO due date)
 *   ACTION_DUE        — bty_action_contracts.deadline_at (open contracts; due/overdue/upcoming)
 *   PRACTICE_DUE      — arena_pending_outcomes.scheduled_for (pending re-exposure; due/overdue/upcoming)
 *   FOLLOW_UP_DUE     — foundry_participant_followups.due_at (Slice 3.1B-3K; PENDING obligations; the
 *                       deadline was materialized ONCE at creation and is only READ here — never
 *                       recomputed. V1 emits due_today / overdue only, no upcoming.)
 * REVIEW_DUE is still deliberately NOT built — no canonical dated per-participant source exists, and
 * the engine must never invent a deadline. Fail-soft per source (a read error → []).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyDue,
  dedupeReminders,
  sortReminders,
  type TodayReminder,
} from "@/domain/daily/todayReminders";
import { classifyFollowUpDue } from "@/domain/foundry/followup/followUpObligation";

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
      // Stay INSIDE the current 5-tab app shell (Slice 3.1B-3L device-gate fix). The legacy
      // `/${locale}/bty-arena` standalone route rendered a second Center/Arena/Foundry/My-Page nav +
      // old practice cards (a shell escape). The in-shell Arena tab is the canonical current surface;
      // there is no focused Action-Contract surface in-shell yet (a future slice would add
      // `?tab=arena&action=<id>`), so the smallest honest target is the Arena tab.
      canonicalDeepLink: `/${locale}/app?tab=arena`,
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
      // In-shell Arena tab (the practice player), never the legacy `/${locale}/bty-arena` standalone
      // route (Slice 3.1B-3L device-gate fix — same shell-escape root cause as ACTION_DUE).
      canonicalDeepLink: `/${locale}/app?tab=arena`,
    }));
  } catch {
    return [];
  }
}

/** Localized checkpoint eyebrow for a follow-up obligation (server-side; matches other title fallbacks). */
function followUpCheckpointLabel(followUpDays: number, locale: string): string {
  if (locale === "ko") return followUpDays === 30 ? "30일 후 확인" : "7일 후 확인";
  return followUpDays === 30 ? "30-day follow-up" : "7-day follow-up";
}

/**
 * FOLLOW_UP_DUE (Slice 3.1B-3K) — pending per-participant follow-up obligations whose materialized
 * due_at is due_today or overdue. Reads the owner's rows directly (service-role, owner-scoped by
 * user_id_snapshot), classifies against the CURRENT reader tz (like Action/Practice), and DROPS
 * anything upcoming (V1 shows no future follow-up). The title carries the localized checkpoint +
 * the source training title; the deep link opens the focused follow-up response surface.
 */
async function followUpDue(admin: SupabaseClient, userId: string, now: Date, tz: string, locale: string): Promise<TodayReminder[]> {
  try {
    const { data } = await admin
      .from("foundry_participant_followups")
      .select("id, source_training_title, follow_up_days, due_at, status")
      .eq("user_id_snapshot", userId)
      .eq("status", "PENDING")
      .not("due_at", "is", null);
    return (data ?? [])
      .map((r: { id: string; source_training_title: string | null; follow_up_days: number; due_at: string }): TodayReminder => ({
        stableId: `followup:${r.id}`,
        category: "FOLLOW_UP_DUE",
        title: `${followUpCheckpointLabel(r.follow_up_days, locale)} · ${r.source_training_title ?? "Foundry training"}`,
        state: classifyFollowUpDue(r.due_at, now, tz),
        sourceTimestamp: r.due_at,
        roleContext: "learner",
        canonicalDeepLink: `/${locale}/app?tab=foundry&followup=${r.id}`,
      }))
      .filter((r: TodayReminder) => r.state === "overdue" || r.state === "due_today"); // V1: no upcoming
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
  const [req, action, practice, followUp] = await Promise.all([
    requiredLearning(admin, userId, locale),
    actionDue(admin, userId, now, tz, locale),
    practiceDue(admin, userId, now, tz, locale),
    followUpDue(admin, userId, now, tz, locale),
  ]);
  return sortReminders(dedupeReminders([...req, ...action, ...practice, ...followUp], suppressStableIds));
}
