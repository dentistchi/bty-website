/**
 * Leadership Lab — Core XP만 부여; Weekly XP와 엄격히 분리.
 * `core_xp_ledger.source_type = LAB`, 프로필 갱신은 {@link applyDirectCoreXp}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyDirectCoreXp } from "@/lib/bty/arena/applyCoreXp";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

/** `core_xp_ledger.source_type` · 런타임 가드용 단일 소스. */
export const XP_LEDGER_SOURCE = {
  LAB: "LAB",
} as const;

/** 어디서 XP를 쓰려는지 — Lab 세션에서는 Weekly 경로 금지. */
export const XP_GRANT_ORIGIN = {
  LAB_SESSION: "lab_session",
  ARENA_RUN: "arena_run",
  ADMIN: "admin",
  SEASONAL: "seasonal",
} as const;

export type XpGrantOrigin = (typeof XP_GRANT_ORIGIN)[keyof typeof XP_GRANT_ORIGIN];

export type XpBucket = "core" | "weekly";

export class LabXPViolation extends Error {
  readonly code = "LAB_XP_VIOLATION" as const;

  constructor(message = "Weekly XP cannot be granted from lab_session origin") {
    super(message);
    this.name = "LabXPViolation";
    Object.setPrototypeOf(this, LabXPViolation.prototype);
  }
}

export function isLabXPViolation(e: unknown): e is LabXPViolation {
  return e instanceof LabXPViolation;
}

/**
 * Lab이 아닌 출처에서만 Weekly XP 기록을 허용. `lab_session` + weekly → {@link LabXPViolation}.
 */
export function guardWeeklyXpAgainstLabOrigin(origin: XpGrantOrigin, bucket: XpBucket): void {
  if (bucket === "weekly" && origin === XP_GRANT_ORIGIN.LAB_SESSION) {
    throw new LabXPViolation();
  }
}

/**
 * Lab 외 코드 경로에서 Weekly를 쓰기 직전에 호출 (이중 안전).
 */
export function assertWeeklyXpNotFromLabSession(origin: XpGrantOrigin): void {
  guardWeeklyXpAgainstLabOrigin(origin, "weekly");
}

export type CoreXPResult = { newCoreTotal: number } | { error: string };

/**
 * Lab 시나리오 완료: `core_xp_ledger`에 LAB 행을 남기고 Core만 반영 (Weekly 없음).
 *
 * @param sourceId — 멱등 키(같은 값이면 unique 제약으로 중복 부여 방지). 예: `lab:{userId}:{YYYY-MM-DD}:{attemptIndex}`.
 */
export async function awardLabXP(
  userId: string,
  amount: number,
  options?: { supabase?: SupabaseClient; sourceId?: string },
): Promise<CoreXPResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "invalid_lab_xp_amount" };
  }

  const client = options?.supabase ?? (await getSupabaseServerClient());
  const sourceId =
    options?.sourceId ?? `lab:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  const { error: ledgerErr } = await client.from("core_xp_ledger").insert({
    user_id: userId,
    delta_xp: Math.floor(amount),
    source_type: XP_LEDGER_SOURCE.LAB,
    source_id: sourceId,
  });

  if (ledgerErr) {
    if (ledgerErr.code === "23505") {
      return { error: "lab_xp_already_applied" };
    }
    return { error: ledgerErr.message };
  }

  const applied = await applyDirectCoreXp(client, userId, amount);
  if ("error" in applied) {
    return { error: applied.error };
  }

  return { newCoreTotal: applied.newCoreTotal };
}
