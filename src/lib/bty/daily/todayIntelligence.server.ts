/**
 * BTY Today Intelligence — read-only service assembly (STEP 7L).
 *
 * READ-PURE orchestrator: reads the authoritative daily gate, then — for a YESTERDAY_MIRROR
 * day — gathers the SAME yesterday-window evidence that fired the gate (verified/pending
 * action contracts, then per-run pattern signals), plus the stale active/unstable pattern
 * signatures as a low-confidence fallback. All interpretation is delegated to the pure
 * deriver ({@link deriveTodayIntelligence}). No writes, no LLM, no schema touch.
 *
 * Purity (verified): every read is a plain user-scoped select (RLS `select_own`), consistent
 * with evaluateDailyGate's own scan. Deliberately does NOT use any LE GET endpoint with an
 * `ensure*` write side effect. Each source read is fail-quiet (degrades to []).
 *
 * Fail-soft: any throw degrades to a clean-start `read_error` brief so Today never
 * white-screens. `read_error` is code-internal only and MUST NOT surface as UI copy.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import {
  deriveTodayIntelligence,
  type TodayIntelligence,
  type AxisCandidate,
  type WindowEvidenceCandidate,
} from "@/domain/daily/todayIntelligence";
import { evaluateDailyGate } from "@/lib/bty/daily/dailyGateCheck";
import { fetchUserPatternSignaturesForMyPage } from "@/lib/bty/arena/fetchUserPatternSignatures.server";

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

/** Fail-quiet select → rows (or [] on any error/throw). Read-only. */
async function quietRows<T>(
  tag: string,
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) {
      console.warn(`[today-intelligence] ${tag} degraded:`, error.message);
      return [];
    }
    return (data as T[] | null) ?? [];
  } catch (e) {
    console.warn(`[today-intelligence] ${tag} threw:`, e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Same-window evidence candidates, priority-ordered: verified action contracts (verified_at
 * in window) → contracts created in window (pending) → per-run pattern signals. Contracts
 * carry pattern_family (no axis column) → axis resolves via the family fallback; the axis
 * primary path still applies to the stale-signature pool. Read-pure.
 */
async function gatherWindowCandidates(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
  untilIso: string,
): Promise<WindowEvidenceCandidate[]> {
  const verified = await quietRows<{ pattern_family: string | null }>("verified_contracts", () =>
    supabase
      .from("bty_action_contracts")
      .select("pattern_family, verified_at")
      .eq("user_id", userId)
      .gte("verified_at", sinceIso)
      .lt("verified_at", untilIso)
      .order("verified_at", { ascending: false }),
  );
  const created = await quietRows<{ pattern_family: string | null }>("created_contracts", () =>
    supabase
      .from("bty_action_contracts")
      .select("pattern_family, created_at")
      .eq("user_id", userId)
      .gte("created_at", sinceIso)
      .lt("created_at", untilIso)
      .order("created_at", { ascending: false }),
  );
  const signals = await quietRows<{ pattern_family: string | null }>("pattern_signals", () =>
    supabase
      .from("pattern_signals")
      .select("pattern_family, recorded_at")
      .eq("user_id", userId)
      .gte("recorded_at", sinceIso)
      .lt("recorded_at", untilIso)
      .order("recorded_at", { ascending: false }),
  );

  return [
    ...verified.map((r) => ({ tier: "verified_action" as const, axis: null, patternFamily: r.pattern_family })),
    ...created.map((r) => ({ tier: "pending_action" as const, axis: null, patternFamily: r.pattern_family })),
    ...signals.map((r) => ({ tier: "scenario_signal" as const, axis: null, patternFamily: r.pattern_family })),
  ];
}

/**
 * Stale active/unstable pattern signatures as a low-confidence fallback pool, in the
 * fetch's recency order (last_seen_at desc). Each row carries an axis (primary) and a
 * pattern_family (fallback); the deriver scans for the first derivable one. Read-pure.
 */
async function gatherStaleCandidates(
  supabase: SupabaseClient,
  userId: string,
): Promise<AxisCandidate[]> {
  const res = await fetchUserPatternSignaturesForMyPage(supabase, userId);
  if (!res.ok) return [];
  return res.rows.map((r) => ({ axis: r.axis, patternFamily: r.pattern_family }));
}

/**
 * Build the Today Intelligence brief for a user. Read-only; fail-soft to a clean-start
 * `read_error` brief on any failure. Same-window evidence is gathered only for a
 * YESTERDAY_MIRROR day (the gate that carries yesterday evidence).
 */
export async function buildTodayIntelligence(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<TodayIntelligence> {
  try {
    const tz = await resolveUserTzQuiet(supabase, userId);
    const snapshot = await evaluateDailyGate(supabase, userId, now, tz);

    let windowCandidates: WindowEvidenceCandidate[] | undefined;
    let staleCandidates: AxisCandidate[] | undefined;
    if (snapshot.gate === "YESTERDAY_MIRROR") {
      const todayStart = userDayStartInstant(now, tz, 5);
      const yesterdayStart = userDayStartInstant(new Date(todayStart.getTime() - 1), tz, 5);
      const sinceIso = yesterdayStart.toISOString();
      const untilIso = todayStart.toISOString();
      windowCandidates = await gatherWindowCandidates(supabase, userId, sinceIso, untilIso);
      staleCandidates = await gatherStaleCandidates(supabase, userId);
    }

    return deriveTodayIntelligence({
      gate: snapshot.gate,
      blockingContractStatus: snapshot.context?.contractStatus ?? null,
      windowCandidates,
      staleCandidates,
    });
  } catch (e) {
    console.warn(
      "[today-intelligence] degraded → clean start:",
      e instanceof Error ? e.message : e,
    );
    return deriveTodayIntelligence({ gate: "OPEN_DAY", readError: true });
  }
}
