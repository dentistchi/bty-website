/**
 * BTY Today Intelligence v1 — read-only service assembly (STEP 7B).
 *
 * READ-PURE orchestrator: reads the authoritative daily gate + the user's most-recent
 * active pattern axis, then delegates ALL interpretation to the pure domain deriver
 * ({@link deriveTodayIntelligence}). No writes, no LLM, no schema touch.
 *
 * Purity (verified): every reused function is pure-read —
 *  - evaluateDailyGate               — read; passive daily open triggers no write
 *  - fetchUserPatternSignaturesForMyPage — read; plain select, RLS `select_own`
 * Deliberately does NOT use any LE GET endpoint with an `ensure*` write side effect.
 *
 * Fail-soft: any throw degrades to a clean-start `read_error` brief so Today never
 * white-screens. The `read_error` mode is code-internal only and MUST NOT surface as UI copy.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import {
  deriveTodayIntelligence,
  type TodayIntelligence,
  type AxisRecency,
} from "@/domain/daily/todayIntelligence";
import { evaluateDailyGate } from "@/lib/bty/daily/dailyGateCheck";
import { fetchUserPatternSignaturesForMyPage } from "@/lib/bty/arena/fetchUserPatternSignatures.server";

const WINDOW_DAYS = 14;

/** profile tz if a valid IANA id, else UTC. Never throws (mirrors dailyGateCheck). */
async function resolveUserTzQuiet(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("arena_profiles")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle();
    const tz = (data as { timezone?: string | null } | null)?.timezone;
    if (typeof tz === "string" && tz.length > 0) {
      new Intl.DateTimeFormat("en-US", { timeZone: tz }); // validate IANA (throws on unknown)
      return tz;
    }
  } catch {
    /* profile tz unavailable → UTC fallback */
  }
  return "UTC";
}

/**
 * Most-recent active pattern axis + its recency vs the user-day windows, or null when
 * there is no active signature or it is older than the {@link WINDOW_DAYS} window (stale).
 * Recency: within the yesterday window (or fresher) → "yesterday"; within 14d → "window".
 */
async function resolveRecentAxis(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
  tz: string,
): Promise<{ axis: string; recency: AxisRecency } | null> {
  const res = await fetchUserPatternSignaturesForMyPage(supabase, userId);
  if (!res.ok || res.rows.length === 0) return null;
  const top = res.rows[0]; // ordered by last_seen_at desc, current_state active/unstable
  const axis = top.axis?.trim();
  if (!axis) return null;

  const lastSeen = new Date(top.last_seen_at);
  if (Number.isNaN(lastSeen.getTime())) return null;

  const todayStart = userDayStartInstant(now, tz, 5);
  const yesterdayStart = userDayStartInstant(new Date(todayStart.getTime() - 1), tz, 5);
  const windowStart = new Date(todayStart.getTime() - WINDOW_DAYS * 86_400_000);

  if (lastSeen >= yesterdayStart) return { axis, recency: "yesterday" };
  if (lastSeen >= windowStart) return { axis, recency: "window" };
  return null; // stale → no derivation
}

/**
 * Build the Today Intelligence v1 brief for a user. Read-only; fail-soft to a clean-start
 * `read_error` brief on any failure.
 */
export async function buildTodayIntelligence(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<TodayIntelligence> {
  try {
    const tz = await resolveUserTzQuiet(supabase, userId);
    const snapshot = await evaluateDailyGate(supabase, userId, now, tz);
    const recentAxis = await resolveRecentAxis(supabase, userId, now, tz);
    return deriveTodayIntelligence({
      gate: snapshot.gate,
      blockingContractStatus: snapshot.context?.contractStatus ?? null,
      recentAxis,
    });
  } catch (e) {
    console.warn(
      "[today-intelligence] degraded → clean start:",
      e instanceof Error ? e.message : e,
    );
    return deriveTodayIntelligence({ gate: "OPEN_DAY", readError: true });
  }
}
