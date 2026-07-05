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
 * Gates 4/5 use FULL 3-domain evidence (self / others / ground) via
 * {@link hasAnyEvidenceInWindow} (Scope Lock §5, Commander Flag 1 = b): a user who left
 * Arena or Foundry evidence yesterday reads as YESTERDAY_MIRROR, not "quiet".
 *
 * Purity (verified pre-mutation): all reused functions are pure-read.
 *  - userHasForcedResetPending      — read; open-on-failure (returns false on db error)
 *  - fetchBlockingArenaContractForSession — read; filters deadline>now, does NOT expire
 *  - fetchFirstDueNoChangeReexposureMeta  — read; consume-write lives in a separate fn
 *  - hasAnyEvidenceInWindow         — read; head+count over confirmed sources, fail-quiet
 *  - getOnboardingStep              — read; THROWS on error → wrapped fail-quiet here
 * A passive daily open triggers NO write.
 *
 * Error handling: Gate 1 preserves the helper's existing open-on-failure contract
 * (no lockout). Gates 2–6 fail-quiet — a single degraded source falls through to the
 * next gate; the daily entry never 500s and degrades to OPEN_DAY.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
import { userHasForcedResetPending } from "@/lib/bty/leadership-engine/state-service";
import { fetchBlockingArenaContractForSession } from "@/lib/bty/arena/blockingArenaActionContract";
import { fetchFirstDueNoChangeReexposureMeta } from "@/engine/scenario/delayed-outcome-trigger.service";
import { hasAnyEvidenceInWindow } from "@/lib/bty/daily/relationshipPulse";
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

/**
 * Per-user timezone for the day-window boundary, fail-quiet (D1 STEP 1). profile tz if a valid
 * IANA id, else UTC. Never throws — a missing column / RLS denial / degraded client → UTC.
 */
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
 * Evaluate the Daily Gate for a user. Read-only; short-circuits on first match in
 * {@link DAILY_GATE_ORDER}. `userTz` (D1 STEP 1) overrides profile-tz resolution when supplied.
 */
export async function evaluateDailyGate(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
  userTz?: string,
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

  // 4/5 — full 3-domain evidence (self/others/ground), canonical user-day windows (05:00-local,
  // D1 STEP 1). Boundaries are the exact UTC instants of the user-day starts.
  const tz = userTz ?? (await resolveUserTzQuiet(supabase, userId));
  const todayStart = userDayStartInstant(now, tz, 5);
  const yesterdayStart = userDayStartInstant(new Date(todayStart.getTime() - 1), tz, 5);
  const yesterdayWindowSince = yesterdayStart.toISOString();
  const todayWindowStart = todayStart.toISOString();
  const cutoff14Iso = new Date(todayStart.getTime() - 14 * 86_400_000).toISOString();

  // 4 — Any-domain evidence yesterday → Yesterday Mirror.
  const hasYesterdayEvidence = await quiet(
    () => hasAnyEvidenceInWindow(supabase, userId, yesterdayWindowSince, todayWindowStart),
    false,
    "yesterday_evidence",
  );
  if (hasYesterdayEvidence) {
    return { gate: "YESTERDAY_MIRROR", destination: { kind: "today" } };
  }

  // 5 — Yesterday empty + any-domain evidence in the 14-day window → Quiet invitation.
  const has14dEvidence = await quiet(
    () => hasAnyEvidenceInWindow(supabase, userId, cutoff14Iso),
    false,
    "window14_evidence",
  );
  if (has14dEvidence) {
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
