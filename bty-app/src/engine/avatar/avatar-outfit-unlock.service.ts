/**
 * Condition-based avatar cosmetics beyond tier snapshots: evaluates Core XP, Certified Leader,
 * healing phase, scenario counts, and streaks; persists to `user_avatar_assets` and emits `outfit_unlocked`.
 *
 * Twelve assets span T0–T4 (thresholds align loosely with {@link AVATAR_TIER_THRESHOLDS}).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCertifiedStatus } from "@/engine/integrity/certified-leader.monitor";
import {
  HEALING_PHASE_ORDER,
  getCurrentPhase,
  type HealingPhase,
} from "@/engine/healing/healing-phase.service";
import { getScenarioStats } from "@/engine/scenario/scenario-stats.service";
import { getCoreXPHistory } from "@/engine/xp/core-xp-history.service";
import {
  OUTFIT_UNLOCK_CARD_ORDER,
  OUTFIT_UNLOCK_CONDITIONS,
  type OutfitUnlockAssetType,
  type OutfitUnlockConditionRow,
  type OutfitUnlockConditionType,
} from "@/engine/avatar/avatar-outfit-unlock-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type {
  OutfitUnlockAssetType,
  OutfitUnlockConditionRow,
  OutfitUnlockConditionType,
} from "@/engine/avatar/avatar-outfit-unlock-data";
export { OUTFIT_UNLOCK_CARD_ORDER, OUTFIT_UNLOCK_CONDITIONS } from "@/engine/avatar/avatar-outfit-unlock-data";
export { assetTypeForEquipConflict } from "@/engine/avatar/avatar-equip-conflict";

const CONDITION_KO: Record<string, string> = {
  avatar_base: "Core XP 100 이상",
  character_default: "시나리오 1회 플레이",
  palette_basic: "Core XP 500 이상",
  accessory_slot_1: "서로 다른 시나리오 5회 플레이",
  outfit_theme_professional: "Core XP 1,500 이상",
  accessory_slot_2: "연속 출석 5일 (UTC)",
  outfit_theme_fantasy: "힐링 페이즈 인덱스 2 이상",
  accessory_slot_3: "서로 다른 시나리오 15회 플레이",
  visor_elite_center: "Core XP 3,500 이상",
  frame_legend: "Certified Leader 자격 활성",
  palette_full: "Core XP 5,500 이상",
  accessory_slot_4: "Core XP 6,500 이상",
};

export const OUTFIT_UNLOCKED_EVENT = "outfit_unlocked" as const;

export type OutfitUnlockedPayload = {
  type: typeof OUTFIT_UNLOCKED_EVENT;
  userId: string;
  asset_id: string;
  at: string;
};

export type UnlockResult = {
  asset_id: string;
  unlocked_at: string;
};

export type OutfitProgress = {
  asset_id: string;
  asset_type: OutfitUnlockAssetType;
  unlocked: boolean;
  /** 0–1 toward satisfying the condition (1 when unlocked). */
  progress01: number;
  condition_type: OutfitUnlockConditionType;
  condition_value: number;
  /** Korean condition summary for the card. */
  condition_ko: string;
  /** Progress bar numerator (paired with `condition_value` as target). */
  current: number;
};

const outfitUnlockListeners = new Set<(p: OutfitUnlockedPayload) => void | Promise<void>>();

export function onOutfitUnlocked(
  fn: (p: OutfitUnlockedPayload) => void | Promise<void>,
): () => void {
  outfitUnlockListeners.add(fn);
  return () => outfitUnlockListeners.delete(fn);
}

function emitOutfitUnlocked(payloads: OutfitUnlockedPayload[]): void {
  for (const p of payloads) {
    for (const fn of outfitUnlockListeners) {
      try {
        void fn(p);
      } catch {
        /* no-op */
      }
    }
  }
}

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

function healingPhaseIndex(phase: HealingPhase | null): number {
  if (!phase) return -1;
  return HEALING_PHASE_ORDER.indexOf(phase);
}

async function fetchArenaCoreXpTotal(
  userId: string,
  client: SupabaseClient,
): Promise<number> {
  const { data } = await client
    .from("arena_profiles")
    .select("core_xp_total")
    .eq("user_id", userId)
    .maybeSingle();
  return Math.max(0, Math.floor(Number((data as { core_xp_total?: number } | null)?.core_xp_total ?? 0)));
}

export type UnlockEvaluationContext = {
  coreXpTotal: number;
  certifiedActive: boolean;
  healingPhaseIndex: number;
  uniqueScenariosPlayed: number;
  streakDaysUtc: number;
};

async function loadEvaluationContext(
  userId: string,
  supabase: SupabaseClient,
): Promise<UnlockEvaluationContext> {
  const [coreXpTotal, hist, certified, phase, stats] = await Promise.all([
    fetchArenaCoreXpTotal(userId, supabase),
    getCoreXPHistory(userId, { supabase }),
    getCertifiedStatus(userId),
    getCurrentPhase(userId, supabase),
    getScenarioStats(userId, "en"),
  ]);

  const xp = Math.max(coreXpTotal, hist.totalCoreXp);
  const certifiedActive = certified.state === "active";
  const hIdx = healingPhaseIndex(phase);

  return {
    coreXpTotal: xp,
    certifiedActive,
    healingPhaseIndex: hIdx,
    uniqueScenariosPlayed: stats.uniqueScenariosPlayed,
    streakDaysUtc: stats.streakDaysUtc,
  };
}

function isSatisfied(
  row: OutfitUnlockConditionRow,
  ctx: UnlockEvaluationContext,
): boolean {
  switch (row.condition_type) {
    case "core_xp":
      return ctx.coreXpTotal >= row.condition_value;
    case "certified_leader":
      return row.condition_value <= 0 ? true : ctx.certifiedActive;
    case "healing_phase":
      return ctx.healingPhaseIndex >= row.condition_value;
    case "scenario_count":
      return ctx.uniqueScenariosPlayed >= row.condition_value;
    case "streak":
      return ctx.streakDaysUtc >= row.condition_value;
    default:
      return false;
  }
}

function currentProgressValue(
  row: OutfitUnlockConditionRow,
  ctx: UnlockEvaluationContext,
): number {
  switch (row.condition_type) {
    case "core_xp":
      return Math.min(ctx.coreXpTotal, row.condition_value);
    case "certified_leader":
      return ctx.certifiedActive ? row.condition_value : 0;
    case "healing_phase": {
      const need = row.condition_value;
      const cur = Math.max(0, ctx.healingPhaseIndex);
      return Math.min(cur, need);
    }
    case "scenario_count":
      return Math.min(ctx.uniqueScenariosPlayed, row.condition_value);
    case "streak":
      return Math.min(ctx.streakDaysUtc, row.condition_value);
    default:
      return 0;
  }
}

function progress01For(
  row: OutfitUnlockConditionRow,
  ctx: UnlockEvaluationContext,
): number {
  if (isSatisfied(row, ctx)) return 1;
  switch (row.condition_type) {
    case "core_xp": {
      const t = row.condition_value;
      return t <= 0 ? 1 : Math.min(1, ctx.coreXpTotal / t);
    }
    case "certified_leader":
      return ctx.certifiedActive ? 1 : 0;
    case "healing_phase": {
      const need = row.condition_value;
      const cur = ctx.healingPhaseIndex;
      if (cur < 0) return 0;
      if (need <= 0) return 1;
      return Math.min(1, (cur + 1) / (need + 1));
    }
    case "scenario_count": {
      const t = row.condition_value;
      return t <= 0 ? 1 : Math.min(1, ctx.uniqueScenariosPlayed / t);
    }
    case "streak": {
      const t = row.condition_value;
      return t <= 0 ? 1 : Math.min(1, ctx.streakDaysUtc / t);
    }
    default:
      return 0;
  }
}

async function fetchExistingAssetIds(
  userId: string,
  client: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("user_avatar_assets")
    .select("asset_id")
    .eq("user_id", userId);

  if (error) {
    console.warn("[fetchExistingAssetIds]", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r: { asset_id: string }) => r.asset_id));
}

/**
 * Evaluates all {@link OUTFIT_UNLOCK_CONDITIONS}, inserts new `user_avatar_assets` rows, emits {@link OUTFIT_UNLOCKED_EVENT}.
 */
export async function checkOutfitUnlocks(
  userId: string,
  supabase?: SupabaseClient,
): Promise<UnlockResult[]> {
  const client = resolveClient(supabase);
  if (!client) return [];

  const ctx = await loadEvaluationContext(userId, client);
  const have = await fetchExistingAssetIds(userId, client);
  const now = new Date().toISOString();
  const results: UnlockResult[] = [];
  const payloads: OutfitUnlockedPayload[] = [];

  const toInsert: { user_id: string; asset_id: string; unlocked_at: string }[] = [];
  for (const [asset_id, row] of Object.entries(OUTFIT_UNLOCK_CONDITIONS)) {
    if (have.has(asset_id)) continue;
    if (!isSatisfied(row, ctx)) continue;
    toInsert.push({ user_id: userId, asset_id, unlocked_at: now });
  }

  if (toInsert.length > 0) {
    const { error } = await client.from("user_avatar_assets").insert(toInsert);
    if (error) {
      console.warn("[checkOutfitUnlocks] batch insert", error.message);
      for (const row of toInsert) {
        const { error: oneErr } = await client.from("user_avatar_assets").insert(row);
        if (oneErr) continue;
        results.push({ asset_id: row.asset_id, unlocked_at: row.unlocked_at });
        payloads.push({
          type: OUTFIT_UNLOCKED_EVENT,
          userId,
          asset_id: row.asset_id,
          at: now,
        });
      }
    } else {
      for (const row of toInsert) {
        results.push({ asset_id: row.asset_id, unlocked_at: row.unlocked_at });
        payloads.push({
          type: OUTFIT_UNLOCKED_EVENT,
          userId,
          asset_id: row.asset_id,
          at: now,
        });
      }
    }
  }

  if (payloads.length > 0) emitOutfitUnlocked(payloads);
  return results;
}

/**
 * Locked/unlocked + progress per configured asset (for UI), fixed 12-card order.
 */
export async function getOutfitUnlockProgress(
  userId: string,
  supabase?: SupabaseClient,
): Promise<OutfitProgress[]> {
  const client = resolveClient(supabase);
  if (!client) return [];

  const ctx = await loadEvaluationContext(userId, client);
  const have = await fetchExistingAssetIds(userId, client);

  return OUTFIT_UNLOCK_CARD_ORDER.map((asset_id) => {
    const row = OUTFIT_UNLOCK_CONDITIONS[asset_id];
    const unlocked = have.has(asset_id) || isSatisfied(row, ctx);
    const current = currentProgressValue(row, ctx);
    return {
      asset_id,
      asset_type: row.asset_type,
      unlocked,
      progress01: unlocked ? 1 : progress01For(row, ctx),
      condition_type: row.condition_type,
      condition_value: row.condition_value,
      condition_ko: CONDITION_KO[asset_id] ?? asset_id,
      current: unlocked ? row.condition_value : current,
    };
  });
}
