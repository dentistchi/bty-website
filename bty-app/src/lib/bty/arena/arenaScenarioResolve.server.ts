/**
 * Resolve a lib {@link Scenario} for Arena UI and submit — Elite v2 chain catalog only (bundled dataset).
 */

import { getSupabaseScenarioReader, loadArenaScenarioPayloadFromDb } from "@/lib/bty/arena/scenarioPayloadFromDb";
import type { Scenario } from "@/lib/bty/scenario/types";
import { isEliteChainScenarioId } from "@/lib/bty/arena/postLoginEliteEntry";

/**
 * Catalog only (no mirror / perspective / legacy fallbacks).
 * Used by routes that must not read legacy {@link SCENARIOS}.
 */
export async function resolveArenaScenarioForAnonymousSubmit(
  scenarioId: string,
  locale: "en" | "ko",
): Promise<Scenario | null> {
  if (!isEliteChainScenarioId(scenarioId)) {
    return null;
  }
  const reader = getSupabaseScenarioReader();
  if (!reader) {
    console.error(
      "[arena] catalog_unavailable: no Supabase reader (anonymous scenario resolution)",
      { scenarioId, locale },
    );
    return null;
  }
  return loadArenaScenarioPayloadFromDb(reader, scenarioId, locale);
}

export async function resolveArenaScenarioForUser(
  userId: string,
  scenarioId: string,
  locale: "en" | "ko",
): Promise<Scenario | null> {
  void userId;
  if (!isEliteChainScenarioId(scenarioId)) {
    return null;
  }
  const reader = getSupabaseScenarioReader();
  if (!reader) {
    return null;
  }
  return loadArenaScenarioPayloadFromDb(reader, scenarioId, locale);
}
