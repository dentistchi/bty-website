/**
 * BTY Daily OS v0.1 — Daily Gate Check (Slice 1).
 *
 * READ-ONLY cross-domain orchestrator. Returns the single authoritative gate for
 * the first 60 seconds (Scope Lock §5). Neutral `lib/bty/daily` namespace: it only
 * READS via existing exported service functions and modifies no system's domain.
 *
 * Ordering is Daily-Gate's OWN cross-domain order (Scope Lock §5, §9). It does NOT
 * import `statePriorityForRuntime()` or reuse arena-internal priority weights — the
 * order is the local {@link DAILY_GATE_ORDER} constant; first match wins, short-circuit.
 *
 * Purity (verified pre-mutation): all five gate functions are pure-read.
 *  - userHasForcedResetPending      — read; open-on-failure (returns false on db error)
 *  - fetchBlockingArenaContractForSession — read; filters deadline>now, does NOT expire
 *  - fetchFirstDueNoChangeReexposureMeta  — read; consume-write lives in a separate fn
 *  - getResilienceEntries           — read; delegates to a pure domain aggregator
 *  - getOnboardingStep              — read; THROWS on error → wrapped fail-quiet here
 * A passive daily open triggers NO write.
 *
 * Error handling: Gate 1 preserves the helper's existing open-on-failure contract
 * (no lockout). Gates 2–6 fail-quiet — a single degraded source falls through to the
 * next gate; the daily entry never 500s and degrades to OPEN_DAY.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userHasForcedResetPending } from "@/lib/bty/leadership-engine/state-service";
import { fetchBlockingArenaContractForSession } from "@/lib/bty/arena/blockingArenaActionContract";
import { fetchFirstDueNoChangeReexposureMeta } from "@/engine/scenario/delayed-outcome-trigger.service";
import { getResilienceEntries } from "@/lib/bty/center/resilienceService";
import { getOnboardingStep } from "@/engine/integration/onboarding-flow.service";

export type DailyGate =
  | "FORCED_RESET"
  | "ACTION_REQUIRED"
  | "REEXPOSURE_DUE"
  | "YESTERDAY_MIRROR"
  | "QUIET_INVITATION"
  | "FIRST_DAY"
  | "OPEN_DAY";

export type DailyDestinationKind = "center" | "open_loop" | "arena_reexposure" | "today";

export type DailyGateContext = {
  contractId?: string;
  contractStatus?: string;
  deadlineAt?: string;
  reexposureId?: string;
};

export type DailyGateSnapshot = {
  gate: DailyGate;
  destination: { kind: DailyDestinationKind };
  context?: DailyGateContext;
};

/**
 * Canonical Daily-Gate order (Scope Lock §5). Documentation + evaluation order for
 * {@link evaluateDailyGate}; explicitly NOT arena `statePriorityForRuntime()`.
 */
export const DAILY_GATE_ORDER: readonly DailyGate[] = [
  "FORCED_RESET",
  "ACTION_REQUIRED",
  "REEXPOSURE_DUE",
  "YESTERDAY_MIRROR",
  "QUIET_INVITATION",
  "FIRST_DAY",
  "OPEN_DAY",
] as const;

/** Fail-quiet wrapper for gates 2–6: any throw degrades the source to `fallback`. */
async function quiet<T>(fn: () => Promise<T>, fallback: T, tag: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[daily-gate] ${tag} degraded:`, e instanceof Error ? e.message : e);
    return fallback;
  }
}

function addUtcDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** UTC calendar day (YYYY-MM-DD). v0.1 uses UTC days; timezone localization deferred. */
function utcDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Evaluate the Daily Gate for a user. Read-only; short-circuits on first match in
 * {@link DAILY_GATE_ORDER}.
 */
export async function evaluateDailyGate(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<DailyGateSnapshot> {
  // 1 — FORCED_RESET → Center. Helper is open-on-failure by contract (do not invert).
  if (await userHasForcedResetPending(supabase, userId)) {
    return { gate: "FORCED_RESET", destination: { kind: "center" } };
  }

  // 2 — ACTION_REQUIRED / open loop → Open Loop Card. Pure read (no contract expiry).
  const blocking = await quiet(
    () => fetchBlockingArenaContractForSession(supabase, userId),
    null,
    "action_required",
  );
  if (blocking) {
    return {
      gate: "ACTION_REQUIRED",
      destination: { kind: "open_loop" },
      context: {
        contractId: blocking.id,
        contractStatus: blocking.status,
        deadlineAt: blocking.deadline_at,
      },
    };
  }

  // 3 — REEXPOSURE_DUE → Arena re-exposure.
  const reexp = await quiet(
    () => fetchFirstDueNoChangeReexposureMeta(supabase, userId, now),
    null,
    "reexposure_due",
  );
  if (reexp?.pendingOutcomeId) {
    return {
      gate: "REEXPOSURE_DUE",
      destination: { kind: "arena_reexposure" },
      context: { reexposureId: reexp.pendingOutcomeId },
    };
  }

  // 4/5 — share center evidence dates (fetched once). v0.1: center-scoped signal, UTC day.
  const centerDates = await quiet(
    async () => {
      const res = await getResilienceEntries(supabase, userId);
      return res.ok ? res.entries.map((e) => e.date) : [];
    },
    [] as string[],
    "center_evidence",
  );
  const yesterdayStr = utcDateStr(addUtcDays(now, -1));
  const cutoff14Str = utcDateStr(addUtcDays(now, -14));

  // 4 — Yesterday evidence exists → Yesterday Mirror.
  if (centerDates.includes(yesterdayStr)) {
    return { gate: "YESTERDAY_MIRROR", destination: { kind: "today" } };
  }

  // 5 — Yesterday empty + 14-day evidence exists → Quiet invitation.
  if (centerDates.some((d) => d >= cutoff14Str)) {
    return { gate: "QUIET_INVITATION", destination: { kind: "today" } };
  }

  // 6 — New user → First Day ritual. getOnboardingStep throws → fail-quiet to not-new.
  const isNewUser = await quiet(
    async () => {
      const state = await getOnboardingStep(userId, supabase);
      return !state.isComplete;
    },
    false,
    "first_day",
  );
  if (isNewUser) {
    return { gate: "FIRST_DAY", destination: { kind: "today" } };
  }

  return { gate: "OPEN_DAY", destination: { kind: "today" } };
}
