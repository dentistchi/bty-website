/**
 * Arena session context injection — single entry before each Arena load.
 *
 * 1. Refresh `arena_pending_outcomes` via {@link scheduleOutcomes} (choice-history 7-day path).
 * 2. {@link getPatternNarrative} → pattern line for prompts.
 * 3. Read pending queue → prepend delayed outcomes to the opening, then narrative.
 *
 * Callers merge {@link ArenaInjectedContext.situation} with scenario-specific copy (title, id, etc.).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScenarioContext } from "@/lib/bty/arena/reflection-engine";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import {
  getDueOutcomes,
  scheduleOutcomes,
} from "@/engine/scenario/delayed-outcome-trigger.service";
import { getPatternNarrative } from "@/engine/memory/pattern-history.service";

export type ArenaInjectedContext = ScenarioContext & {
  /** Copy from {@link getPatternNarrative} (also folded into `situation`). */
  patternNarrative: string;
  /** `arena_pending_outcomes.id` rows merged into opening — mark `consumed` after session if desired. */
  pendingOutcomeIds: string[];
};

function formatPendingOpening(
  rows: { outcome_title: string; outcome_body: string }[],
): string {
  if (rows.length === 0) return "";
  return rows
    .map((r) => `${r.outcome_title.trim()}\n${r.outcome_body.trim()}`)
    .join("\n\n");
}

async function fetchPendingOutcomesForUser(
  userId: string,
  supabase: SupabaseClient,
): Promise<{ id: string; outcome_title: string; outcome_body: string }[]> {
  const due = await getDueOutcomes(userId, { locale: "ko", supabase });
  const fromChoiceHistory = due.map((d) => ({
    id: d.pendingOutcomeId,
    outcome_title: d.title,
    outcome_body: d.body,
  }));

  const nowIso = new Date().toISOString();
  const { data: legacy, error } = await supabase
    .from("arena_pending_outcomes")
    .select("id, outcome_title, outcome_body")
    .eq("user_id", userId)
    .eq("status", "pending")
    .is("source_choice_history_id", null)
    .lte("scheduled_for", nowIso)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const legacyRows = (legacy ?? []) as {
    id: string;
    outcome_title: string;
    outcome_body: string;
  }[];

  const seen = new Set(fromChoiceHistory.map((r) => r.id));
  const merged = [...fromChoiceHistory];
  for (const r of legacyRows) {
    if (!seen.has(r.id)) merged.push(r);
  }
  return merged;
}

/**
 * Before each Arena session load: enqueue delayed outcomes, load pattern narrative,
 * prepend pending delayed outcomes to the synthetic opening, append narrative — one merged `situation`.
 */
export async function buildArenaContext(
  userId: string,
  supabase?: SupabaseClient,
): Promise<ArenaInjectedContext> {
  const client = supabase ?? (await getSupabaseServerClient());

  await scheduleOutcomes(userId, client);

  const [patternNarrative, pendingRows] = await Promise.all([
    getPatternNarrative(userId, client),
    fetchPendingOutcomesForUser(userId, client),
  ]);

  const pendingBlock = formatPendingOpening(pendingRows);
  const parts = [pendingBlock, patternNarrative].filter((p) => p.trim().length > 0);
  const situation = parts.length > 0 ? parts.join("\n\n") : undefined;

  return {
    situation,
    patternNarrative,
    pendingOutcomeIds: pendingRows.map((r) => r.id),
  };
}
