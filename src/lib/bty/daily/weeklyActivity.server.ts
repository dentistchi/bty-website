import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import { countFirstPublishedRunsInWindow } from "@/domain/daily/yesterdayCreation";

/**
 * Weekly activity — read-only canonical counts for the Me "This week" summary
 * (Slice 3.2C-B3A.2D). The window is the user's last 7 LOCAL BTY days (including
 * today), 05:00 rollover. Fail-soft PER CATEGORY: an unavailable/erroring source
 * yields `undefined` (the UI omits it). Never estimated, never a lifetime total
 * treated as weekly, never one event type approximating another.
 *
 * Canonical sources:
 *   - weeklyPoints        = weekly_xp.xp_total (user, global pool league_id NULL) — the
 *                           current weekly balance (reset weekly; NOT lifetime).
 *   - forgeStage          = arena_profiles.stage (band label, no numerics/reason codes).
 *   - activeDays          = user_day rows in the 7-day window by opened_at (self-return presence;
 *                           user_day has no created_at — opened_at is the canonical presence stamp).
 *   - trainingsCompleted  = foundry_event_training_progress.completed_at in window (linked user).
 *   - trainingsCreated    = Programs whose FIRST owned Run was created in window (Run lineage).
 *   - centerReflections   = dear_me_letters in window.
 *   - actionPlansCompleted= bty_action_contracts action_type='field_action' status='approved'
 *                           (the completed/verified state) with reviewed_at in window.
 *   - eventsParticipated  = the user's OWN bty_event_participation rows with scanned_at in window
 *                           (Slice 3.2F: the participant's verified Reality Event presence, made
 *                           visible in their own week). Attendance/presence only — never Core-XP.
 * Writes nothing.
 */

export type WeeklySummary = {
  weeklyPoints?: number;
  forgeStage?: number;
  activeDays?: number;
  trainingsCompleted?: number;
  trainingsCreated?: number;
  centerReflections?: number;
  actionPlansCompleted?: number;
  eventsParticipated?: number;
};

async function safeCount(p: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | undefined> {
  try {
    const { count, error } = await p;
    return error ? undefined : count ?? 0;
  } catch {
    return undefined;
  }
}
async function safeScalar(p: PromiseLike<{ data: unknown; error: unknown }>, col: string): Promise<number | undefined> {
  try {
    const { data, error } = await p;
    if (error || data == null || typeof data !== "object") return undefined;
    const v = (data as Record<string, unknown>)[col];
    return typeof v === "number" ? v : undefined;
  } catch {
    return undefined;
  }
}

const DAY_MS = 24 * 3600 * 1000;

export async function loadWeeklyActivity(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  deviceTz: string | null,
): Promise<WeeklySummary> {
  const { timezone } = await resolveUserTzContext(admin, userId, deviceTz);
  const todayStart = userDayStartInstant(now, timezone, 5);
  const startInstant = new Date(todayStart.getTime() - 6 * DAY_MS); // 7 days incl. today
  const startIso = startInstant.toISOString();
  const endIso = new Date(todayStart.getTime() + DAY_MS).toISOString();
  const win = (table: string, col = "created_at") =>
    admin.from(table).select("*", { count: "exact", head: true }).gte(col, startIso).lt(col, endIso);

  const runsCreated = (async () => {
    try {
      const { data, error } = await admin.from("foundry_events").select("program_id, created_at").eq("owner_user_id", userId).not("program_id", "is", null);
      if (error) return undefined;
      const runs = (data ?? []).filter((r) => r.program_id).map((r) => ({ programId: r.program_id as string, createdAtMs: Date.parse(r.created_at as string) }));
      return countFirstPublishedRunsInWindow(runs, startInstant.getTime(), todayStart.getTime() + DAY_MS);
    } catch {
      return undefined;
    }
  })();

  const [weeklyPoints, forgeStage, activeDays, trainingsCompleted, trainingsCreated, centerReflections, actionPlansCompleted, eventsParticipated] = await Promise.all([
    safeScalar(admin.from("weekly_xp").select("xp_total").eq("user_id", userId).is("league_id", null).maybeSingle(), "xp_total"),
    safeScalar(admin.from("arena_profiles").select("stage").eq("user_id", userId).maybeSingle(), "stage"),
    safeCount(win("user_day", "opened_at").eq("user_id", userId)),
    safeCount(win("foundry_event_training_progress", "completed_at").eq("linked_user_id", userId)),
    runsCreated,
    safeCount(win("dear_me_letters").eq("user_id", userId)),
    safeCount(win("bty_action_contracts", "reviewed_at").eq("user_id", userId).eq("action_type", "field_action").eq("status", "approved")),
    // The user's OWN verified Reality Event participations (server-scoped by user_id; scanned_at window).
    safeCount(win("bty_event_participation", "scanned_at").eq("user_id", userId)),
  ]);

  return { weeklyPoints, forgeStage, activeDays, trainingsCompleted, trainingsCreated, centerReflections, actionPlansCompleted, eventsParticipated };
}

// ── This Week DETAIL (Slice 3.2C-B3A.2D-R1) ──────────────────────────────────────────────────
// The nested "This Week" surface adds item-level disclosure to the SAME read-only endpoint (no
// second weekly endpoint). Same 7-BTY-day / 05:00 window and the SAME canonical sources as the
// summary above. Privacy invariant: Center reflection BODIES are never selected — only the
// created_at date is read. Fail-soft PER CATEGORY: a category whose query errors is OMITTED
// (undefined); an empty array is a proven canonical zero. No lifetime-as-weekly, no cross-event
// approximation, no fabricated dates.

export type WeeklyDetailItem = { title: string; date: string };
export type WeeklyAttendanceDay = { date: string; active: boolean };
export type WeeklyActivityDetail = {
  summary: WeeklySummary;
  window: { startIso: string; endIso: string };
  /** Exactly 7 BTY days, oldest → today. Present only when the presence query succeeds. */
  attendance?: WeeklyAttendanceDay[];
  learningCompleted?: WeeklyDetailItem[];
  trainingCreated?: WeeklyDetailItem[];
  /** Date only — the reflection BODY is never read/returned (privacy invariant). */
  centerReflections?: { date: string }[];
  actionPlansCompleted?: WeeklyDetailItem[];
  /** The user's OWN Reality Event participations: event title + scanned_at, newest-first (Slice 3.2F).
   *  No event_id / user_id / participation id / token / other participant / XP. */
  eventsParticipated?: WeeklyDetailItem[];
};

function rows(v: { data: unknown; error: unknown }): Array<Record<string, unknown>> {
  if (v.error || !Array.isArray(v.data)) return [];
  return v.data as Array<Record<string, unknown>>;
}
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

export async function loadWeeklyActivityDetail(
  admin: SupabaseClient,
  userId: string,
  now: Date,
  deviceTz: string | null,
): Promise<WeeklyActivityDetail> {
  const summary = await loadWeeklyActivity(admin, userId, now, deviceTz);
  const { timezone } = await resolveUserTzContext(admin, userId, deviceTz);
  const todayStart = userDayStartInstant(now, timezone, 5);
  const startInstant = new Date(todayStart.getTime() - 6 * DAY_MS);
  const startMs = startInstant.getTime();
  const endMs = todayStart.getTime() + DAY_MS;
  const startIso = startInstant.toISOString();
  const endIso = new Date(endMs).toISOString();

  // Attendance — 7 BTY days by opened_at, oldest → today. Omitted only if the query errors (never
  // claim "no activity" from a failed read); an all-inactive result from a successful query is real.
  const attendance = await (async (): Promise<WeeklyAttendanceDay[] | undefined> => {
    try {
      const res = await admin.from("user_day").select("opened_at").eq("user_id", userId).gte("opened_at", startIso).lt("opened_at", endIso);
      if (res.error) return undefined;
      const active = new Set<number>();
      for (const r of rows(res)) {
        const ms = Date.parse(str(r.opened_at));
        if (Number.isNaN(ms)) continue;
        const idx = Math.floor((ms - startMs) / DAY_MS);
        if (idx >= 0 && idx < 7) active.add(idx);
      }
      return Array.from({ length: 7 }, (_, i) => ({ date: new Date(startMs + i * DAY_MS).toISOString(), active: active.has(i) }));
    } catch {
      return undefined;
    }
  })();

  const learningCompleted = await (async (): Promise<WeeklyDetailItem[] | undefined> => {
    try {
      const res = await admin.from("foundry_event_training_progress").select("event_id, completed_at").eq("linked_user_id", userId).gte("completed_at", startIso).lt("completed_at", endIso).order("completed_at", { ascending: false });
      if (res.error) return undefined;
      const list = rows(res);
      const ids = [...new Set(list.map((r) => str(r.event_id)).filter(Boolean))];
      const titles = new Map<string, string>();
      if (ids.length) {
        const ev = await admin.from("foundry_events").select("id, title").in("id", ids);
        for (const e of rows(ev)) titles.set(str(e.id), str(e.title));
      }
      return list.map((r) => ({ title: titles.get(str(r.event_id)) || "Training", date: str(r.completed_at) }));
    } catch {
      return undefined;
    }
  })();

  const trainingCreated = await (async (): Promise<WeeklyDetailItem[] | undefined> => {
    try {
      const res = await admin.from("foundry_events").select("program_id, title, created_at").eq("owner_user_id", userId).not("program_id", "is", null).order("created_at", { ascending: true });
      if (res.error) return undefined;
      const firstByProgram = new Map<string, { title: string; ms: number }>();
      for (const r of rows(res)) {
        const pid = str(r.program_id);
        if (!pid) continue;
        const ms = Date.parse(str(r.created_at));
        if (Number.isNaN(ms)) continue;
        const cur = firstByProgram.get(pid);
        if (!cur || ms < cur.ms) firstByProgram.set(pid, { title: str(r.title) || "Training", ms });
      }
      return [...firstByProgram.values()]
        .filter((v) => v.ms >= startMs && v.ms < endMs)
        .sort((a, b) => b.ms - a.ms)
        .map((v) => ({ title: v.title, date: new Date(v.ms).toISOString() }));
    } catch {
      return undefined;
    }
  })();

  // Center reflections — DATE ONLY. The body/reply/prompt are never selected (privacy invariant).
  const centerReflections = await (async (): Promise<{ date: string }[] | undefined> => {
    try {
      const res = await admin.from("dear_me_letters").select("created_at").eq("user_id", userId).gte("created_at", startIso).lt("created_at", endIso).order("created_at", { ascending: false });
      if (res.error) return undefined;
      return rows(res).map((r) => ({ date: str(r.created_at) }));
    } catch {
      return undefined;
    }
  })();

  const actionPlansCompleted = await (async (): Promise<WeeklyDetailItem[] | undefined> => {
    try {
      const res = await admin.from("bty_action_contracts").select("what, reviewed_at").eq("user_id", userId).eq("action_type", "field_action").eq("status", "approved").gte("reviewed_at", startIso).lt("reviewed_at", endIso).order("reviewed_at", { ascending: false });
      if (res.error) return undefined;
      return rows(res).map((r) => ({ title: str(r.what) || "Action plan", date: str(r.reviewed_at) }));
    } catch {
      return undefined;
    }
  })();

  // Event participations — the user's OWN rows by scanned_at, newest-first; the canonical Event
  // title is resolved through bty_events (FK is ON DELETE CASCADE, so a live participation always
  // has a resolvable event; item-level fail-soft keeps a title miss from fabricating an id).
  const eventsParticipated = await (async (): Promise<WeeklyDetailItem[] | undefined> => {
    try {
      const res = await admin.from("bty_event_participation").select("event_id, scanned_at").eq("user_id", userId).gte("scanned_at", startIso).lt("scanned_at", endIso).order("scanned_at", { ascending: false });
      if (res.error) return undefined;
      const list = rows(res);
      const ids = [...new Set(list.map((r) => str(r.event_id)).filter(Boolean))];
      const titles = new Map<string, string>();
      if (ids.length) {
        const ev = await admin.from("bty_events").select("id, title").in("id", ids);
        for (const e of rows(ev)) titles.set(str(e.id), str(e.title));
      }
      return list.map((r) => ({ title: titles.get(str(r.event_id)) || "Event", date: str(r.scanned_at) }));
    } catch {
      return undefined;
    }
  })();

  return { summary, window: { startIso, endIso }, attendance, learningCompleted, trainingCreated, centerReflections, actionPlansCompleted, eventsParticipated };
}
