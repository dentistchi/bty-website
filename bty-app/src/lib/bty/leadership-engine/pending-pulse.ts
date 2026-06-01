/**
 * Pending-pulse selection (Strategy B, surface-agnostic capture).
 * "Most recent DONE run with no le_pulse_log row" = the run to prompt for.
 * Server absence is the dedup (no client guard, no null-runId edge).
 * doneRuns assumed completed_at DESC (most-recent first).
 */
export interface DoneRunRef {
  run_id: string;
  completed_at: string | null;
}

export function computePendingPulseRun(
  doneRunsDesc: DoneRunRef[],
  pulsedRunIds: ReadonlySet<string>,
): string | null {
  for (const r of doneRunsDesc) {
    if (!pulsedRunIds.has(r.run_id)) {
      return r.run_id;
    }
  }
  return null;
}
