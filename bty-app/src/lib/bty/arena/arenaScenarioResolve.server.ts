/**
 * Resolve a lib {@link Scenario} for Arena UI and submit — catalog, perspective (`pswitch_*`), or mirror pool.
 */

import { getMirrorScenarioForLocaleSubmit } from "@/engine/perspective-switch/mirror-scenario.service";
import { getPerspectiveScenarioForSubmit } from "@/engine/scenario/perspective-switch.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getScenarioById } from "@/lib/bty/scenario/engine";
import type { Scenario } from "@/lib/bty/scenario/types";

export async function resolveArenaScenarioForUser(
  userId: string,
  scenarioId: string,
  locale: "en" | "ko",
): Promise<Scenario | null> {
  const fromCatalog = getScenarioById(scenarioId);
  if (fromCatalog) return fromCatalog;
  const ps = getPerspectiveScenarioForSubmit(scenarioId, locale);
  if (ps) return ps;
  const client = await getSupabaseServerClient();
  const mirror = await getMirrorScenarioForLocaleSubmit(userId, scenarioId, locale, client);
  if (mirror) return mirror;
  return null;
}
