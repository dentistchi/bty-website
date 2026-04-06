/**
 * Resolve a lib {@link Scenario} for Arena UI and submit — catalog, perspective (`pswitch_*`), or mirror pool.
 */

import { getMirrorScenarioForLocaleSubmit } from "@/engine/perspective-switch/mirror-scenario.service";
import { getPerspectiveScenarioForSubmit } from "@/engine/scenario/perspective-switch.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseScenarioReader, loadArenaScenarioPayloadFromDb } from "@/lib/bty/arena/scenarioPayloadFromDb";
import type { Scenario } from "@/lib/bty/scenario/types";

/**
 * Catalog + perspective-switch only (no mirror; mirror needs `userId`).
 * Used by routes that must not read legacy {@link SCENARIOS}.
 */
export async function resolveArenaScenarioForAnonymousSubmit(
  scenarioId: string,
  locale: "en" | "ko",
): Promise<Scenario | null> {
  const reader = getSupabaseScenarioReader();
  if (!reader) {
    console.error(
      "[arena] catalog_unavailable: no Supabase reader (anonymous scenario resolution)",
      { scenarioId, locale },
    );
  } else {
    const fromDb = await loadArenaScenarioPayloadFromDb(reader, scenarioId, locale);
    if (fromDb) return fromDb;
  }
  return getPerspectiveScenarioForSubmit(scenarioId, locale);
}

export async function resolveArenaScenarioForUser(
  userId: string,
  scenarioId: string,
  locale: "en" | "ko",
): Promise<Scenario | null> {
  const reader = getSupabaseScenarioReader();
  if (reader) {
    const fromDb = await loadArenaScenarioPayloadFromDb(reader, scenarioId, locale);
    if (fromDb) return fromDb;
  }
  const ps = getPerspectiveScenarioForSubmit(scenarioId, locale);
  if (ps) return ps;
  const client = await getSupabaseServerClient();
  const mirror = await getMirrorScenarioForLocaleSubmit(userId, scenarioId, locale, client);
  if (mirror) return mirror;
  return null;
}
