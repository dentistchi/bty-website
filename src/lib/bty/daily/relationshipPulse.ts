/**
 * BTY Daily OS v0.1 — Relationship Pulse projection (Slice 2).
 *
 * READ-ONLY projection: confirmed evidence over a 14-day window → self / others / ground
 * bands (Scope Lock §3, §6, §7, §8). Projection layer, not truth. Returns band + copyKey
 * only — NEVER raw counts, scores, penalties, or internal pattern labels (§6, §10).
 *
 * Dedupe (§7, forward-only): each `bty_action_contracts.id` row = one evidence item (rows
 * are unique by id). `le_verification_log` is a confidence/completion signal ONLY and is
 * intentionally NOT queried in v0.1 — confidence-weighting is deferred (DEBT-2); historical
 * undercount accepted. This guarantees a QR verification never creates a second count.
 *
 * Domain of action contracts: v0.1 maps ALL contracts to `others` (arena-originated:
 * session_id = arena_runs.run_id). pattern_family→self/ground re-homing is deferred until a
 * confirmed family→domain map exists (no guessing). Forbidden dangling names
 * (center_recovery / artifacts / train / training_*) are never referenced.
 *
 * No Data → No Interpretation (§6): an empty domain yields `quiet` + a neutral invitation
 * copyKey — never a deficit statement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PulseDomain = "self" | "others" | "ground";
export type PulseBand = "quiet" | "living" | "connected" | "deepening";

export type DomainPulse = { band: PulseBand; copyKey: string };
export type RelationshipPulse = {
  overall: PulseBand;
  domains: Record<PulseDomain, DomainPulse>;
  hasAnyEvidence: boolean;
};

const PULSE_WINDOW_DAYS = 14;

type SourceSpec = { table: string; tsColumn: string; domain: PulseDomain };

/**
 * v0.1 confirmed live-backed sources (Scope Lock §8). `dojo_submissions` live-confirmed in
 * Dispatch B. `bty_action_contracts` is handled separately (dedupe + domain note above).
 * `le_verification_log` is deliberately excluded (signal-only, §7).
 * A `gte(tsColumn, cutoff)` filter naturally excludes NULL timestamps, so nullable
 * completion columns count only completed rows.
 */
const PULSE_SOURCES: readonly SourceSpec[] = [
  { table: "center_letters", tsColumn: "created_at", domain: "self" },
  { table: "dear_me_letters", tsColumn: "created_at", domain: "self" },
  { table: "center_diagnostics", tsColumn: "completed_at", domain: "self" },
  { table: "slip_recovery_tasks", tsColumn: "completed_at", domain: "self" },
  { table: "bty_recovery_entries", tsColumn: "created_at", domain: "self" },
  { table: "arena_runs", tsColumn: "started_at", domain: "others" },
  { table: "user_scenario_choice_history", tsColumn: "played_at", domain: "others" },
  { table: "arena_pending_outcomes", tsColumn: "created_at", domain: "others" },
  { table: "user_program_progress", tsColumn: "started_at", domain: "ground" },
  { table: "user_dojo_attempts", tsColumn: "submitted_at", domain: "ground" },
  { table: "dojo_submissions", tsColumn: "created_at", domain: "ground" },
];

const BAND_RANK: Record<PulseBand, number> = { quiet: 0, living: 1, connected: 2, deepening: 3 };

/** v0.1 count→band thresholds over the 14-day window (server-side only; never exposed). */
function bandFromCount(n: number): PulseBand {
  if (n <= 0) return "quiet";
  if (n <= 2) return "living";
  if (n <= 6) return "connected";
  return "deepening";
}

function copyKeyFor(domain: PulseDomain, band: PulseBand): string {
  return `today.pulse.${domain}.${band}`;
}

function domainPulse(domain: PulseDomain, count: number): DomainPulse {
  const band = bandFromCount(count);
  return { band, copyKey: copyKeyFor(domain, band) };
}

/** Read-only head+count query, fail-quiet (degrades to 0). RLS + explicit user_id filter. */
async function countInWindow(
  supabase: SupabaseClient,
  userId: string,
  table: string,
  tsColumn: string,
  cutoffIso: string,
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select(tsColumn, { count: "exact", head: true })
      .eq("user_id", userId)
      .gte(tsColumn, cutoffIso);
    if (error) {
      console.warn(`[relationship-pulse] ${table} degraded:`, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    console.warn(`[relationship-pulse] ${table} threw:`, e instanceof Error ? e.message : e);
    return 0;
  }
}

/**
 * Project the 14-day Relationship Pulse for a user. Read-only. All source reads are
 * fail-quiet, so a degraded source contributes 0 rather than failing the projection.
 */
export async function projectRelationshipPulse(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<RelationshipPulse> {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCDate(cutoff.getUTCDate() - PULSE_WINDOW_DAYS);
  const cutoffIso = cutoff.toISOString();

  const counts: Record<PulseDomain, number> = { self: 0, others: 0, ground: 0 };

  const perSource = await Promise.all(
    PULSE_SOURCES.map(async (s) => ({
      domain: s.domain,
      n: await countInWindow(supabase, userId, s.table, s.tsColumn, cutoffIso),
    })),
  );
  for (const r of perSource) counts[r.domain] += r.n;

  // bty_action_contracts: one row (unique id) = one evidence item → others (v0.1).
  counts.others += await countInWindow(
    supabase,
    userId,
    "bty_action_contracts",
    "created_at",
    cutoffIso,
  );

  const domains: Record<PulseDomain, DomainPulse> = {
    self: domainPulse("self", counts.self),
    others: domainPulse("others", counts.others),
    ground: domainPulse("ground", counts.ground),
  };

  const overall = (Object.values(domains) as DomainPulse[]).reduce<PulseBand>(
    (max, d) => (BAND_RANK[d.band] > BAND_RANK[max] ? d.band : max),
    "quiet",
  );
  const hasAnyEvidence = counts.self + counts.others + counts.ground > 0;

  return { overall, domains, hasAnyEvidence };
}
