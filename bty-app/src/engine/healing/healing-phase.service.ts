/**
 * Center healing track — 4단계(ACK → REFLECTION → REINTEGRATION → RENEWAL).
 * Center 진단 완료 시 integrity_slip_log·락아웃 이력 심각도로 초기 phase를 부여하고 `user_healing_phase`에 저장.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/** Ordered healing phases (Center / integrity recovery). */
export const HEALING_PHASE_ORDER = [
  "ACKNOWLEDGEMENT",
  "REFLECTION",
  "REINTEGRATION",
  "RENEWAL",
] as const;

export type HealingPhase = (typeof HEALING_PHASE_ORDER)[number];

export const LOCKOUT_SLIP_REASON = "air_below_60_lockout" as const;

export type UserHealingPhaseRow = {
  user_id: string;
  phase: HealingPhase;
  started_at: string;
  completed_at: string | null;
};

/**
 * 심각도 규칙 (문서화된 휴리스틱):
 * - `lockoutCount`: `integrity_slip_log`에서 `reason = air_below_60_lockout` 건수.
 * - `slipLogCount`: 해당 사용자의 전체 slip 로그 건수(락아웃 행 포함).
 * - 높은 부정적 이력 → ACKNOWLEDGEMENT에서 시작, 경미하면 뒤 단계부터 시작.
 */
export function computeHealingPhaseFromSeverity(
  slipLogCount: number,
  lockoutCount: number,
): HealingPhase {
  if (lockoutCount >= 2 || slipLogCount >= 6) return "ACKNOWLEDGEMENT";
  if (lockoutCount >= 1 || slipLogCount >= 3) return "ACKNOWLEDGEMENT";
  if (slipLogCount >= 1) return "REFLECTION";
  return "REINTEGRATION";
}

async function fetchSeverityCounts(
  client: SupabaseClient,
  userId: string,
): Promise<{ slipLogCount: number; lockoutCount: number }> {
  const { data: rows, error } = await client
    .from("integrity_slip_log")
    .select("reason")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const slipLogCount = rows?.length ?? 0;
  const lockoutCount = (rows ?? []).filter((r) => r.reason === LOCKOUT_SLIP_REASON).length;

  return { slipLogCount, lockoutCount };
}

/**
 * Center 진단 완료 시점에 호출: slip·락아웃 이력을 읽고 초기 healing phase를 계산해 저장한다.
 * - 기본(`force` 생략 또는 `false`): 이미 `user_healing_phase` 행이 있으면 재계산하지 않고 기존 phase 반환.
 * - `force: true`: 심각도를 다시 읽어 항상 upsert (진단 완료마다 갱신할 때).
 */
export async function assignHealingPhaseOnCenterDiagnosticComplete(
  userId: string,
  supabase?: SupabaseClient,
  options?: { force?: boolean },
): Promise<HealingPhase> {
  const client = supabase ?? (await getSupabaseServerClient());
  const { slipLogCount, lockoutCount } = await fetchSeverityCounts(client, userId);
  const phase = computeHealingPhaseFromSeverity(slipLogCount, lockoutCount);

  if (!options?.force) {
    const { data: row } = await client
      .from("user_healing_phase")
      .select("phase")
      .eq("user_id", userId)
      .maybeSingle();
    if (row?.phase) {
      void import("@/engine/foundry/dear-me-recommender.service").then((mod) =>
        mod.refreshDearMeRecommendation(userId, client).catch((e) =>
          console.warn("[refreshDearMeRecommendation]", e),
        ),
      );
      return row.phase as HealingPhase;
    }
  }

  const now = new Date().toISOString();
  const { error } = await client.from("user_healing_phase").upsert(
    {
      user_id: userId,
      phase,
      started_at: now,
      completed_at: null,
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);

  void import("@/engine/foundry/dear-me-recommender.service").then((mod) =>
    mod.refreshDearMeRecommendation(userId, client).catch((e) =>
      console.warn("[refreshDearMeRecommendation]", e),
    ),
  );

  return phase;
}

/**
 * 현재 저장된 phase; 없으면 `null`.
 */
export async function getCurrentPhase(
  userId: string,
  supabase?: SupabaseClient,
): Promise<HealingPhase | null> {
  const client = supabase ?? (await getSupabaseServerClient());
  const { data, error } = await client
    .from("user_healing_phase")
    .select("phase")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.phase) return null;
  return data.phase as HealingPhase;
}

/**
 * 다음 단계로 진행. 이미 RENEWAL이면 `completed_at`을 채우고 RENEWAL을 반환.
 */
export async function advancePhase(
  userId: string,
  supabase?: SupabaseClient,
): Promise<HealingPhase> {
  const client = supabase ?? (await getSupabaseServerClient());
  const current = await getCurrentPhase(userId, client);
  const start: HealingPhase = current ?? "ACKNOWLEDGEMENT";
  const idx = HEALING_PHASE_ORDER.indexOf(start);

  if (idx === -1) {
    throw new Error(`advancePhase: unknown phase ${String(start)}`);
  }

  if (start === "RENEWAL") {
    const now = new Date().toISOString();
    const { error } = await client
      .from("user_healing_phase")
      .update({ completed_at: now })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    void import("@/engine/avatar/avatar-outfit-unlock.service").then((m) =>
      m.checkOutfitUnlocks(userId, client).catch((e) => console.warn("[checkOutfitUnlocks]", e)),
    );
    return "RENEWAL";
  }

  const next = HEALING_PHASE_ORDER[idx + 1]!;
  const now = new Date().toISOString();
  const { error } = await client.from("user_healing_phase").upsert(
    {
      user_id: userId,
      phase: next,
      started_at: now,
      completed_at: null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);

  void import("@/engine/foundry/dear-me-recommender.service").then((mod) =>
    mod.refreshDearMeRecommendation(userId, client).catch((e) =>
      console.warn("[refreshDearMeRecommendation]", e),
    ),
  );

  if (next === "RENEWAL") {
    void import("./awakening-phase.service").then((mod) =>
      mod.onAdvancedToRenewalPhase(userId, client).catch((e) =>
        console.warn("[onAdvancedToRenewalPhase]", e),
      ),
    );
  }

  void import("@/engine/avatar/avatar-outfit-unlock.service").then((m) =>
    m.checkOutfitUnlocks(userId, client).catch((e) => console.warn("[checkOutfitUnlocks]", e)),
  );

  return next;
}
