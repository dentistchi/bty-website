/**
 * Smoke: verify top-level engine entry points import and resolve without throwing.
 * Persists one row per check to {@link final_wiring_log}.
 */

import { buildMentorContext } from "@/engine/rag/mentor-context.service";
import { getCurrentPhase } from "@/engine/healing/healing-phase.service";
import { getIntegrityDashboard } from "@/engine/integrity/integrity-dashboard.service";
import { getOnboardingStep } from "@/engine/integration/onboarding-flow.service";
import { getNextScenarioForSession } from "@/engine/integration/scenario-type-router";
import { getSystemHealth } from "@/engine/integration/system-health-dashboard.service";
import { getUnreadNotifications } from "@/engine/integration/notification-router.service";
import { getResilienceScore } from "@/engine/resilience/resilience-tracker.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Optional override; else a stable synthetic UUID (no `auth.users` row required for most reads). */
export const FINAL_WIRING_CHECK_USER_ID_ENV = "FINAL_WIRING_CHECK_USER_ID" as const;

const SYNTHETIC_USER_FALLBACK = "00000000-0000-4000-8000-000000000001" as const;

export type WiringCheckStatus = "OK" | "ERROR";

export type WiringResult = {
  service_name: string;
  status: WiringCheckStatus;
  checked_at: string;
  /** Serialized result shape or error message. */
  detail?: unknown;
  error?: string;
};

export type WiringReport = {
  all_ok: boolean;
  syntheticUserId: string;
  checkedAt: string;
  results: WiringResult[];
};

function resolveSyntheticUserId(): string {
  const raw = process.env[FINAL_WIRING_CHECK_USER_ID_ENV]?.trim();
  if (raw && raw.length > 0) return raw;
  return SYNTHETIC_USER_FALLBACK;
}

function safeShape(value: unknown): unknown {
  try {
    return JSON.parse(
      JSON.stringify(value, (_k, v) => {
        if (typeof v === "bigint") return String(v);
        if (typeof v === "string" && v.length > 400) return `${v.slice(0, 400)}…`;
        return v;
      }),
    ) as unknown;
  } catch {
    return { note: "unserializable_result" };
  }
}

async function persistRow(
  serviceName: string,
  status: WiringCheckStatus,
  checkedAt: string,
  detail: unknown,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn("[final-wiring-check] skip final_wiring_log insert (no admin)");
    return;
  }
  const { error } = await admin.from("final_wiring_log").insert({
    service_name: serviceName,
    status,
    checked_at: checkedAt,
    detail: detail === undefined ? null : (detail as Record<string, unknown>),
  });
  if (error) console.warn("[final-wiring-check] final_wiring_log insert failed:", error.message);
}

async function runCheck(
  serviceName: string,
  checkedAt: string,
  fn: () => Promise<unknown>,
): Promise<WiringResult> {
  try {
    const out = await fn();
    const detail = safeShape(out);
    await persistRow(serviceName, "OK", checkedAt, detail);
    return { service_name: serviceName, status: "OK", checked_at: checkedAt, detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await persistRow(serviceName, "ERROR", checkedAt, { error: msg });
    return {
      service_name: serviceName,
      status: "ERROR",
      checked_at: checkedAt,
      error: msg,
    };
  }
}

/**
 * Calls each top-level integration entry with a synthetic user (or {@link FINAL_WIRING_CHECK_USER_ID_ENV}).
 * **`getSystemHealth`** is global (no user id). Persists per-service rows when service role is available.
 */
export async function runFinalWiringCheck(): Promise<WiringReport> {
  const checkedAt = new Date().toISOString();
  const syntheticUserId = resolveSyntheticUserId();
  const admin = getSupabaseAdmin();

  const results: WiringResult[] = [];

  if (admin) {
    results.push(
      await runCheck("getOnboardingStep", checkedAt, () => getOnboardingStep(syntheticUserId, admin)),
    );
  }

  results.push(
    await runCheck("getIntegrityDashboard", checkedAt, () =>
      getIntegrityDashboard(syntheticUserId, null),
    ),
  );

  results.push(
    await runCheck("getNextScenarioForSession", checkedAt, () =>
      getNextScenarioForSession(syntheticUserId, "en"),
    ),
  );

  results.push(
    await runCheck("buildMentorContext", checkedAt, () =>
      buildMentorContext(syntheticUserId, admin ?? undefined),
    ),
  );

  results.push(
    await runCheck("getCurrentPhase", checkedAt, () => getCurrentPhase(syntheticUserId, admin ?? undefined)),
  );

  results.push(
    await runCheck("getSystemHealth", checkedAt, () => getSystemHealth({ bypassCache: true })),
  );

  results.push(
    await runCheck("getResilienceScore", checkedAt, () =>
      getResilienceScore(syntheticUserId, { supabase: admin ?? undefined, persist: false }),
    ),
  );

  if (admin) {
    results.push(
      await runCheck("getUnreadNotifications", checkedAt, () =>
        getUnreadNotifications(syntheticUserId, admin),
      ),
    );
  }

  const all_ok = results.every((r) => r.status === "OK");

  return {
    all_ok,
    syntheticUserId,
    checkedAt,
    results,
  };
}
