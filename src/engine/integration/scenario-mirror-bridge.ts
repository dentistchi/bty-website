/**
 * CHOICE_CONFIRMED → mirror pool (HERO_TRAP / INTEGRITY_SLIP).
 *
 * Uses {@link getMirrorScenarios} / {@link generateMirror} from `perspective-switch/mirror-scenario.service`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateMirror,
  getMirrorScenarios,
} from "@/engine/perspective-switch/mirror-scenario.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export const MIRROR_TRIGGER_FLAG_TYPES = ["HERO_TRAP", "INTEGRITY_SLIP"] as const;

export type MirrorTriggerEvent = {
  scenarioId: string;
  choiceId: string;
  flagType: string;
};

function isMirrorTriggerFlag(flagType: string): boolean {
  const u = flagType.trim().toUpperCase();
  return (MIRROR_TRIGGER_FLAG_TYPES as readonly string[]).includes(u);
}

/**
 * When `flag_type` is HERO_TRAP or INTEGRITY_SLIP: if mirror pool has **&lt; 3** rows after sync,
 * upsert bilingual mirror copy via {@link generateMirror}.
 */
export async function handleMirrorTrigger(
  userId: string,
  event: MirrorTriggerEvent,
  supabase?: SupabaseClient,
): Promise<void> {
  if (!isMirrorTriggerFlag(event.flagType)) return;

  const client = supabase ?? (await getSupabaseServerClient());
  const mirrors = await getMirrorScenarios(userId, client);
  if (mirrors.length >= 3) return;

  const originFlagType = event.flagType.trim().toUpperCase();
  await generateMirror(userId, event.scenarioId, event.choiceId, client, { originFlagType });
}
