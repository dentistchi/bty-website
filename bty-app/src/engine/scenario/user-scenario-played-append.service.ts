/**
 * Keeps `public.user_scenario_history.played_scenario_ids` in sync with Arena plays.
 * Appends on each CHOICE_CONFIRMED; when the aggregate was never populated, seeds from
 * `user_scenario_choice_history` (same order as {@link fetchPlayedScenarioIds} backfill).
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function appendPlayedScenarioId(userId: string, scenarioId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { data: row, error: fetchErr } = await admin
    .from("user_scenario_history")
    .select("played_scenario_ids")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) {
    console.warn("[appendPlayedScenarioId]", fetchErr.message);
    return;
  }

  const stored = Array.isArray(row?.played_scenario_ids)
    ? (row.played_scenario_ids as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  let next: string[];
  if (stored.length > 0) {
    next = [...stored, scenarioId];
  } else {
    const { data: rows, error: chErr } = await admin
      .from("user_scenario_choice_history")
      .select("scenario_id")
      .eq("user_id", userId)
      .order("played_at", { ascending: true });

    if (chErr) {
      console.warn("[appendPlayedScenarioId] choice history", chErr.message);
      return;
    }
    next = (rows ?? [])
      .map((r) => (r as { scenario_id?: string }).scenario_id)
      .filter((x): x is string => typeof x === "string");
  }

  const { error: upErr } = await admin.from("user_scenario_history").upsert(
    { user_id: userId, played_scenario_ids: next },
    { onConflict: "user_id" },
  );
  if (upErr) console.warn("[appendPlayedScenarioId]", upErr.message);
}
