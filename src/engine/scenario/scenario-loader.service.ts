/**
 * DB에서 단일 시나리오 조회 (`public.scenarios`). Arena session payloads use
 * {@link loadArenaScenarioPayloadFromDb} + bty_elite_scenarios.json; DB is optional mirror.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Scenario } from "@/data/scenarios/schema.validator";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export type { Scenario } from "@/data/scenarios/schema.validator";

type ScenarioRow = {
  id: string;
  locale: string;
  title: string;
  body: string;
  choices: unknown;
  flag_type: string | null;
  scenario_type: string;
  difficulty: number;
};

/**
 * DB에서 단일 시나리오 조회. 없으면 `null`.
 */
export async function getScenarioById(
  id: string,
  locale: "en" | "ko",
  supabase?: SupabaseClient,
): Promise<Scenario | null> {
  const client = supabase ?? (await getSupabaseServerClient());
  const { data, error } = await client
    .from("scenarios")
    .select("id, locale, title, body, choices, flag_type, scenario_type, difficulty")
    .eq("id", id)
    .eq("locale", locale)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as ScenarioRow;
  const choices = Array.isArray(row.choices) ? row.choices : [];
  const d = Number(row.difficulty);
  const difficulty = d === 1 || d === 2 || d === 3 ? d : 2;

  return {
    id: row.id,
    locale: row.locale as "en" | "ko",
    title: row.title,
    body: row.body,
    choices: choices as Scenario["choices"],
    scenario_type: row.scenario_type ?? "",
    difficulty,
  };
}
