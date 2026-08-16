/**
 * Today Reminders (server) — deterministic projection over canonical system truth (Slice 3.1B-3J).
 *
 * OWNER-SCOPED. Reads ONLY sources with a canonical owner-scoped read (measured Phase 0):
 *   REQUIRED_LEARNING — bty_foundry_list_my_assignments (status='assigned' = incomplete; NO due date)
 *   ACTION_DUE        — bty_action_contracts.deadline_at (open contracts; due/overdue/upcoming)
 *   PRACTICE_DUE      — arena_pending_outcomes.scheduled_for (pending re-exposure; due/overdue/upcoming)
 *   APPLY_DUE         — foundry_participant_apply_windows (Slice 3.2R-R2; the learner's OWN recorded
 *                       Action Decision, live for its 7-day window. Visible from the FIRST day —
 *                       it deliberately does NOT copy FOLLOW_UP_DUE's V1 "no upcoming" filter,
 *                       because a commitment nobody can see until its deadline is not a commitment.
 *                       Suppressed once the matching follow-up is asking; never deleted.)
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
import {
  classifyFollowUpDue,
  classifyFollowUpTodayAttention,
  isFollowUpEligibleForToday,
  type FollowUpStatus,
} from "@/domain/foundry/followup/followUpObligation";
import { listMyLearningRecordIds } from "@/lib/bty/foundry/events/learnerEvidenceService";
import { suppressApplyWindow } from "@/domain/foundry/apply-window/applyWindow";
import { listMyApplyWindows } from "@/lib/bty/foundry/events/foundryApplyWindowService";
import {
  classifyActionContract,
  sortActionStatus,
  type ActionStatusItem,
  type ActionStatusState,
} from "@/domain/daily/actionStatus";

// Reminder-side Action statuses ONLY (Slice 3.1B-3M): pending → ACTION_DUE (may be overdue), rejected →
// ACTION_REVISION (needs_revision). submitted/escalated are NOT reminders — they render in the separate
// calm actionStatus section (buildActionStatus). approved/missed/draft/committed never emit into Today.
const REMINDER_CONTRACT_STATUSES = ["pending", "rejected"] as const;
const ACTION_STATUS_CONTRACT_STATUSES = ["submitted", "escalated"] as const;

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

/**
 * Reminder-side Action Contracts (Slice 3.1B-3M): ONLY `pending` (ACTION_DUE, deadline-classified) and
 * `rejected` (ACTION_REVISION, needs_revision). A `submitted` contract past deadline is NEVER surfaced
 * here as red "overdue" — the learner already acted (it moves to the calm actionStatus section). Stays
 * in-shell (`/${locale}/app?tab=arena`; no legacy `/bty-arena` escape, no focused-contract surface yet).
 */
async function actionDue(admin: SupabaseClient, userId: string, now: Date, tz: string, locale: string): Promise<TodayReminder[]> {
  try {
    const { data } = await admin
      .from("bty_action_contracts")
      .select("id, contract_description, deadline_at, status, revision_note, action_type")
      .eq("user_id", userId)
      .in("status", REMINDER_CONTRACT_STATUSES as unknown as string[])
      .not("deadline_at", "is", null);
    const out: TodayReminder[] = [];
    for (const r of (data ?? []) as Array<{ id: string; contract_description: string | null; deadline_at: string; status: string; revision_note: string | null; action_type: string | null }>) {
      const bucket = classifyActionContract(r.status);
      const title = (r.contract_description ?? "Action commitment").slice(0, 120);
      if (bucket === "action_due") {
        // Field Actions Focused Surface V1: a field_action opens the FOCUSED Field Actions subview
        // under Practice (never generic Today); an arena contract keeps the in-shell Arena tab.
        const dueDeepLink =
          r.action_type === "field_action"
            ? `/${locale}/app?tab=practice&fieldAction=${r.id}`
            : `/${locale}/app?tab=arena`;
        out.push({
          stableId: `action:${r.id}`,
          category: "ACTION_DUE",
          title,
          state: classifyDue(r.deadline_at, now, tz),
          sourceTimestamp: r.deadline_at,
          roleContext: "learner",
          canonicalDeepLink: dueDeepLink,
        });
      } else if (bucket === "action_revision") {
        // The Host's revision note is owner-scoped learner-facing feedback (never AI, never a
        // guess). Carried only for this rejected contract's owner.
        const note = typeof r.revision_note === "string" && r.revision_note.trim() !== "" ? r.revision_note.trim() : null;
        // Field Actions Focused Surface V1: a rejected field_action opens the FOCUSED Field Actions
        // subview under Practice (edit + resubmit there); an arena contract keeps the in-shell Arena tab.
        const canonicalDeepLink =
          r.action_type === "field_action"
            ? `/${locale}/app?tab=practice&fieldAction=${r.id}`
            : `/${locale}/app?tab=arena`;
        out.push({
          stableId: `action:${r.id}`,
          category: "ACTION_REVISION",
          title,
          state: "needs_revision", // by stored status, never a deadline-derived "overdue"
          sourceTimestamp: r.deadline_at,
          roleContext: "learner",
          canonicalDeepLink,
          note,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Secondary Action-status projection (Slice 3.1B-3M) — `submitted` (verification_pending) and
 * `escalated` (awaiting_resolution) contracts the learner already acted on. SEPARATE from reminders;
 * never red "overdue", never asks the learner to redo the action. Owner-scoped by user_id. Shown
 * regardless of deadline (originalDeadline is displayed, never a fabricated submission date). No
 * canonical source-title resolution in V1 → sourceTitle stays null (never a guess). Fail-soft.
 */
export async function buildActionStatus(admin: SupabaseClient, userId: string, locale: string): Promise<ActionStatusItem[]> {
  if (!userId) return [];
  try {
    const { data } = await admin
      .from("bty_action_contracts")
      .select("id, contract_description, deadline_at, status, pattern_family, action_type")
      .eq("user_id", userId)
      .in("status", ACTION_STATUS_CONTRACT_STATUSES as unknown as string[]);
    const items: ActionStatusItem[] = [];
    for (const r of (data ?? []) as Array<{ id: string; contract_description: string | null; deadline_at: string | null; status: string; pattern_family: string | null; action_type: string | null }>) {
      const bucket = classifyActionContract(r.status);
      if (bucket !== "verification_pending" && bucket !== "awaiting_resolution") continue;
      items.push({
        stableId: `actionstatus:${r.id}`,
        contractId: r.id,
        // Field Actions Focused Surface V1: carry the canonical discriminator so the focused
        // Field Actions view can scope "Awaiting review" to field_action contracts only.
        actionType: r.action_type,
        status: bucket as ActionStatusState,
        title: (r.contract_description ?? "Action commitment").slice(0, 120),
        patternFamily: r.pattern_family ?? "",
        sourceTitle: null, // canonical source-title resolution deferred (Slice 3.1B-3M.1); never guess
        originalDeadline: r.deadline_at,
        // Honest interim: opens the in-shell Arena surface, NOT the exact contract (no focused surface yet).
        deepLink: `/${locale}/app?tab=arena`,
      });
    }
    return sortActionStatus(items);
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
 * FOLLOW_UP_DUE (Slice 3.1B-3K) — pending per-participant follow-up obligations Today is still
 * asking about. Reads the owner's rows directly (service-role, owner-scoped by user_id_snapshot),
 * classifies against the CURRENT reader tz (like Action/Practice). The title carries the localized
 * checkpoint + the source training title; the deep link opens the focused follow-up response surface.
 *
 * TODAY IS NOT A PERMANENT UNRESOLVED-RECORD INBOX (Slice 3.2R-R3-R2).
 *
 * V1 showed every PENDING row that was due_today or overdue, with no upper bound — so four live
 * obligations had been sitting at STATE_RANK 0 for up to nineteen days, above genuinely urgent
 * work, asking a question the learner had already declined to answer twenty times. The Founder
 * decision bounds the ASKING, not the obligation: due day through due day + 7, inclusive.
 *
 * THREE THINGS THIS DELIBERATELY DOES NOT DO:
 *   * It does not write. Becoming stale is a read-time projection change and nothing else — no
 *     status change, no NOT_YET, no "missed", no updated_at touch. The row is still PENDING with a
 *     null outcome the instant after it leaves Today, and would come back if the window changed.
 *   * It does not redefine `state`. That is still `classifyFollowUpDue`, so a row that survives at
 *     day 5 still truthfully reports "overdue" and still sorts as overdue. The stale row leaves by
 *     ELIGIBILITY, not by being quietly ranked below everything else — a card that is still
 *     rendered but never seen is the same defect with better manners.
 *   * It does not strand the learner. That is not an aspiration here — it is a PRECONDITION Today
 *     checks before letting go; see the reachability gate below.
 *
 * REACHABILITY OUTRANKS ATTENTION EXPIRATION (Slice 3.2R-R3-R2-R1).
 *
 * The paragraph above once ended "My Learning carries the durable followup id onward", stated as
 * though it were always true. Measurement found it is not: follow-up `124f5430` is 19 days past due
 * on a completion whose `linked_user_id` is NULL — an anonymous, unclaimed row that My Learning has
 * never listed and cannot list. And there is no third door: the ONLY producers of a `?followup=`
 * target in the product are this reminder and the two My Learning CTAs. Suppressing that row would
 * have deleted the learner's last path to a durable unanswered obligation.
 *
 * So Today now proves the alternate route before it stops asking, by consulting the SAME rule that
 * decides what My Learning renders (`listMyLearningRecordIds`) rather than inventing an identity
 * test of its own — a second copy of "which records are mine" would eventually disagree with the
 * surface it is predicting, and the failure would be silent. A stale obligation with no provable
 * door stays here: noisy and honest beats quiet and lost, until the unclaimed-completion identity
 * gap is closed in its own slice.
 */
async function followUpDue(admin: SupabaseClient, userId: string, now: Date, tz: string, locale: string): Promise<TodayReminder[]> {
  try {
    const { data } = await admin
      .from("foundry_participant_followups")
      .select("id, progress_id, source_training_title, follow_up_days, due_at, status")
      .eq("user_id_snapshot", userId)
      .eq("status", "PENDING")
      .not("due_at", "is", null);
    const rows = (data ?? []) as Array<{
      id: string;
      progress_id: string | null;
      source_training_title: string | null;
      follow_up_days: number;
      due_at: string;
      status: FollowUpStatus;
    }>;

    /*
      The reachability read happens ONLY if something is actually stale. In the ordinary case —
      every obligation answered or inside its window — this costs nothing, which is what keeps the
      amendment free for the learners it does not concern.
    */
    const attentionOf = new Map(rows.map((r) => [r.id, classifyFollowUpTodayAttention(r.status, r.due_at, now, tz)]));
    const reachable = [...attentionOf.values()].some((a) => a === "stale")
      ? await listMyLearningRecordIds(admin, userId)
      : new Set<string>();

    return rows
      .filter(
        // Filtered BEFORE projection: an ineligible obligation should never be built into a
        // reminder at all, so no later edit can accidentally let one past the shape it was given.
        // A row with no `progress_id` can have no My Learning record, so it is unreachable and
        // kept — the fail-safe direction, never an assumption of a door.
        (r) =>
          isFollowUpEligibleForToday(
            attentionOf.get(r.id) ?? "upcoming",
            r.progress_id !== null && reachable.has(r.progress_id),
          ),
      )
      .map((r: { id: string; source_training_title: string | null; follow_up_days: number; due_at: string }): TodayReminder => ({
        stableId: `followup:${r.id}`,
        category: "FOLLOW_UP_DUE",
        title: `${followUpCheckpointLabel(r.follow_up_days, locale)} · ${r.source_training_title ?? "Foundry training"}`,
        state: classifyFollowUpDue(r.due_at, now, tz),
        sourceTimestamp: r.due_at,
        roleContext: "learner",
        canonicalDeepLink: `/${locale}/app?tab=foundry&followup=${r.id}`,
      }));
  } catch {
    return [];
  }
}


/**
 * APPLY_DUE (Slice 3.2R-R2) — the learner's own Action Decision, live in real work.
 *
 * THREE THINGS THIS DELIBERATELY DOES NOT DO:
 *   * It does not filter out non-due items. FOLLOW_UP_DUE drops everything but due/overdue, which
 *     is right for a checkpoint and wrong for a window: the whole point is that the decision is
 *     visible from the day it is made.
 *   * It does not mark anything done. There is no completion write on this path and no state the
 *     learner can set. APPLIED belongs to the follow-up.
 *   * It does not read private text. The decision sentence is joined from the owner-scoped
 *     progress row, which already carries it Host-visibly by settled 3.2M-1 design; no reflection
 *     column is selected here, ever.
 *
 * SUPPRESSION. Once the matching follow-up for the SAME progress row is asking (due today or
 * overdue) or has been answered, the follow-up is the item that can record something, so the
 * window steps aside. That is a read-time rule — the row is never deleted.
 */
async function applyDue(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  tz: string,
  locale: string,
): Promise<TodayReminder[]> {
  try {
    const windows = await listMyApplyWindows(admin, userId, now, tz);
    if (windows.length === 0) return [];

    // The follow-up state for these same progress rows — the suppression input.
    const progressIds = windows.map((w) => w.progressId).filter((v): v is string => Boolean(v));
    const asking = new Set<string>();
    const responded = new Set<string>();
    if (progressIds.length > 0) {
      const { data } = await admin
        .from("foundry_participant_followups")
        .select("progress_id, status, due_at")
        .eq("user_id_snapshot", userId)
        .in("progress_id", progressIds);
      for (const f of (data ?? []) as Array<{ progress_id: string | null; status: string; due_at: string }>) {
        if (!f.progress_id) continue;
        if (f.status === "RESPONDED") responded.add(f.progress_id);
        else {
          const due = classifyFollowUpDue(f.due_at, now, tz);
          if (due === "overdue" || due === "due_today") asking.add(f.progress_id);
        }
      }
    }

    // The learner's own decision sentence, owner-scoped. Explicit allow-list: the two private
    // columns are not named in this select and cannot reach Today.
    const decisionByProgress = new Map<string, string>();
    if (progressIds.length > 0) {
      const { data } = await admin
        .from("foundry_event_training_progress")
        .select("id, decision_response_text")
        .eq("linked_user_id", userId)
        .in("id", progressIds);
      for (const p of (data ?? []) as Array<{ id: string; decision_response_text: string | null }>) {
        const d = (p.decision_response_text ?? "").trim();
        if (d) decisionByProgress.set(p.id, d);
      }
    }

    const out: TodayReminder[] = [];
    for (const w of windows) {
      if (w.state === "pending") continue; // not open yet — unreachable in V1, honest anyway
      /*
        A CLOSED WINDOW LEAVES TODAY (Slice 3.2R-R2).

        `overdue` is the truthful classification, and it is deliberately NOT projected. Two
        measured reasons, both of which would have shipped as defects:

          1. `sortReminders` ranks by STATE, not category, so an overdue window would sit at rank 0
             — above genuinely urgent work — while rendering the calm "Window closed" chip. Today
             would be shouting and whispering at the same time.
          2. It would never leave. Suppression is driven by the FOLLOW-UP, so a training with
             followUpDays = 0 has nothing to hand off to, and a training with a 30-day checkpoint
             leaves a three-week gap. Either way the card stays forever, which is precisely the
             outcome this slice was told not to produce.

        So Today shows the window while it is LIVE (`active`, `due_today`) and stops. The row is
        never deleted, the decision stays permanently in My Learning with its DECIDED chip, and the
        follow-up still asks what happened. What a closed-but-unanswered window should do when no
        follow-up is configured is a real product question, reported rather than invented here.
      */
      if (w.state === "overdue") continue;
      const pid = w.progressId;
      if (pid && suppressApplyWindow({ followUpIsAsking: asking.has(pid), followUpResponded: responded.has(pid) })) {
        continue;
      }
      // The learner's own sentence IS the title — that is the whole product idea. Without it there
      // is nothing to carry into the day, so a window whose decision cannot be read is not shown.
      const decision = pid ? decisionByProgress.get(pid) : undefined;
      if (!decision) continue;
      out.push({
        stableId: `apply:${w.id}`,
        category: "APPLY_DUE",
        title: decision.slice(0, 200),
        state: w.state, // active | due_today | overdue — never invented, always day-granular
        sourceTimestamp: w.dueAtIso,
        roleContext: "learner",
        // Back to the learner's own record of the decision, in-shell. Never Arena.
        canonicalDeepLink: `/${locale}/app?tab=me&view=my-learning&entry=${encodeURIComponent(pid ?? "")}`,
        note: w.sourceTrainingTitle,
      });
    }
    return out;
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
  const [req, action, practice, apply, followUp] = await Promise.all([
    requiredLearning(admin, userId, locale),
    actionDue(admin, userId, now, tz, locale),
    practiceDue(admin, userId, now, tz, locale),
    applyDue(admin, userId, now, tz, locale),
    followUpDue(admin, userId, now, tz, locale),
  ]);
  return sortReminders(dedupeReminders([...req, ...action, ...practice, ...apply, ...followUp], suppressStableIds));
}
