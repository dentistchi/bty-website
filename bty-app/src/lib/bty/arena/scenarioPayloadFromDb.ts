/**
 * Arena runtime scenario payload: **only** the bundled canonical elite dataset (`bty_elite_scenarios_v2.json`
 * via static import in eliteScenariosCanonical.server). `reader` is accepted for API compatibility and ignored for payload resolution.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Scenario } from "@/lib/bty/scenario/types";
import {
  eliteScenarioToScenario,
  getEliteScenarioById,
} from "@/lib/bty/arena/eliteScenariosCanonical.server";

/** Prefer service role; else anon — RLS allows select on `public.scenarios` for non-Arena readers. */
export function getSupabaseScenarioReader(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url) return null;
  const key = serviceKey || anonKey;
  if (!key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Legacy JSON-in-`body` beginner flow — must not be served to Arena runtime. */
export function isLegacyScenarioDbBody(body: string): boolean {
  const t = body.trim();
  if (!t.startsWith("{")) return false;
  return (
    t.includes("beginner_7step") ||
    t.includes('"emotionOptions"') ||
    t.includes('"hiddenRiskQuestion"') ||
    t.includes('"integrityTrigger"') ||
    t.includes('"decisionOptions"')
  );
}

/** Reject mapped payloads that still contain legacy markers (defense in depth). */
export function rejectLegacyScenarioPayload(s: Scenario): boolean {
  const blob = JSON.stringify(s).toLowerCase();
  const markers = [
    "beginner_7step",
    "emotionoptions",
    "hiddenriskquestion",
    "integritytrigger",
    "decisionoptions",
  ];
  return markers.some((m) => blob.includes(m));
}

/**
 * Load full {@link Scenario} for Arena from the bundled canonical elite dataset (`bty_elite_scenarios_v2.json`) only.
 * `reader` is unused (kept for call-site compatibility).
 */
export async function loadArenaScenarioPayloadFromDb(
  _reader: SupabaseClient | null,
  scenarioId: string,
  locale: "en" | "ko",
): Promise<Scenario | null> {
  void _reader;
  try {
    const elite = getEliteScenarioById(scenarioId);
    if (!elite) return null;
    const scenario = eliteScenarioToScenario(elite, locale);
    if (rejectLegacyScenarioPayload(scenario)) {
      console.error("[arena] legacy_scenario_payload_blocked", {
        scenarioId,
        legacyFallback: "blocked",
        reason: "markers_in_mapped_scenario",
      });
      return null;
    }
    return scenario;
  } catch (e) {
    console.error("[arena] elite_scenario_load_failed", {
      scenarioId,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
